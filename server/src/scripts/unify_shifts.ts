import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function unifyShifts() {
    console.log('--- START UNIFY SHIFTS ---');
    
    // 1. Prendi tutti i turni
    const turni = await prisma.giorniOrariTorneo.findMany({
        orderBy: { orarioInizio: 'asc' }
    });

    // 2. Raggruppa per Torneo e Giorno (solo data)
    const groups: Record<string, typeof turni> = {};
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
            console.log(`Processing group ${key} (${group.length} shifts)`);
            
            // Il "Master" è quello con l'orario di inizio più basso
            const master = group[0];
            const redundant = group.slice(1);

            for (const r of redundant) {
                console.log(`  Merging shift ${r.orarioInizio.toISOString()} into ${master.orarioInizio.toISOString()}`);
                
                // Sposta le iscrizioni primarie
                await prisma.iscrizioneTorneo.updateMany({
                    where: { turnoId: r.id },
                    data: { turnoId: master.id }
                });

                // Sposta le iscrizioni secondarie
                await prisma.iscrizioneTorneo.updateMany({
                    where: { secondoTurnoId: r.id },
                    data: { secondoTurnoId: master.id }
                });

                // Elimina il turno ridondante
                await prisma.giorniOrariTorneo.delete({
                    where: { id: r.id }
                });
                
                deletedCount++;
            }
            
            // Assicurati che l'orario del master sia "pulito" (senza Z, come per la nuova logica)
            // Beh, qui lasciamo come sono nel DB, ma uniformati.
            unifiedCount++;
        }
    }

    console.log(`--- FINISH: Unified ${unifiedCount} groups, Deleted ${deletedCount} redundant shifts ---`);
}

unifyShifts()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
