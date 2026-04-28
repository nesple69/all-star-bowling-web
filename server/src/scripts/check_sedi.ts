import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function checkSedi() {
    console.log('--- CHECK SEDI ---');
    const iscrittiSenzaSede = await prisma.iscrizioneTorneo.findMany({
        where: { sedeId: null },
        include: {
            torneo: { include: { sedi: true } },
            turno: true
        }
    });

    console.log(`Found ${iscrittiSenzaSede.length} registrations without Sede.`);
    
    iscrittiSenzaSede.slice(0, 5).forEach(i => {
        console.log(`Iscrizione: ${i.id}`);
        console.log(`  Torneo: ${i.torneo.nome}`);
        console.log(`  Turno Date: ${i.turno.orarioInizio}`);
        console.log(`  Torneo Sedi count: ${i.torneo.sedi.length}`);
        if(i.torneo.sedi.length > 0) {
            console.log(`  Suggesting Sede: ${i.torneo.sedi[0].nome} (${i.torneo.sedi[0].id})`);
        }
    });
}

checkSedi()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
