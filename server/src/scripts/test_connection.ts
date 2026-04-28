import { PrismaClient } from '@prisma/client';

async function testConnection() {
    console.log('--- TEST DI CONNESSIONE DATABASE ---');
    
    const urls = [
        // 1. Password codificata (%40)
        'postgresql://postgres.fpktboiyitwmwodwxuki:Ari%401Nico%405@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true',
        // 2. Password pulita (potrebbe fallire il parsing)
        'postgresql://postgres.fpktboiyitwmwodwxuki:Ari@1Nico@5@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true'
    ];

    for (let i = 0; i < urls.length; i++) {
        console.log(`\nTest #${i + 1}...`);
        const prisma = new PrismaClient({
            datasources: { db: { url: urls[i] } },
        });

        try {
            await prisma.$connect();
            console.log('✅ SUCCESSO! Connessione stabilita.');
            const count = await prisma.torneo.count();
            console.log(`📊 Il database contiene ${count} tornei.`);
            await prisma.$disconnect();
            return; // Esci se uno funziona
        } catch (err: any) {
            console.log(`❌ FALLITO: ${err.message.substring(0, 100)}...`);
        } finally {
            await prisma.$disconnect();
        }
    }
}

testConnection();
