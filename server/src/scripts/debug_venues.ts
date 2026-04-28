import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tornei = await prisma.torneo.findMany({
        where: { nome: { contains: 'SINGOLO FASE 2', mode: 'insensitive' } },
        include: { 
            sedi: true,
            iscrizioni: {
                include: {
                    giocatore: true,
                    turno: { include: { sede: true } },
                    sede: true
                }
            }
        }
    });

    for (const t of tornei) {
        console.log(`\nTORNEO: ${t.nome} (ID: ${t.id})`);
        console.log(`SEDE (string): "${t.sede}"`);
        console.log(`SEDI (table): ${t.sedi.map(s => s.nome).join(', ')}`);
        
        console.log(`\nISCRIZIONI (${t.iscrizioni.length}):`);
        t.iscrizioni.forEach(iscr => {
            console.log(`- ${iscr.giocatore.cognome} ${iscr.giocatore.nome}:`);
            console.log(`  - Iscr Sede: ${iscr.sede?.nome || 'NULL'}`);
            console.log(`  - Turno Sede: ${iscr.turno?.sede?.nome || 'NULL'}`);
            console.log(`  - Turno: ${iscr.turno?.giorno.toISOString().split('T')[0]} ${iscr.turno?.orarioInizio.toISOString().split('T')[1].substring(0, 5)}`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
