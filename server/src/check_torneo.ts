import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const tornei = await prisma.torneo.findMany({
        where: { nome: { contains: 'FINALE ITALIANA FISBB CUP', mode: 'insensitive' } },
        include: { sedi: true }
    });
    console.log(JSON.stringify(tornei, null, 2));
}
main();
