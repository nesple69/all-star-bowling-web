import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = [
    { tessera: 'AF2071', cognome: 'ALVINO', nome: 'SIMONE', cat: 'ES' },
    { tessera: 'AE8405', cognome: 'ANATRA', nome: 'ANTONELLA', cat: 'D', senior: 'A' },
    { tessera: 'AD6049', cognome: 'BACHI', nome: 'ALESSANDRO', cat: 'C', senior: 'A' },
    { tessera: 'AA4177', cognome: 'BARBIN', nome: 'LUCA GIOVANNI', cat: 'C', azienda: 'FCA TORINO', senior: 'A' },
    { tessera: 'AD1563', cognome: 'BERNETTI', nome: 'LUCA', cat: 'C' },
    { tessera: 'AB8233', cognome: 'BINI', nome: 'GIANLUCA', cat: 'A' },
    { tessera: 'AD0158', cognome: 'BONANNO', MATTEO: 'MATTEO', cat: 'A' },
    { tessera: 'AD4765', cognome: 'BONFA\'', nome: 'ANTONIO', cat: 'C', senior: 'B' },
    { tessera: 'AA5827', cognome: 'BUZZELLI', nome: 'DANIELA', cat: 'B', senior: 'B' },
    { tessera: 'AD4601', cognome: 'CAMPONESCO', nome: 'EMANUELE', cat: 'A' },
    { tessera: 'AB1613', cognome: 'CASTELLI', nome: 'GERMANO', cat: 'B', azienda: 'GRUPPO DIP. MIN. DELLA DIFESA', senior: 'A' },
    { tessera: 'AD3528', cognome: 'CEI', nome: 'STEFANIA', cat: 'C', azienda: 'MIN. PUBBL. ISTR. TOSCANA', senior: 'A' },
    { tessera: 'AD5029', cognome: 'CHITI', nome: 'MASSIMILIANO', cat: 'A', senior: 'A' },
    { tessera: 'AA9689', cognome: 'DALLE LUCCHE', nome: 'MANUELA', cat: 'B', senior: 'A' },
    { tessera: 'AA8929', cognome: 'DI DIO', nome: 'GIUSEPPINA', cat: 'C', senior: 'A' },
    { tessera: 'AA8928', cognome: 'DONISI', nome: 'GIUSEPPE', cat: 'C', senior: 'C' },
    { tessera: 'AE8404', cognome: 'FARATRO', nome: 'MARCO', cat: 'B', senior: 'A' },
    { tessera: 'AA2947', cognome: 'FLORI', nome: 'ALESSANDRO', cat: 'A', senior: 'A' },
    { tessera: 'AA6828', cognome: 'GENTILE', nome: 'CARLO', cat: 'D', azienda: 'MIN. PUBBL. ISTR. TOSCANA', senior: 'C' },
    { tessera: 'AA2973', cognome: 'GIROLDINI', nome: 'ENNIO', cat: 'B', senior: 'C' },
    { tessera: 'AD0536', cognome: 'IACCARINO', nome: 'GIANPAOLO', cat: 'B', azienda: 'POSTE ITALIANE SPA MILANO' },
    { tessera: 'AC6912', cognome: 'IACOVONE', nome: 'EMANUELA', cat: 'B', azienda: 'IAGRAPH GROUP PESCHIERA B.', senior: 'A' },
    { tessera: 'AD7712', cognome: 'IACOVONE', nome: 'RINO DAVIDE', cat: 'D', azienda: 'IAGRAPH GROUP PESCHIERA B.' },
    { tessera: 'AA5561', cognome: 'MALTINTI', nome: 'SANDRO', cat: 'A', senior: 'B' },
    { tessera: 'AA4211', cognome: 'MINENNA', nome: 'ROBERTA', cat: 'A', azienda: 'FCA TORINO', senior: 'A' },
    { tessera: 'AB4739', cognome: 'NIERI', nome: 'ALESSANDRO', cat: 'A', azienda: 'MIN. PUBBL. ISTR. TOSCANA', senior: 'A' },
    { tessera: 'AF2070', cognome: 'POLLESCHI', nome: 'CARLO', cat: 'ES', senior: 'A' },
    { tessera: 'AA3364', cognome: 'ROSSI', nome: 'FEDERICO', cat: 'A', senior: 'A' },
    { tessera: 'AA8937', cognome: 'ROTONDI', nome: 'DAVID', cat: 'B', senior: 'B' },
    { tessera: 'AD7524', cognome: 'SIMONCINI', nome: 'LUCA', cat: 'B', senior: 'B' },
    { tessera: 'AA9884', cognome: 'SPAGNOLI', nome: 'DAVIDE', cat: 'A', senior: 'A' },
    { tessera: 'AC3818', cognome: 'SPLENDIANI', nome: 'NEDO DANIELE', cat: 'B', azienda: 'MIN. PUBBL. ISTR. TOSCANA', senior: 'A' },
    { tessera: 'AA2961', cognome: 'STEFANI', nome: 'MASSIMO', cat: 'B', senior: 'A' },
];

async function main() {
    console.log('Inizio aggiornamento giocatori...');
    let success = 0;
    let errors = 0;

    for (const item of data) {
        try {
            const player = await prisma.giocatore.findFirst({
                where: {
                    OR: [
                        { numeroTessera: item.tessera },
                        {
                            AND: [
                                { cognome: { equals: item.cognome, mode: 'insensitive' } },
                                { nome: { equals: item.nome || '', mode: 'insensitive' } }
                            ]
                        }
                    ]
                }
            });

            if (player) {
                await prisma.giocatore.update({
                    where: { id: player.id },
                    data: {
                        isSenior: !!item.senior,
                        fasciaSenior: (item.senior || 'NONE') as any,
                        isAziendale: !!item.azienda,
                        aziendaAffiliata: item.azienda || null,
                        categoria: item.cat as any
                    }
                });
                console.log(`✅ Aggiornato: ${item.cognome} ${item.nome} (${item.tessera})`);
                success++;
            } else {
                console.log(`⚠️ Giocatore non trovato: ${item.cognome} ${item.nome} (${item.tessera})`);
                errors++;
            }
        } catch (err: any) {
            console.error(`❌ Errore su ${item.cognome}:`, err.message);
            errors++;
        }
    }

    console.log(`\nFine. Successi: ${success}, Errori/Non trovati: ${errors}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
