import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

// -------------------------------------------------------------
// FASE 1: GESTIONE DISPONIBILITÀ ATLETI (Tutti i giocatori loggati)
// -------------------------------------------------------------

// POST /api/tornei/:id/disponibilita (Atleta dà la propria disponibilità)
export const daiDisponibilita = async (req: AuthRequest, res: Response) => {
    const torneoId = req.params.id as string;
    const userId = req.user?.userId;
    const { note, giocatoreId: requestedGiocatoreId } = req.body;

    try {
        if (!userId) {
            return res.status(401).json({ message: 'Utente non autenticato' });
        }

        // Se l'utente è ADMIN o COACH può specificare giocatoreId, altrimenti usa il proprio
        let giocatore;
        if ((req.user?.role === 'ADMIN' || req.user?.role === 'COACH') && requestedGiocatoreId) {
            giocatore = await prisma.giocatore.findUnique({
                where: { id: requestedGiocatoreId },
                include: { saldo: true }
            });
        } else {
            giocatore = await prisma.giocatore.findUnique({
                where: { userId },
                include: { saldo: true }
            });
        }

        if (!giocatore) {
            return res.status(404).json({ message: 'Profilo atleta non trovato per questo account.' });
        }

        if (!giocatore.attivo) {
            return res.status(400).json({ message: 'Profilo atleta non attivo. Contatta la segreteria.' });
        }

        const torneo = await prisma.torneo.findUnique({
            where: { id: torneoId }
        });

        if (!torneo) {
            return res.status(404).json({ message: 'Torneo non trovato.' });
        }

        if (torneo.completato) {
            return res.status(400).json({ message: 'Questo torneo è già terminato.' });
        }

        // 1. Controllo Certificato Medico
        if (!giocatore.certificatoMedicoScadenza) {
            return res.status(400).json({
                message: 'Certificato medico mancante. Inserisci la data di scadenza del certificato per dare la disponibilità.'
            });
        }

        const dataRiferimento = torneo.dataInizio ? new Date(torneo.dataInizio) : new Date();
        const dataScadenza = new Date(giocatore.certificatoMedicoScadenza);

        if (dataScadenza < dataRiferimento) {
            const scadenzaStr = dataScadenza.toLocaleDateString('it-IT');
            return res.status(400).json({
                message: `Certificato medico scaduto il ${scadenzaStr}. È necessario rinnovarlo prima di partecipare al torneo.`
            });
        }

        // 2. Controllo Borsellino
        const costoQuota = Number(torneo.costoIscrizione || 0);
        const saldoAttuale = Number(giocatore.saldo?.saldoAttuale || 0);

        if (costoQuota > 0 && saldoAttuale < costoQuota) {
            return res.status(400).json({
                message: `Saldo borsellino insufficiente: hai €${saldoAttuale.toFixed(2)}, ma la quota del torneo è di €${costoQuota.toFixed(2)}. Ricarica il borsellino per dare disponibilità.`
            });
        }

        // 3. Verifica stato esistente
        const dispEsistente = await prisma.disponibilitaTorneo.findUnique({
            where: {
                torneoId_giocatoreId: {
                    torneoId,
                    giocatoreId: giocatore.id
                }
            }
        });

        if (dispEsistente && dispEsistente.stato === 'ASSEGNATO') {
            return res.status(400).json({
                message: 'Sei già stato inserito in una squadra confermata per questo torneo.'
            });
        }

        const disponibilita = await prisma.disponibilitaTorneo.upsert({
            where: {
                torneoId_giocatoreId: {
                    torneoId,
                    giocatoreId: giocatore.id
                }
            },
            create: {
                torneoId,
                giocatoreId: giocatore.id,
                stato: 'IN_ATTESA',
                note: note || null
            },
            update: {
                stato: 'IN_ATTESA',
                note: note || null
            },
            include: {
                giocatore: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        categoria: true,
                        mediaAttuale: true,
                        sesso: true
                    }
                }
            }
        });

        res.json({
            message: 'Disponibilità registrata con successo!',
            disponibilita
        });
    } catch (err) {
        console.error('Errore registrazione disponibilità:', err);
        res.status(500).json({ message: 'Errore interno nella registrazione della disponibilità.' });
    }
};

// DELETE /api/tornei/:id/disponibilita (Atleta ritira la disponibilità)
export const ritiraDisponibilita = async (req: AuthRequest, res: Response) => {
    const torneoId = req.params.id as string;
    const userId = req.user?.userId;
    const { giocatoreId: requestedGiocatoreId } = req.body || {};

    try {
        if (!userId) {
            return res.status(401).json({ message: 'Utente non autenticato' });
        }

        let giocatoreId: string;
        if ((req.user?.role === 'ADMIN' || req.user?.role === 'COACH') && requestedGiocatoreId) {
            giocatoreId = requestedGiocatoreId;
        } else {
            const g = await prisma.giocatore.findUnique({ where: { userId } });
            if (!g) return res.status(404).json({ message: 'Atleta non trovato.' });
            giocatoreId = g.id;
        }

        const disp = await prisma.disponibilitaTorneo.findUnique({
            where: {
                torneoId_giocatoreId: {
                    torneoId,
                    giocatoreId
                }
            }
        });

        if (!disp) {
            return res.status(404).json({ message: 'Nessuna disponibilità trovata per questo torneo.' });
        }

        if (disp.stato === 'ASSEGNATO') {
            return res.status(400).json({
                message: 'Non puoi ritirare la disponibilità: sei già stato assegnato a una squadra. Contatta il Coach o l\'Amministratore.'
            });
        }

        await prisma.disponibilitaTorneo.delete({
            where: { id: disp.id }
        });

        res.json({ message: 'Disponibilità ritirata con successo.' });
    } catch (err) {
        console.error('Errore ritiro disponibilità:', err);
        res.status(500).json({ message: 'Errore nel ritiro della disponibilità.' });
    }
};

// GET /api/tornei/:id/disponibilita-atleti (Lista pubblica/iscritti di chi ha dato disponibilità)
export const getDisponibilitaAtleti = async (req: Request, res: Response) => {
    const torneoId = req.params.id as string;

    try {
        const disponibili = await prisma.disponibilitaTorneo.findMany({
            where: { torneoId },
            include: {
                giocatore: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        categoria: true,
                        mediaAttuale: true,
                        sesso: true,
                        isSenior: true,
                        fasciaSenior: true
                    }
                }
            },
            orderBy: [
                { giocatore: { categoria: 'asc' } },
                { giocatore: { cognome: 'asc' } }
            ]
        });

        res.json(disponibili);
    } catch (err) {
        console.error('Errore recupero lista disponibilità:', err);
        res.status(500).json({ message: 'Errore nel recupero della lista disponibili.' });
    }
};

// GET /api/tornei/public/:id/squadre (Pubblico - Lista formazioni ufficiali create dal Coach)
export const getSquadreTorneoPublic = async (req: Request, res: Response) => {
    const torneoId = req.params.id as string;

    try {
        const squadre = await prisma.squadraTorneo.findMany({
            where: { torneoId },
            include: {
                turno: { include: { sede: true } },
                secondoTurno: { include: { sede: true } },
                sede: true,
                confermataDa: {
                    select: { id: true, nome: true, cognome: true }
                },
                iscrizioni: {
                    include: {
                        giocatore: {
                            select: {
                                id: true,
                                nome: true,
                                cognome: true,
                                categoria: true,
                                mediaAttuale: true,
                                sesso: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json(squadre);
    } catch (err) {
        console.error('Errore recupero squadre pubbliche:', err);
        res.status(500).json({ message: 'Errore nel recupero delle formazioni.' });
    }
};

// -------------------------------------------------------------
// FASE 2: AREA COACH - COMPOSIZIONE E CONFERMA SQUADRE
// -------------------------------------------------------------

// GET /api/coach/tornei/:id/formazioni (Dati completi per il pannello Coach)
export const getFormazioniCoach = async (req: AuthRequest, res: Response) => {
    const torneoId = req.params.id as string;

    try {
        const torneo = await prisma.torneo.findUnique({
            where: { id: torneoId },
            include: {
                turni: {
                    include: {
                        sede: true,
                        _count: { select: { iscrizioni: true } }
                    },
                    orderBy: { orarioInizio: 'asc' }
                },
                sedi: true
            }
        });

        if (!torneo) {
            return res.status(404).json({ message: 'Torneo non trovato.' });
        }

        // Tutti gli atleti con disponibilità per questo torneo
        const disponibili = await prisma.disponibilitaTorneo.findMany({
            where: { torneoId },
            include: {
                giocatore: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        categoria: true,
                        mediaAttuale: true,
                        sesso: true,
                        isSenior: true,
                        fasciaSenior: true,
                        saldo: { select: { saldoAttuale: true } }
                    }
                }
            },
            orderBy: [
                { giocatore: { categoria: 'asc' } },
                { giocatore: { cognome: 'asc' } }
            ]
        });

        // Tutte le squadre già composte per questo torneo
        const squadre = await prisma.squadraTorneo.findMany({
            where: { torneoId },
            include: {
                turno: { include: { sede: true } },
                secondoTurno: { include: { sede: true } },
                sede: true,
                confermataDa: {
                    select: { id: true, nome: true, cognome: true }
                },
                iscrizioni: {
                    include: {
                        giocatore: {
                            select: {
                                id: true,
                                nome: true,
                                cognome: true,
                                categoria: true,
                                mediaAttuale: true,
                                sesso: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json({
            torneo,
            disponibili,
            squadre
        });
    } catch (err) {
        console.error('Errore getFormazioniCoach:', err);
        res.status(500).json({ message: 'Errore nel caricamento dei dati per il Coach.' });
    }
};

// POST /api/coach/tornei/:id/conferma-squadre (Coach salva e pubblica squadre con addebito borsellino)
export const confermaSquadreCoach = async (req: AuthRequest, res: Response) => {
    const torneoId = req.params.id as string;
    const adminOrCoachUserId = req.user?.userId;
    const { squadre, riserveIds } = req.body as {
        squadre: Array<{
            nomeSquadra: string;
            giocatoreIds: string[];
        }>;
        riserveIds?: string[];
    };

    if (!Array.isArray(squadre) || squadre.length === 0) {
        return res.status(400).json({ message: 'Nessuna squadra inviata per la conferma.' });
    }

    try {
        const torneo = await prisma.torneo.findUnique({
            where: { id: torneoId }
        });

        if (!torneo) return res.status(404).json({ message: 'Torneo non trovato.' });

        // Calcola numero richiesto di atleti per formazione
        let requiredPerTeam = 2;
        if (torneo.tipologia === 'DOPPIO') requiredPerTeam = 2;
        else if (torneo.tipologia === 'TRIS') requiredPerTeam = 3;
        else if (torneo.tipologia === 'SQUADRA_4') requiredPerTeam = 4;
        else {
            return res.status(400).json({ message: 'La composizione squadre è valida solo per gare di Doppio, Tris o Squadra.' });
        }

        // Verifica validità e unicità atleti
        const allPlayerIds = new Set<string>();
        for (let i = 0; i < squadre.length; i++) {
            const sq = squadre[i];
            if (!sq.nomeSquadra || sq.nomeSquadra.trim() === '') {
                return res.status(400).json({ message: `La Squadra ${i + 1} deve avere un nome valido.` });
            }
            if (!Array.isArray(sq.giocatoreIds) || sq.giocatoreIds.length !== requiredPerTeam) {
                return res.status(400).json({
                    message: `La squadra "${sq.nomeSquadra}" deve avere esattamente ${requiredPerTeam} atleti (attualmente ne ha ${sq.giocatoreIds?.length || 0}).`
                });
            }
            for (const pId of sq.giocatoreIds) {
                if (allPlayerIds.has(pId)) {
                    return res.status(400).json({
                        message: `L'atleta con ID ${pId} è stato inserito in più formazioni!`
                    });
                }
                allPlayerIds.add(pId);
            }
        }

        const costoQuota = Number(torneo.costoIscrizione || 0);

        // Eseguiamo la transazione atomica
        const result = await prisma.$transaction(async (tx) => {
            const createdSquadre = [];

            for (const sq of squadre) {
                // 1. Crea la SquadraTorneo
                const nuovaSquadra = await tx.squadraTorneo.create({
                    data: {
                        torneoId,
                        nomeSquadra: sq.nomeSquadra.trim()
                    }
                });

                // 2. Per ciascun atleta della squadra: addebito borsellino + iscrizione + stato ASSEGNATO
                for (const pId of sq.giocatoreIds) {
                    const giocatore = await tx.giocatore.findUnique({
                        where: { id: pId },
                        include: { saldo: true }
                    });

                    if (!giocatore) {
                        throw new Error(`Atleta con ID ${pId} non trovato.`);
                    }

                    // Se c'è una quota di iscrizione, addebitala
                    if (costoQuota > 0) {
                        const saldoAttuale = Number(giocatore.saldo?.saldoAttuale || 0);
                        if (saldoAttuale < costoQuota) {
                            throw new Error(`L'atleta ${giocatore.nome} ${giocatore.cognome} non ha saldo sufficiente (€${saldoAttuale.toFixed(2)} / €${costoQuota.toFixed(2)}).`);
                        }

                        // Scala dal saldo
                        await tx.saldoBorsellino.upsert({
                            where: { giocatoreId: pId },
                            create: {
                                giocatoreId: pId,
                                saldoAttuale: new Prisma.Decimal(-costoQuota)
                            },
                            update: {
                                saldoAttuale: { decrement: costoQuota }
                            }
                        });

                        // Registra movimento contabile
                        await tx.movimentoContabile.create({
                            data: {
                                giocatoreId: pId,
                                importo: new Prisma.Decimal(-costoQuota),
                                tipo: 'ISCRIZIONE_TORNEO',
                                descrizione: `Iscrizione ${torneo.nome} - Formazione Coach: ${sq.nomeSquadra.trim()}`,
                                adminId: adminOrCoachUserId || null
                            }
                        });
                    }

                    // Aggiorna disponibilità
                    await tx.disponibilitaTorneo.updateMany({
                        where: { torneoId, giocatoreId: pId },
                        data: { stato: 'ASSEGNATO' }
                    });

                    // Crea IscrizioneTorneo associata alla squadra (turnoId sarà scelto dalla squadra)
                    await tx.iscrizioneTorneo.upsert({
                        where: {
                            torneoId_giocatoreId: {
                                torneoId,
                                giocatoreId: pId
                            }
                        },
                        create: {
                            torneoId,
                            giocatoreId: pId,
                            squadraId: nuovaSquadra.id,
                            nomeSquadra: sq.nomeSquadra.trim(),
                            stato: 'CONFERMATA',
                            turnoId: null
                        },
                        update: {
                            squadraId: nuovaSquadra.id,
                            nomeSquadra: sq.nomeSquadra.trim(),
                            stato: 'CONFERMATA'
                        }
                    });
                }

                createdSquadre.push(nuovaSquadra);
            }

            // Se sono state specificate riserve
            if (Array.isArray(riserveIds) && riserveIds.length > 0) {
                await tx.disponibilitaTorneo.updateMany({
                    where: {
                        torneoId,
                        giocatoreId: { in: riserveIds }
                    },
                    data: { stato: 'RISERVA' }
                });
            }

            return createdSquadre;
        });

        res.status(201).json({
            message: `Squadre confermate e pubblicate con successo! Quote addebitate (${costoQuota.toFixed(2)}€ a testa).`,
            squadre: result
        });
    } catch (err: any) {
        console.error('Errore confermaSquadreCoach:', err);
        res.status(400).json({ message: err.message || 'Errore nella conferma delle squadre.' });
    }
};

// DELETE /api/coach/squadre/:squadraId (Coach o Admin annulla una squadra e rimborsa i giocatori)
export const annullaSquadraCoach = async (req: AuthRequest, res: Response) => {
    const squadraId = req.params.squadraId as string;
    const adminOrCoachUserId = req.user?.userId;

    try {
        const squadra = await prisma.squadraTorneo.findUnique({
            where: { id: squadraId },
            include: {
                torneo: true,
                iscrizioni: { include: { giocatore: true } }
            }
        });

        if (!squadra) {
            return res.status(404).json({ message: 'Squadra non trovata.' });
        }

        const costoQuota = Number(squadra.torneo.costoIscrizione || 0);

        await prisma.$transaction(async (tx) => {
            for (const iscr of squadra.iscrizioni) {
                // Rimborso quota se presente
                if (costoQuota > 0) {
                    await tx.saldoBorsellino.upsert({
                        where: { giocatoreId: iscr.giocatoreId },
                        create: {
                            giocatoreId: iscr.giocatoreId,
                            saldoAttuale: new Prisma.Decimal(costoQuota)
                        },
                        update: {
                            saldoAttuale: { increment: costoQuota }
                        }
                    });

                    await tx.movimentoContabile.create({
                        data: {
                            giocatoreId: iscr.giocatoreId,
                            importo: new Prisma.Decimal(costoQuota),
                            tipo: 'RIMBORSO',
                            descrizione: `Rimborso annullamento squadra ${squadra.nomeSquadra} - Torneo ${squadra.torneo.nome}`,
                            adminId: adminOrCoachUserId || null
                        }
                    });
                }

                // Reimposta disponibilità a IN_ATTESA
                await tx.disponibilitaTorneo.updateMany({
                    where: { torneoId: squadra.torneoId, giocatoreId: iscr.giocatoreId },
                    data: { stato: 'IN_ATTESA' }
                });

                // Elimina iscrizione
                await tx.iscrizioneTorneo.delete({
                    where: { id: iscr.id }
                });
            }

            // Elimina la squadra
            await tx.squadraTorneo.delete({
                where: { id: squadraId }
            });
        });

        res.json({ message: `Squadra "${squadra.nomeSquadra}" annullata con successo e quote rimborsate.` });
    } catch (err: any) {
        console.error('Errore annullaSquadraCoach:', err);
        res.status(500).json({ message: 'Errore nell\'annullamento della squadra.' });
    }
};

// -------------------------------------------------------------
// FASE 3: SCELTA TURNI DA PARTE DI UN MEMBRO DELLA SQUADRA
// -------------------------------------------------------------

// POST /api/tornei/squadre/:squadraId/scegli-turno
export const scegliTurnoSquadra = async (req: AuthRequest, res: Response) => {
    const squadraId = req.params.squadraId as string;
    const userId = req.user?.userId;
    const { turnoId, secondoTurnoId, sedeId } = req.body;

    if (!turnoId) {
        return res.status(400).json({ message: 'Seleziona un turno di gioco.' });
    }

    try {
        if (!userId) {
            return res.status(401).json({ message: 'Utente non autenticato' });
        }

        const squadra = await prisma.squadraTorneo.findUnique({
            where: { id: squadraId },
            include: {
                torneo: { include: { turni: true } },
                iscrizioni: { include: { giocatore: true } },
                confermataDa: true
            }
        });

        if (!squadra) {
            return res.status(404).json({ message: 'Squadra non trovata.' });
        }

        // Trova il giocatore associato all'utente loggato
        const giocatore = await prisma.giocatore.findUnique({
            where: { userId }
        });

        const isPrivileged = req.user?.role === 'ADMIN' || req.user?.role === 'COACH';
        const isTeamMember = giocatore && squadra.iscrizioni.some(i => i.giocatoreId === giocatore.id);

        if (!isPrivileged && !isTeamMember) {
            return res.status(403).json({
                message: 'Non fai parte di questa squadra e non hai i permessi per sceglierne i turni.'
            });
        }

        // REGOLA 1 UTENTE: Se un membro della squadra ha già confermato i turni, nessun altro della formazione può cambiare
        if (squadra.turnoId && !isPrivileged) {
            const chiHaScelto = squadra.confermataDa
                ? `${squadra.confermataDa.nome} ${squadra.confermataDa.cognome}`
                : 'un altro componente della tua squadra';
            return res.status(400).json({
                message: `I turni per la squadra "${squadra.nomeSquadra}" sono già stati confermati da ${chiHaScelto}. Nessun altro componente può modificarli. Contatta il Coach o l'Admin per variazioni.`
            });
        }

        // Verifica validità turno principale
        const turno = await prisma.giorniOrariTorneo.findUnique({
            where: { id: turnoId }
        });

        if (!turno || turno.torneoId !== squadra.torneoId) {
            return res.status(400).json({ message: 'Il turno selezionato non è valido per questo torneo.' });
        }

        // Verifica disponibilità posti nel turno principale
        const occupati = await prisma.iscrizioneTorneo.count({
            where: {
                turnoId,
                squadraId: { not: squadraId } // Escludiamo i membri di questa squadra se già presenti
            }
        });

        const postiNecessari = squadra.iscrizioni.length;
        const postiRimanenti = turno.postiDisponibili - occupati;

        if (postiRimanenti < postiNecessari) {
            return res.status(400).json({
                message: `Posti insufficienti nel turno selezionato (${postiRimanenti} posti liberi, necessari ${postiNecessari} per la squadra).`
            });
        }

        // Verifica turno di riserva se inserito
        if (secondoTurnoId && secondoTurnoId === turnoId) {
            return res.status(400).json({ message: 'Il turno di riserva deve essere diverso dal turno principale.' });
        }

        // Aggiornamento atomico di squadra e di tutte le iscrizioni dei singoli componenti
        await prisma.$transaction(async (tx) => {
            // Aggiorna SquadraTorneo
            await tx.squadraTorneo.update({
                where: { id: squadraId },
                data: {
                    turnoId,
                    secondoTurnoId: secondoTurnoId || null,
                    sedeId: sedeId || turno.sedeId || null,
                    confermataDaId: giocatore ? giocatore.id : null,
                    confermatoIl: new Date()
                }
            });

            // Aggiorna tutte le iscrizioni individuali collegate
            await tx.iscrizioneTorneo.updateMany({
                where: { squadraId },
                data: {
                    turnoId,
                    secondoTurnoId: secondoTurnoId || null,
                    sedeId: sedeId || turno.sedeId || null,
                    stato: 'CONFERMATA'
                }
            });
        });

        const updated = await prisma.squadraTorneo.findUnique({
            where: { id: squadraId },
            include: {
                turno: { include: { sede: true } },
                secondoTurno: { include: { sede: true } },
                sede: true,
                confermataDa: true,
                iscrizioni: { include: { giocatore: true } }
            }
        });

        res.json({
            message: 'Turni assegnati con successo alla squadra!',
            squadra: updated
        });
    } catch (err: any) {
        console.error('Errore scegliTurnoSquadra:', err);
        res.status(500).json({ message: err.message || 'Errore nella selezione dei turni.' });
    }
};

// GET /api/tornei/:id/mie-squadre (Verifica se l'utente loggato ha squadre o disponibilità in questo torneo)
export const getMieSquadreTorneo = async (req: AuthRequest, res: Response) => {
    const torneoId = req.params.id as string;
    const userId = req.user?.userId;

    try {
        if (!userId) {
            return res.status(401).json({ message: 'Non autenticato' });
        }

        const giocatore = await prisma.giocatore.findUnique({
            where: { userId },
            include: { saldo: true }
        });

        if (!giocatore) {
            return res.json({ giocatore: null, disponibilita: null, squadra: null });
        }

        // Cerca disponibilità
        const disponibilita = await prisma.disponibilitaTorneo.findUnique({
            where: {
                torneoId_giocatoreId: {
                    torneoId,
                    giocatoreId: giocatore.id
                }
            }
        });

        // Cerca squadra assegnata
        const iscrizione = await prisma.iscrizioneTorneo.findUnique({
            where: {
                torneoId_giocatoreId: {
                    torneoId,
                    giocatoreId: giocatore.id
                }
            },
            include: {
                squadra: {
                    include: {
                        turno: { include: { sede: true } },
                        secondoTurno: { include: { sede: true } },
                        sede: true,
                        confermataDa: {
                            select: { id: true, nome: true, cognome: true }
                        },
                        iscrizioni: {
                            include: {
                                giocatore: {
                                    select: {
                                        id: true,
                                        nome: true,
                                        cognome: true,
                                        categoria: true,
                                        mediaAttuale: true,
                                        sesso: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        res.json({
            giocatore: {
                id: giocatore.id,
                nome: giocatore.nome,
                cognome: giocatore.cognome,
                categoria: giocatore.categoria,
                certificatoMedicoScadenza: giocatore.certificatoMedicoScadenza,
                saldoAttuale: Number(giocatore.saldo?.saldoAttuale || 0)
            },
            disponibilita,
            squadra: iscrizione?.squadra || null,
            iscrizione: iscrizione || null
        });
    } catch (err) {
        console.error('Errore getMieSquadreTorneo:', err);
        res.status(500).json({ message: 'Errore nel recupero dati atleta.' });
    }
};
