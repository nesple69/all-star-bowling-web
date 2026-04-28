import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const tornei = await prisma.torneo.findMany({
        select: {
            id: true,
            nome: true,
            locandina: true,
            linkIscrizione: true
        }
    });

    console.log('--- DATABASE DATA ---');
    tornei.forEach(t => {
        console.log(`ID: ${t.id}`);
        console.log(`Nome: ${t.nome}`);
        console.log(`Locandina: ${t.locandina}`);
        console.log(`Link Iscrizione: ${t.linkIscrizione}`);
        console.log('--------------------');
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
