import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmins() {
    const users = await prisma.user.findMany({
        where: { ruolo: 'ADMIN' },
        select: {
            id: true,
            username: true,
            email: true,
            nome: true,
            cognome: true,
            ruolo: true
        }
    });

    console.log('--- ADMINS IN DB ---');
    users.forEach(u => {
        console.log(`ID: ${u.id}`);
        console.log(`Username: ${u.username}`);
        console.log(`Email: ${u.email}`);
        console.log(`Nome/Cognome: ${u.nome} ${u.cognome}`);
        console.log(`Ruolo: ${u.ruolo}`);
        console.log('--------------------');
    });
    await prisma.$disconnect();
}

checkAdmins().catch(console.error);
