import axios from 'axios';
import * as cheerio from 'cheerio';
import Fuse from 'fuse.js';
import { prisma } from '../lib/prisma';

interface ScrapedResult {
    posizione: number;
    atleta: string;
    partite: number;
    birilli: number;
    media: number;
    punteggiPartite: number[];
    divisione?: string | null;
    totaleBirilliSquadra?: number | null;
}

interface TorneoData {
    nome: string;
    dataInizio: Date;
    dataFine: Date | null;
    classifica: ScrapedResult[];
}

const isPrivateIpOrHost = (hostname: string): boolean => {
    const lower = hostname.toLowerCase();
    if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') {
        return true;
    }
    // Blocca intervalli di indirizzi privati e metadata cloud
    if (
        lower.startsWith('10.') ||
        lower.startsWith('192.168.') ||
        lower.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)
    ) {
        return true;
    }
    return false;
};

export const validateScrapingUrl = (rawUrl: string): URL => {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('URL non valido o malformato.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Protocollo non supportato. Utilizzare solo HTTP o HTTPS.');
    }

    if (isPrivateIpOrHost(parsed.hostname)) {
        throw new Error('Accesso a risorse di rete interne o private non consentito.');
    }

    return parsed;
};

export const fetchTorneoFederazione = async (url: string): Promise<TorneoData> => {
    const validatedUrl = validateScrapingUrl(url);

    try {
        const { data: html } = await axios.get(validatedUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 25000,
            maxRedirects: 3
        });

        const $ = cheerio.load(html);

        // Estrazione nome torneo
        let nome = 'Torneo FISB';
        $('h1, h2, .component-heading').each((i, el) => {
            const t = $(el).text().trim();
            if (t && !['QUALIFICAZIONE', 'BOWLING', 'RISULTATI AGGIORNATI'].some(skip => t.toUpperCase().includes(skip))) {
                nome = t;
                return false; // Break
            }
        });

        const dataTesto = $('.date, .tournament-date').first().text().trim();
        let dataInizio = new Date();
        let dataFine: Date | null = null;

        if (dataTesto) {
            // Gestione range date tipo "05/10/2025 - 10/10/2025" o "05/10 - 10/10/2025"
            const dateParts = dataTesto.split(/[-–—/]\s+/).map(d => d.trim());
            if (dateParts.length >= 1) {
                dataInizio = new Date(dateParts[0]);
                // Se la data è invalida (es. solo giorno/mese), proviamo a ricostruirla
                if (isNaN(dataInizio.getTime())) {
                    const currentYear = new Date().getFullYear();
                    dataInizio = new Date(`${dateParts[0]}/${currentYear}`);
                }
            }
            if (dateParts.length >= 2) {
                dataFine = new Date(dateParts[1]);
                if (isNaN(dataFine.getTime())) {
                    const currentYear = new Date().getFullYear();
                    dataFine = new Date(`${dateParts[1]}/${currentYear}`);
                }
            }
        }

        const classifica: ScrapedResult[] = [];
        let lastAtleta = '';
        let realColIndices = {
            posizione: 0,
            atleta: 2,
            birilli: 11,
            media: 12,
            squadra: -1
        };

        const updateColIndices = ($row: any) => {
            const headerCells = $row.find('td, th');
            let currentRealIndex = 0;
            let foundAny = false;

            headerCells.each((j: number, cell: any) => {
                const text = $(cell).text().toUpperCase().trim();
                const colspan = parseInt($(cell).attr('colspan') || '1');

                if (text === 'GIOCATORE' || text === 'ATLETA') {
                    realColIndices.atleta = currentRealIndex;
                    foundAny = true;
                }
                if (text === 'TOTALE' || text === 'BIRILLI') {
                    realColIndices.birilli = currentRealIndex;
                    foundAny = true;
                }
                if (text === 'MEDIA') {
                    realColIndices.media = currentRealIndex;
                    foundAny = true;
                }
                if (text === 'POS' || text === '#' || (text === '' && j === 0)) {
                    realColIndices.posizione = currentRealIndex;
                    foundAny = true;
                }
                if (text === 'DOPPIO' || text === 'SQUADRA' || text === 'TRIS') {
                    realColIndices.squadra = currentRealIndex;
                    foundAny = true;
                }
                currentRealIndex += colspan;
            });
            return foundAny;
        };

        // Rilevamento iniziale
        $('table tr').each((i, row) => {
            if (updateColIndices($(row))) return false; // Smetti al primo header utile
        });

        let lastPos = 0;
        let currentDivision: string | null = null;
        let currentGender: string = ''; // 'Maschile' o 'Femminile'
        const categoryKeywords = [
            'ECCELLENZA', 'CADETTI', 'ESORDIENTI', 'SENIORES', 'JUNIORES',
            'MASCHILE', 'FEMMINILE', 'MISTO', 'CAT.', 'FASCIA'
        ];

        const cleanDivisionName = (rawText: string) => {
            let name = rawText
                .replace(/Qualificazione\s+/i, '')
                .replace(/Classifica\s+/i, '')
                .replace(/cat\./i, '')
                .replace(/Campionato\s+/i, '')
                .trim();

            const upper = name.toUpperCase();
            if (upper.includes('MASCHILE')) currentGender = 'Maschile';
            if (upper.includes('FEMMINILE')) currentGender = 'Femminile';

            // Se abbiamo un genere ma non è nel nome, lo aggiungiamo in coda
            if (currentGender && !upper.includes(currentGender.toUpperCase())) {
                // Evitiamo di aggiungere genere a nomi troppo generici o che sono solo date
                if (categoryKeywords.some(key => upper.includes(key))) {
                    name = `${name} ${currentGender}`;
                }
            }
            return name;
        };

        $('h1, h2, h3, table tr').each((i, el) => {
            const $el = $(el);

            if ($el.is('h1, h2, h3')) {
                const text = $el.text().trim();
                const upperText = text.toUpperCase();

                if (categoryKeywords.some(key => upperText.includes(key))) {
                    if (upperText !== nome.toUpperCase()) {
                        currentDivision = cleanDivisionName(text);
                        console.log(`[SCRAPER] Nuova divisione (Titolo) rilevata: ${currentDivision}`);
                        return;
                    }
                }
            }

            if ($el.is('tr')) {
                const cols = $el.find('td');
                if (cols.length === 0) return;

                const cells = cols.map((j, c) => $(c).text().trim()).get();
                const fullRowText = cells.join(' ');

                // 1. Se la riga è un header di tabella (GIOCATORE, ATLETA), aggiorna indici e SALTA
                // Spostato sopra per evitare che l'header venga scambiato per una divisione
                if (cells.some(t => t.toUpperCase() === 'GIOCATORE' || t.toUpperCase() === 'ATLETA' || t.toUpperCase() === 'POS')) {
                    updateColIndices($el);
                    return;
                }

                // 2. Controllo se è una riga di divisione/genere (indipendentemente dal numero di colonne)
                if (categoryKeywords.some(key => fullRowText.toUpperCase().includes(key))) {
                    // Se non ha i dati di un atleta (posizione numerica), è probabilmente un header
                    const firstCellNum = parseInt(cells[0] || '');
                    if (isNaN(firstCellNum)) {
                        const potentialDivision = cleanDivisionName(fullRowText);
                        // Sicurezza: un nome divisione non dovrebbe essere lunghissimo (probabile riga di dati sporca)
                        if (potentialDivision.length > 50) {
                            console.warn(`[SCRAPER] Divisione scartata perché troppo lunga: ${potentialDivision.substring(0, 30)}...`);
                        } else {
                            currentDivision = potentialDivision;
                            console.log(`[SCRAPER] Nuova divisione rilevata da riga: ${currentDivision}`);
                            if (cols.length < 5) return; // Se è una riga corta, abbiamo finito qui
                        }
                    }
                }

                if (cols.length < 5) return;

                const posText = cells[realColIndices.posizione];
                const posizione = parseInt(posText);
                if (!isNaN(posizione)) lastPos = posizione;

                let atleta = cells[realColIndices.atleta];
                if (!atleta && lastAtleta) {
                    atleta = lastAtleta;
                }
                if (!atleta || atleta === 'Giocatore') return;
                lastAtleta = atleta;

                const birilliText = cells[realColIndices.birilli];

                let totaleBirilliSquadra: number | null = null;
                if (realColIndices.squadra !== -1) {
                    const squadraText = cells[realColIndices.squadra];
                    const val = parseInt(squadraText?.replace(/\./g, ''));
                    if (!isNaN(val) && val > 0) totaleBirilliSquadra = val;
                }

                let punteggiPartite: number[] = [];
                let gameStartIndex = realColIndices.atleta + 1;

                // Estraiamo tutti i valori numerici potenziali tra Atleta e Totale
                const numericCandidates: { val: number; index: number }[] = [];
                for (let j = gameStartIndex; j < realColIndices.birilli; j++) {
                    const cellText = cells[j]?.trim();
                    // Saltiamo celle vuote o che contengono lettere/slash (categorie come M/B o ASD)
                    if (!cellText || cellText === '' || /[A-Z\/]/i.test(cellText)) continue;

                    const val = parseInt(cellText.replace(/\./g, ''));
                    // Escludiamo anche valori troppo alti che potrebbero essere il totale erroneamente incluso
                    if (!isNaN(val) && val > 0 && val < 400) {
                        numericCandidates.push({ val, index: j });
                    }
                }

                // Identificazione e scarto HDP/Metadati Numerici: 
                // Finché il primo numero è troppo basso per una partita nazionale (< 90)
                // e abbiamo almeno un punteggio "reale" (> 100) dopo, scartiamo.
                while (numericCandidates.length > 1 && numericCandidates[0].val < 90) {
                    const hasRealGames = numericCandidates.some(c => c.val > 100);
                    if (hasRealGames) {
                        numericCandidates.shift();
                    } else {
                        break;
                    }
                }

                punteggiPartite = numericCandidates.map(c => c.val);

                if (punteggiPartite.length === 0) return;

                const birilli = punteggiPartite.reduce((a, b) => a + b, 0);
                const partiteCount = punteggiPartite.length;
                const media = partiteCount > 0 ? birilli / partiteCount : 0;

                classifica.push({
                    posizione: lastPos,
                    atleta,
                    partite: partiteCount,
                    birilli,
                    media,
                    punteggiPartite, // Restituiamo l'array completo per l'anteprima
                    divisione: currentDivision,
                    totaleBirilliSquadra
                });
            }
        });

        return { nome, dataInizio, dataFine, classifica };
    } catch (error: any) {
        console.error('Errore durante lo scraping FISB:', error.message);
        throw new Error(`Impossibile recuperare i dati dal sito federazione: ${error.message}`);
    }
};

export const matchGiocatori = async (nomiFederazione: string[]) => {
    // Recupera tutti i giocatori dal DB per il matching
    const giocatoriDb = await prisma.giocatore.findMany({
        select: { id: true, nome: true, cognome: true }
    });

    const listToSearch = giocatoriDb.map(g => ({
        id: g.id,
        fullName: `${g.cognome} ${g.nome}`.toLowerCase(),
        reversedName: `${g.nome} ${g.cognome}`.toLowerCase()
    }));

    const options = {
        keys: ['fullName', 'reversedName'],
        threshold: 0.2, // Soglia più rigida per evitare falsi positivi (es: CHITI MASSIMILIANO vs MASSIMILIANO CELLI)
        includeScore: true
    };

    const fuse = new Fuse(listToSearch, options);
    const mapping: Record<string, { giocatoreId: string; score: number } | null> = {};

    for (const nomeFede of nomiFederazione) {
        const results = fuse.search(nomeFede.toLowerCase());
        if (results.length > 0) {
            mapping[nomeFede] = {
                giocatoreId: results[0].item.id,
                score: results[0].score || 0
            };
        } else {
            mapping[nomeFede] = null;
        }
    }

    return mapping;
};
