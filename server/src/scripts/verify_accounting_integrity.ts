import { prisma } from '../lib/prisma';
import { TipoMovimento, Prisma } from '@prisma/client';
import { recalculateSaldo } from '../controllers/contabilitaController';

async function main() {
    console.log('🔍 [AUDIT CONTABILE] Avvio scansione database per verifica integrità...');

    // 1. Controlla movimenti con importi negativi anomali
    const negativeMovements = await prisma.movimentoContabile.findMany({
        where: {
            importo: {
                lt: 0
            }
        },
        include: {
            giocatore: {
                select: {
                    nome: true,
                    cognome: true,
                    numeroTessera: true
                }
            }
        }
    });

    console.log(`📊 Movimenti con segno negativo rilevati: ${negativeMovements.length}`);

    if (negativeMovements.length > 0) {
        console.log('⚠️ Normalizzazione movimenti storici con segno negativo...');
        for (const mov of negativeMovements) {
            const positiveVal = Math.abs(Number(mov.importo));
            await prisma.movimentoContabile.update({
                where: { id: mov.id },
                data: { importo: positiveVal }
            });
            console.log(`  -> Movimento ${mov.id} (${mov.tipo}) di ${mov.giocatore.cognome} ${mov.giocatore.nome}: corretto in +${positiveVal}€`);
        }
    }

    // 2. Ricalcolo e allineamento saldi di tutti i giocatori
    console.log('🔄 Ricalcolo e allineamento saldi per tutti i giocatori...');
    const tuttiGiocatori = await prisma.giocatore.findMany({
        select: { id: true, nome: true, cognome: true }
    });

    let discrepanze = 0;
    for (const g of tuttiGiocatori) {
        const saldoDbPrima = await prisma.saldoBorsellino.findUnique({
            where: { giocatoreId: g.id }
        });

        const valorePrima = saldoDbPrima ? Number(saldoDbPrima.saldoAttuale) : 0;

        await prisma.$transaction(async (tx) => {
            const nuovoSaldo = await recalculateSaldo(g.id, tx);
            if (Math.abs(valorePrima - nuovoSaldo) > 0.001) {
                console.log(`  ⚠️ Discrepanza corretta per ${g.cognome} ${g.nome}: prima=${valorePrima}€, nuovo=${nuovoSaldo}€`);
                discrepanze++;
            }
        });
    }

    console.log(`\n✅ Audit completato con successo!`);
    console.log(`   - Movimenti normalizzati: ${negativeMovements.length}`);
    console.log(`   - Saldi ricalcolati / allineati: ${discrepanze} discrepanze sanate su ${tuttiGiocatori.length} soci.`);
}

main()
    .catch((e) => {
        console.error('Errore durante l\'esecuzione dell\'audit:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
