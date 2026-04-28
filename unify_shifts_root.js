const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const prisma = new PrismaClient();

async function unify() {
    console.log('--- START UNIFY (JS) ---');
    console.log('Using DB URL:', process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND');

    try {
        const turni = await prisma.giorniOrariTorneo.findMany({
            orderBy: { orarioInizio: 'asc' }
        });

        const groups = {};
        for (const t of turni) {
            const key = `${t.torneoId}_${t.giorno.toISOString().substring(0, 10)}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }

        let unifiedCount = 0;
        let deletedCount = 0;

        for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
                console.log(`Processing ${key} with ${group.length} shifts`);
                const master = group[0];
                const redundant = group.slice(1);

                for (const r of redundant) {
                    await prisma.iscrizioneTorneo.updateMany({
                        where: { turnoId: r.id },
                        data: { turnoId: master.id }
                    });
                    await prisma.iscrizioneTorneo.updateMany({
                        where: { secondoTurnoId: r.id },
                        data: { secondoTurnoId: master.id }
                    });
                    await prisma.giorniOrariTorneo.delete({
                        where: { id: r.id }
                    });
                    deletedCount++;
                }
                unifiedCount++;
            }
        }
        console.log(`Unified ${unifiedCount}, Deleted ${deletedCount}`);
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

unify();
