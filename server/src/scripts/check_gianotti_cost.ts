import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tornei = await prisma.torneo.findMany({
        where: { nome: { contains: 'Gianotti', mode: 'insensitive' } },
        select: { id: true, nome: true, costoIscrizione: true }
    });
    console.log('RISULTATO RICERCA TORNEO:');
    console.log(JSON.stringify(tornei, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
