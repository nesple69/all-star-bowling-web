import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // 1. Rinomina la sede Brunswick
    await prisma.sedeTorneo.updateMany({
        where: {
            torneoId: '9c7e2bc5-cf61-4db6-86cd-0b778be832ad',
            nome: 'Girone Cadetti Maschile'
        },
        data: {
            nome: 'Brunswick Bowling (Roma)'
        }
    });

    // 2. Forza l'assegnazione corretta delle iscrizioni per questo torneo
    const torneo = await prisma.torneo.findUnique({
        where: { id: '9c7e2bc5-cf61-4db6-86cd-0b778be832ad' },
        include: { sedi: true }
    });

    if (!torneo) return;

    const iscrizioni = await prisma.iscrizioneTorneo.findMany({
        where: { torneoId: torneo.id },
        include: { giocatore: true }
    });

    for (const isc of iscrizioni) {
        const cat = isc.giocatore.categoria;
        const sesso = isc.giocatore.sesso;
        const fullCat = `${sesso}/${cat}`;

        const targetSede = torneo.sedi.find(s => 
            s.categorie.includes(fullCat) || 
            s.categorie.includes(cat)
        );

        if (targetSede) {
            await prisma.iscrizioneTorneo.update({
                where: { id: isc.id },
                data: { sedeId: targetSede.id }
            });
            console.log(`Updated ${isc.giocatore.cognome} to ${targetSede.nome}`);
        }
    }
}
main();
