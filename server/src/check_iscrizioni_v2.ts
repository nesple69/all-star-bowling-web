import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const iscrizioni = await prisma.iscrizioneTorneo.findMany({
        where: { torneoId: '9c7e2bc5-cf61-4db6-86cd-0b778be832ad' },
        include: { sede: true, giocatore: { select: { categoria: true, cognome: true } } }
    });
    console.log(JSON.stringify(iscrizioni, null, 2));
}
main();
