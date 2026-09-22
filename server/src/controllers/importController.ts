import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import * as scrapingService from '../services/scrapingService';

export const getPreview = async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL mancante o non valido.' });
    }

    try {
        const scrapedData = await scrapingService.fetchTorneoFederazione(url);
        const playerNames = scrapedData.classifica.map(c => c.atleta);
        const matchingResults = await scrapingService.matchGiocatori(playerNames);

        res.json({
            torneo: scrapedData.nome,
            dataInizio: scrapedData.dataInizio,
            classifica: scrapedData.classifica.map(c => {
                const match = matchingResults[c.atleta];
                return {
                    ...c,
                    match: (match && match.score < 0.2) ? match : null
                };
            })
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const importTorneoData = async (req: Request, res: Response) => {
    const { url, torneoId, matchesOverride, riportiOverride } = req.body;

    console.log(`🚀 Avvio importazione torneo ID: ${torneoId} da URL: ${url}`);
    if (matchesOverride) {
        console.log(`📝 Ricevute ${Object.keys(matchesOverride).length} corrispondenze manuali.`);
    }
    if (riportiOverride) {
        console.log(`📝 Ricevuti override riporti per ${Object.keys(riportiOverride).length} atleti.`);
    }

    if (!url || !torneoId) {
        return res.status(400).json({ error: 'URL e torneoId sono richiesti.' });
    }

    try {
        const scrapedData = await scrapingService.fetchTorneoFederazione(url);
        const playerNames = scrapedData.classifica.map(c => c.atleta);
        const matchingResults = await scrapingService.matchGiocatori(playerNames);

        const resultsToSave: {
            torneoId: string;
            giocatoreId: string;
            posizione: number;
            partiteGiocate: number;
            totaleBirilli: number;
            totaleBirilliSquadra?: number | null;
            partite: { birilli: number; isRiporto: boolean }[];
            divisione: string | null;
            riporto: number;
        }[] = [];
        const unmatched = [];

        const isAziendaleOSenior = scrapedData.nome.toUpperCase().includes('AZIENDALE') ||
            scrapedData.nome.toUpperCase().includes('SENIORES') ||
            scrapedData.nome.toUpperCase().includes('SENIOR');

        for (const item of scrapedData.classifica) {
            // Priorità alla corrispondenza manuale
            let giocatoreId = matchesOverride ? matchesOverride[item.atleta] : null;

            if (!giocatoreId) {
                const match = matchingResults[item.atleta];
                if (match && match.score < 0.2) {
                    giocatoreId = match.giocatoreId;
                }
            }

            if (giocatoreId) {
                const giocatoreDb = await prisma.giocatore.findUnique({
                    where: { id: giocatoreId },
                    select: { sesso: true, fasciaSenior: true, attivo: true }
                });

                // Se il giocatore non esiste o non è attivo (e non è specificato come override manuale intenzionale), lo scartiamo
                if (!giocatoreDb || (!giocatoreDb.attivo && !matchesOverride?.[item.atleta])) {
                    unmatched.push(item.atleta);
                    continue;
                }

                let divisioneVal = item.divisione || null;

                if (isAziendaleOSenior) {
                    const sessoStr = giocatoreDb.sesso === 'F' ? 'Femminile' : 'Maschile';
                    const fasciaStr = giocatoreDb.fasciaSenior !== 'NONE' ? ` Fascia ${giocatoreDb.fasciaSenior}` : '';
                    divisioneVal = `${sessoStr}${fasciaStr}`;
                }

                // Gestione Riporti
                const manualRiportiIndices = riportiOverride ? riportiOverride[item.atleta] : null;
                let calculatedRiporto = 0;
                let realPartiteCount = 0;

                const processedPartite = item.punteggiPartite.map((p, idx) => {
                    // Se l'indice è tra i riporti manuali, o se è > 300 e non c'è override manuale
                    const isRiporto = manualRiportiIndices 
                        ? manualRiportiIndices.includes(idx) 
                        : (p > 300 && idx === 0); // Default suggerito se > 300 in prima posizione

                    if (isRiporto) {
                        calculatedRiporto += p;
                    } else {
                        realPartiteCount++;
                    }
                    return { birilli: p, isRiporto };
                });

                resultsToSave.push({
                    torneoId,
                    giocatoreId,
                    posizione: item.posizione,
                    partiteGiocate: realPartiteCount,
                    totaleBirilli: item.birilli - calculatedRiporto, // Salviamo il NETTO
                    totaleBirilliSquadra: item.totaleBirilliSquadra || null,
                    partite: processedPartite,
                    divisione: divisioneVal,
                    riporto: calculatedRiporto
                });
            } else {
                unmatched.push(item.atleta);
            }
        }

        try {
            await prisma.$transaction(async (tx) => {
                // Carichiamo il torneo per gestire correttamente le date cumulative
                const torneoEsistente = await tx.torneo.findUnique({
                    where: { id: torneoId },
                    select: { dataInizio: true, dataFine: true }
                });

                // Invece di cancellare TUTTO, cancelliamo solo i risultati per i giocatori che stiamo importando ora.
                const idsToReplace = resultsToSave.map(r => r.giocatoreId);
                await tx.risultatoTorneo.deleteMany({
                    where: {
                        torneoId,
                        giocatoreId: { in: idsToReplace }
                    }
                });

                // Gestione cumulativa delle date (min inizio, max fine)
                let nuovaDataInizio = scrapedData.dataInizio;
                let nuovaDataFine = scrapedData.dataFine || scrapedData.dataInizio;

                if (torneoEsistente) {
                    if (torneoEsistente.dataInizio < nuovaDataInizio) {
                        nuovaDataInizio = torneoEsistente.dataInizio;
                    }
                    if (torneoEsistente.dataFine && torneoEsistente.dataFine > nuovaDataFine) {
                        nuovaDataFine = torneoEsistente.dataFine;
                    }
                }

                await tx.torneo.update({
                    where: { id: torneoId },
                    data: {
                        completato: true,
                        dataInizio: nuovaDataInizio,
                        dataFine: nuovaDataFine
                    }
                });

                for (const resData of resultsToSave) {
                    const { partite, ...risultatoData } = resData;
                    const createdRisultato = await tx.risultatoTorneo.create({
                        data: risultatoData
                    });

                    if (partite && partite.length > 0) {
                        await tx.partitaTorneo.createMany({
                            data: partite.map((p, index) => ({
                                risultatoTorneoId: createdRisultato.id,
                                numeroPartita: index + 1,
                                birilli: p.birilli,
                                isRiporto: p.isRiporto,
                                data: new Date()
                            }))
                        });
                    }

                    // Aggiorna statistiche giocatore
                    const tuttiRisultati = await tx.risultatoTorneo.findMany({
                        where: { giocatoreId: resData.giocatoreId },
                        include: { partite: true }
                    });

                    // Dato che ora r.totaleBirilli è già NETTO, la somma è diretta
                    const totaleBirilliNetto = tuttiRisultati.reduce((sum, r) => sum + r.totaleBirilli, 0);
                    const totalePartiteReali = tuttiRisultati.reduce((sum, r) => sum + r.partiteGiocate, 0);
                    const mediaAttuale = totalePartiteReali > 0 ? totaleBirilliNetto / totalePartiteReali : 0;

                    // Calcolo miglior partita ESCLUDENDO i riporti
                    const tuttePartiteReali = tuttiRisultati.flatMap(r => 
                        r.partite.filter(p => !p.isRiporto).map(p => p.birilli)
                    );
                    const migliorPartita = tuttePartiteReali.length > 0 ? Math.max(...tuttePartiteReali) : 0;

                    await tx.giocatore.update({
                        where: { id: resData.giocatoreId },
                        data: {
                            totaleBirilli: totaleBirilliNetto,
                            mediaAttuale,
                            migliorPartita
                        }
                    });
                }
            }, {
                timeout: 30000
            });

            console.log('✅ Importazione completata con successo!');
            res.json({
                message: 'Importazione completata con successo.',
                salvati: resultsToSave.length,
                nonMatchati: unmatched
            });
        } catch (transactionError: any) {
            console.error('❌ Errore durante la transazione Prisma:', transactionError);
            res.status(500).json({ error: `Errore database: ${transactionError.message}` });
        }
    } catch (error: any) {
        console.error('❌ Errore generale nell\'importazione:', error);
        res.status(500).json({ error: error.message });
    }
};
