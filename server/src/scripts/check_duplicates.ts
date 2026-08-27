import { prisma } from '../lib/prisma';

async function checkDuplicates() {
    console.log('🔍 Controllo duplicati in IscrizioneTorneo...');

    const iscrizioni = await prisma.iscrizioneTorneo.findMany();
    const seen = new Map<string, string[]>(); // key: `${torneoId}_${giocatoreId}`, value: [id1, id2]

    for (const iscr of iscrizioni) {
        const key = `${iscr.torneoId}_${iscr.giocatoreId}`;
        if (!seen.has(key)) {
            seen.set(key, []);
        }
        seen.get(key)!.push(iscr.id);
    }

    let duplicatesFound = 0;
    for (const [key, ids] of seen.entries()) {
        if (ids.length > 1) {
            console.log(`⚠️ Trovato duplicato per coppia torneo/giocatore [${key}]: ${ids.length} iscrizioni (${ids.join(', ')})`);
            duplicatesFound++;
        }
    }

    if (duplicatesFound === 0) {
        console.log('✅ Nessun duplicato presente. La tabella IscrizioneTorneo è pulita.');
    } else {
        console.log(`⚠️ Trovati ${duplicatesFound} gruppi di duplicati.`);
    }
}

checkDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
