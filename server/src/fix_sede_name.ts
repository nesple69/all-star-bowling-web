import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const res = await prisma.sedeTorneo.updateMany({
        where: {
            torneoId: '9c7e2bc5-cf61-4db6-86cd-0b778be832ad',
            nome: 'Bowling Ciampino'
        },
        data: {
            nome: 'MONDIAL BOWLING (CIAMPINO, ROMA)'
        }
    });
    console.log(`Updated ${res.count} records`);
}
main();
