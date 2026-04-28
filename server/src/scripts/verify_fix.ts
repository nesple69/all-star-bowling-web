import { differenceInDays } from 'date-fns';

interface TorneoTest {
    id: string;
    nome: string;
    linkIscrizione: string;
    locandina: string;
    dataInizio: string;
    mostraBottoneIscrizione: boolean;
    completato: boolean;
}

const torneiTest: TorneoTest[] = [
    {
        id: 'mirandola-id',
        nome: "1 CITTA' DI MIRANDOLA",
        linkIscrizione: '/uploads/locandine/locandina-mirandola.pdf',
        locandina: '/uploads/locandine/locandina-mirandola.pdf',
        dataInizio: '2026-05-15',
        mostraBottoneIscrizione: true,
        completato: false
    },
    {
        id: 'fisbb-id',
        nome: "FINALE ITALIANA FISBB CUP",
        linkIscrizione: '/uploads/locandine/regolamento-fisbb.pdf',
        locandina: '/uploads/locandine/regolamento-fisbb.pdf',
        dataInizio: '2026-05-20',
        mostraBottoneIscrizione: true,
        completato: false
    }
];

function testLogic(torneo: TorneoTest) {
    console.log(`\n--- Test Torneo: ${torneo.nome} ---`);
    
    const isScaduto2Giorni = differenceInDays(new Date('2026-04-28'), new Date(torneo.dataInizio)) >= 2;
    
    if (!torneo.mostraBottoneIscrizione || torneo.completato || isScaduto2Giorni) {
        console.log("RISULTATO: Bottone nascosto");
        return;
    }

    // NUOVA LOGICA FORZATA NELLA HOME (Dashboard.tsx)
    console.log("HOME PAGE   -> Destinazione: MODULO INTERNO (/tornei/" + torneo.id + "/iscrizione)");
    
    // LOGICA TAB TORNEI (Tornei.tsx)
    const rawLink = (torneo.linkIscrizione || '').trim().toLowerCase();
    const isDocument = rawLink.endsWith('.pdf') || 
                     rawLink.includes('/uploads/') || 
                     rawLink.includes('locandina') || 
                     rawLink.includes('regolamento');

    const isExternal = torneo.linkIscrizione && torneo.linkIscrizione.trim() && !isDocument;
    
    if (isExternal) {
        console.log("TAB TORNEI  -> Destinazione: LINK ESTERNO (PDF/Altro)");
    } else {
        console.log("TAB TORNEI  -> Destinazione: MODULO INTERNO");
    }
}

console.log("VERIFICA LOGICA ISCRIZIONE TORNEI");
torneiTest.forEach(testLogic);
