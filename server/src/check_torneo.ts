import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const turni = await prisma.giorniOrariTorneo.findMany({
        where: { giorno: { gte: new Date('2026-04-20') } },
        orderBy: { orarioInizio: 'asc' }
    });
    console.log(JSON.stringify(turni, null, 2));
}
main();
