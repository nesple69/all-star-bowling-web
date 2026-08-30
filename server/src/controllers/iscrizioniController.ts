import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// GET /api/tornei/lookup-tessera/:tessera (Pubblico / Autenticato - Lookup giocatore per tessera)
export const lookupTessera = async (req: Request, res: Response) => {
    const tessera = req.params.tessera as string;
    const authReq = req as AuthRequest;
    const currentUser = authReq.user;

    try {
        const giocatore = await prisma.giocatore.findFirst({
            where: { numeroTessera: { equals: tessera, mode: 'insensitive' } },
            select: {
                id: true,
                nome: true,
                cognome: true,
                categoria: true,
                sesso: true,
                telefono: true,
                certificatoMedicoScadenza: true,
                attivo: true,
                userId: true,
                saldo: { select: { saldoAttuale: true } },
                iscrizioni: {
                    select: { torneoId: true, turnoId: true, stato: true }
                }
            }
        });

        if (!giocatore) {
            return res.status(404).json({ message: 'Numero tessera non trovato. Verifica e riprova.' });
        }

        const isAuthorized = currentUser?.role === 'ADMIN' || (currentUser && currentUser.userId === giocatore.userId);

        const isCertificatoValido = giocatore.certificatoMedicoScadenza
            ? new Date(giocatore.certificatoMedicoScadenza) >= new Date()
            : false;

        // Ritorna i dati necessari per l'iscrizione al torneo e verifica borsellino
        res.json({
            id: giocatore.id,
            nome: giocatore.nome,
            cognome: giocatore.cognome,
            categoria: giocatore.categoria,
            sesso: giocatore.sesso,
            attivo: giocatore.attivo,
            certificatoValido: isCertificatoValido,
            telefono: isAuthorized ? giocatore.telefono : undefined,
            certificatoMedicoScadenza: giocatore.certificatoMedicoScadenza,
            saldo: giocatore.saldo ? { saldoAttuale: Number(giocatore.saldo.saldoAttuale) } : { saldoAttuale: 0 },
            iscrizioni: isAuthorized ? giocatore.iscrizioni : []
        });
    } catch (err) {
        console.error('Errore lookup tessera:', err);
        res.status(500).json({ message: 'Errore nel recupero dati giocatore.' });
    }
};

// GET /api/tornei/:id/iscrizioni (Admin - Lista iscritti con dettagli)
export const getIscrizioniTorneo = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const torneoInfo = await prisma.torneo.findUnique({
            where: { id },
            include: { sedi: true }
        });

        const iscrizioni = await prisma.iscrizioneTorneo.findMany({
            where: { torneoId: id },
            include: {
                giocatore: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        telefono: true,
                        sesso: true,
                        categoria: true,
                        saldo: { select: { saldoAttuale: true } }
                    }
                },
                turno: {
                    select: {
                        id: true,
                        giorno: true,
                        orarioInizio: true,
                        postiDisponibili: true,
                        sede: { select: { id: true, nome: true } }
                    }
                },
                torneo: {
                    select: {
                        sede: true
                    }
                },
                secondoTurno: {
                    select: {
                        id: true,
                        giorno: true,
                        orarioInizio: true
                    }
                },
                sede: {
                    select: { id: true, nome: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const mappedIscrizioni = iscrizioni.map(iscr => {
            if (iscr.sede) return iscr;
            if ((iscr.turno as any)?.sede) {
                return { ...iscr, sede: (iscr.turno as any).sede };
            }
            const torneoSedeDefault = torneoInfo?.sede
                ? { nome: torneoInfo.sede }
                : (torneoInfo?.sedi && torneoInfo.sedi.length === 1 ? torneoInfo.sedi[0] : null);

            return {
                ...iscr,
                sede: torneoSedeDefault
            };
        });

        res.json(mappedIscrizioni);
    } catch (err) {
        console.error('Errore nel recupero iscrizioni:', err);
        res.status(500).json({ message: 'Errore nel recupero iscrizioni.' });
    }
};

// GET /api/tornei/public/:id/iscritti (Pubblico - Lista iscritti limitata in sola lettura)
export const getIscrizioniPublic = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const torneoInfo = await prisma.torneo.findUnique({
            where: { id },
            include: { sedi: true }
        });

        const iscrizioni = await prisma.iscrizioneTorneo.findMany({
            where: {
                torneoId: id,
                NOT: { stato: 'RIFIUTATA' }
            },
            include: {
                giocatore: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        sesso: true,
                        categoria: true
                    }
                },
                turno: {
                    select: {
                        id: true,
                        giorno: true,
                        orarioInizio: true,
                        sede: { select: { id: true, nome: true } }
                    }
                },
                secondoTurno: {
                    select: {
                        id: true,
                        giorno: true,
                        orarioInizio: true
                    }
                },
                sede: {
                    select: { id: true, nome: true }
                }
            }
        });

        const ordinati = iscrizioni.sort((a, b) => {
            const dateA = new Date(a.turno?.orarioInizio || 0).getTime();
            const dateB = new Date(b.turno?.orarioInizio || 0).getTime();
            return dateA - dateB;
        });

        const mappedIscrizioni = ordinati.map(iscr => {
            const torneoSedeDefault = torneoInfo?.sede
                ? { nome: torneoInfo.sede }
                : (torneoInfo?.sedi && torneoInfo.sedi.length === 1 ? torneoInfo.sedi[0] : null);

            return {
                id: iscr.id,
                giocatore: iscr.giocatore,
                turno: iscr.turno,
                secondoTurno: iscr.secondoTurno,
                sede: iscr.sede || (iscr.turno as any)?.sede || torneoSedeDefault,
                gruppoId: iscr.gruppoId,
                nomeSquadra: iscr.nomeSquadra,
                isRiserva: iscr.isRiserva,
                stato: iscr.stato
            };
        });

        res.json(mappedIscrizioni);
    } catch (err) {
        console.error('Errore nel recupero iscrizioni pubbliche:', err);
        res.status(500).json({ message: 'Errore nel recupero iscritti.' });
    }
};

// GET /api/tornei/:id/disponibilita (Pubblico - Posti rimanenti per turno)
export const getDisponibilitaTurni = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const turni = await prisma.giorniOrariTorneo.findMany({
            where: { torneoId: id },
            include: {
                sede: true,
                _count: {
                    select: { iscrizioni: true }
                }
            }
        });

        const disponibilita = turni.map(t => ({
            id: t.id,
            giorno: t.giorno,
            orarioInizio: t.orarioInizio,
            postiTotali: t.postiDisponibili,
            postiOccupati: (t as any)._count?.iscrizioni || 0,
            postiRimanenti: t.postiDisponibili - ((t as any)._count?.iscrizioni || 0),
            sede: t.sede
        }));

        res.json(disponibilita);
    } catch (err) {
        res.status(500).json({ message: 'Errore nel recupero disponibilità.' });
    }
};

// POST /api/tornei/iscriviti (Giocatore / Formazione - Iscrizione con Borsellino)
export const iscriviGiocatore = async (req: any, res: Response) => {
    const { torneoId, turnoId, giocatoreId, atleti, nomeSquadra, secondoTurnoId, sedeId } = req.body;
    const isAdmin = req.user?.role === 'ADMIN';

    try {
        const torneo = await prisma.torneo.findUnique({
            where: { id: torneoId },
            include: { turni: true, sedi: true }
        });

        if (!torneo) return res.status(404).json({ message: 'Torneo non trovato.' });

        // Normalizza lista atleti
        let atletiInput: { giocatoreId: string; isRiserva?: boolean }[] = [];
        if (Array.isArray(atleti) && atleti.length > 0) {
            atletiInput = atleti.filter(a => a && a.giocatoreId && typeof a.giocatoreId === 'string' && a.giocatoreId.trim() !== '');
        } else if (giocatoreId) {
            atletiInput = [{ giocatoreId, isRiserva: false }];
        }

        const titolari = atletiInput.filter(a => !a.isRiserva);
        const riserve = atletiInput.filter(a => !!a.isRiserva);

        // Determinazione atleti obbligatori in base alla tipologia torneo
        let requiredTitolari = 1;
        let maxRiserve = 0;
        switch (torneo.tipologia) {
            case 'SINGOLO':
                requiredTitolari = 1;
                maxRiserve = 0;
                break;
            case 'DOPPIO':
                requiredTitolari = 2;
                maxRiserve = 0;
                break;
            case 'TRIS':
                requiredTitolari = 3;
                maxRiserve = 1;
                break;
            case 'SQUADRA_4':
                requiredTitolari = 4;
                maxRiserve = 1;
                break;
            default:
                requiredTitolari = 1;
                break;
        }

        // Controllo completezza dati obbligatori
        if (titolari.length < requiredTitolari) {
            return res.status(400).json({ message: 'inserisci tutti i dati necessari' });
        }

        if (riserve.length > maxRiserve) {
            return res.status(400).json({ message: `Puoi inserire al massimo ${maxRiserve} riserva per questo torneo.` });
        }

        // Verifica unicità atleti inseriti
        const allIds = atletiInput.map(a => a.giocatoreId);
        if (new Set(allIds).size !== allIds.length) {
            return res.status(400).json({ message: 'Lo stesso atleta non può essere inserito più volte.' });
        }

        // Recupera dati atleti dal database
        const giocatori = await prisma.giocatore.findMany({
            where: { id: { in: allIds } },
            include: { saldo: true }
        });

        if (giocatori.length !== allIds.length) {
            return res.status(404).json({ message: 'Uno o più atleti non sono stati trovati nel database.' });
        }

        // Validazione Certificato Medico per ciascun atleta
        const oggi = new Date();
        for (const g of giocatori) {
            if (g.certificatoMedicoScadenza) {
                const scadenza = new Date(g.certificatoMedicoScadenza);
                if (scadenza < oggi && !isAdmin) {
                    return res.status(400).json({
                        message: `Certificato medico scaduto per ${g.nome} ${g.cognome}. Aggiorna il certificato prima di partecipare a gare agonistiche.`
                    });
                }
            }
        }

        const turno = await prisma.giorniOrariTorneo.findUnique({
            where: { id: turnoId },
            include: {
                _count: { select: { iscrizioni: true } }
            }
        });

        if (!turno) return res.status(404).json({ message: 'Turno non trovato.' });

        // Validazione Seconda Scelta
        const numTurni = torneo.turni.length;
        if (numTurni > 1 && !secondoTurnoId) {
            return res.status(400).json({ message: 'Scegli anche un turno di riserva nel caso la prima scelta non fosse disponibile.' });
        }

        if (secondoTurnoId && secondoTurnoId === turnoId) {
            return res.status(400).json({ message: 'Il turno di riserva deve essere diverso dalla prima scelta.' });
        }

        if (secondoTurnoId) {
            const extraTurno = torneo.turni.find(t => t.id === secondoTurnoId);
            if (!extraTurno) return res.status(400).json({ message: 'Turno di riserva non valido per questo torneo.' });
        }

        // Auto-assegnazione sede
        let autoSedeId = sedeId;
        if (!autoSedeId && torneo.sedi.length > 0) {
            if (torneo.sedi.length === 1) {
                autoSedeId = torneo.sedi[0].id;
            } else {
                const g0 = giocatori[0];
                const fullCat = `${g0.sesso}/${g0.categoria}`;
                const targetSede = torneo.sedi.find(s => 
                    s.categorie.includes(fullCat) || 
                    s.categorie.includes(g0.categoria)
                );
                if (targetSede) autoSedeId = targetSede.id;
            }
        }

        const costo = Math.abs(Number((torneo as any).costoIscrizione || 0));

        const risultato = await prisma.$transaction(async (tx) => {
            // Verifica duplicati atomica per tutti gli atleti
            for (const g of giocatori) {
                const esistente = await tx.iscrizioneTorneo.findFirst({
                    where: { torneoId, giocatoreId: g.id }
                });
                if (esistente) {
                    throw new Error(`${g.nome} ${g.cognome} è già iscritto a questo torneo.`);
                }
            }

            // Verifica disponibilità posti atomica
            const occupati = await tx.iscrizioneTorneo.count({
                where: { turnoId }
            });
            if (occupati + titolari.length > turno.postiDisponibili) {
                throw new Error('Posti insufficienti nel turno selezionato.');
            }

            // Controllo e aggiornamento borsellino per ciascun atleta titolare
            if (costo > 0) {
                for (const g of giocatori) {
                    const isRiservaAthlete = atletiInput.find(a => a.giocatoreId === g.id)?.isRiserva;
                    if (isRiservaAthlete) continue;

                    const saldo = await tx.saldoBorsellino.findUnique({ where: { giocatoreId: g.id } });
                    const saldoAttualeNum = Number(saldo?.saldoAttuale || 0);

                    if (!isAdmin && saldoAttualeNum < costo) {
                        throw new Error(`Saldo insufficiente nel borsellino di ${g.nome} ${g.cognome} (Saldo: €${saldoAttualeNum.toFixed(2)}, Costo: €${costo.toFixed(2)}).`);
                    }

                    await tx.saldoBorsellino.upsert({
                        where: { giocatoreId: g.id },
                        create: {
                            giocatoreId: g.id,
                            saldoAttuale: -costo
                        },
                        update: {
                            saldoAttuale: { decrement: costo }
                        }
                    });

                    await tx.movimentoContabile.create({
                        data: {
                            giocatoreId: g.id,
                            importo: costo,
                            tipo: 'ISCRIZIONE_TORNEO',
                            descrizione: `Iscrizione torneo: ${torneo.nome}`
                        }
                    });
                }
            }

            const gruppoId = (torneo.tipologia !== 'SINGOLO' || atletiInput.length > 1) 
                ? (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).substring(2)) 
                : null;

            // Creazione iscrizioni
            const created = [];
            for (const a of atletiInput) {
                const iscr = await tx.iscrizioneTorneo.create({
                    data: {
                        torneoId,
                        giocatoreId: a.giocatoreId,
                        turnoId,
                        secondoTurnoId: secondoTurnoId || null,
                        sedeId: autoSedeId || (turno as any).sedeId || null,
                        gruppoId,
                        nomeSquadra: nomeSquadra?.trim() || null,
                        isRiserva: !!a.isRiserva,
                        stato: 'PENDENTE'
                    }
                });
                created.push(iscr);
            }

            return created;
        });

        res.json({ message: 'Iscrizione inviata con successo!', iscrizioni: risultato });
    } catch (err: any) {
        res.status(400).json({ message: err.message || 'Errore durante l\'iscrizione.' });
    }
};

// PATCH /api/tornei/iscrizioni/:id/stato (Admin - Accetta/Rifiuta)
export const updateStatoIscrizione = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { stato, note } = req.body;

    if (!['CONFERMATA', 'RIFIUTATA', 'PENDENTE'].includes(stato)) {
        return res.status(400).json({ message: 'Stato non valido.' });
    }

    try {
        const iscrizione = await prisma.iscrizioneTorneo.findUnique({
            where: { id },
            include: {
                torneo: true,
                giocatore: { select: { id: true, nome: true, cognome: true, telefono: true } }
            }
        }) as any;

        if (!iscrizione) return res.status(404).json({ message: 'Iscrizione non trovata.' });

        // Se RIFIUTATA → rimborso automatico
        if (stato === 'RIFIUTATA' && iscrizione.stato !== 'RIFIUTATA') {
            const costo = Number((iscrizione.torneo as any).costoIscrizione || 0);

            await prisma.$transaction(async (tx) => {
                if (costo > 0) {
                    await tx.saldoBorsellino.update({
                        where: { giocatoreId: iscrizione.giocatoreId },
                        data: { saldoAttuale: { increment: costo } }
                    });

                    await tx.movimentoContabile.create({
                        data: {
                            giocatoreId: iscrizione.giocatoreId,
                            importo: costo,
                            tipo: 'RICARICA',
                            descrizione: `Rimborso iscrizione rifiutata: ${iscrizione.torneo.nome}`
                        }
                    });
                }

                await tx.iscrizioneTorneo.update({
                    where: { id: id as string },
                    data: { stato, note: note || null }
                });
            });
        } else {
            await prisma.iscrizioneTorneo.update({
                where: { id: id as string },
                data: { stato, note: note || null }
            });
        }

        res.json({
            message: `Iscrizione ${stato.toLowerCase()}.`,
            giocatore: iscrizione.giocatore
        });
    } catch (err) {
        console.error('Errore aggiornamento stato iscrizione:', err);
        res.status(500).json({ message: 'Errore nell\'aggiornamento dello stato.' });
    }
};

// PUT /api/tornei/iscrizioni/:id (Admin - Modifica turno)
export const modificaIscrizione = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { turnoId, note } = req.body;

    try {
        const iscrizione = await prisma.iscrizioneTorneo.findUnique({
            where: { id },
            include: {
                torneo: true,
                giocatore: { select: { id: true, nome: true, cognome: true, telefono: true } }
            }
        }) as any;

        if (!iscrizione) return res.status(404).json({ message: 'Iscrizione non trovata.' });

        // Verifica che il nuovo turno appartenga allo stesso torneo
        const nuovoTurno = await prisma.giorniOrariTorneo.findUnique({
            where: { id: turnoId },
            include: {
                _count: { select: { iscrizioni: true } }
            }
        });

        if (!nuovoTurno || nuovoTurno.torneoId !== iscrizione.torneoId) {
            return res.status(400).json({ message: 'Turno non valido per questo torneo.' });
        }

        // Verifica disponibilità
        const occupati = (nuovoTurno as any)._count?.iscrizioni || 0;
        if (occupati >= nuovoTurno.postiDisponibili) {
            return res.status(400).json({ message: 'Il turno selezionato è esaurito.' });
        }

        await prisma.iscrizioneTorneo.update({
            where: { id: id as string },
            data: {
                turnoId,
                stato: 'MODIFICATA',
                note: note || `Turno modificato dall'amministratore`
            }
        });

        res.json({
            message: 'Iscrizione modificata con successo.',
            giocatore: iscrizione.giocatore
        });
    } catch (err) {
        console.error('Errore modifica iscrizione:', err);
        res.status(500).json({ message: 'Errore nella modifica dell\'iscrizione.' });
    }
};

// DELETE /api/tornei/iscrizioni/:id (Admin - Cancella e Rimborsa)
export const cancellaIscrizione = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        const iscrizione = await prisma.iscrizioneTorneo.findUnique({
            where: { id },
            include: { torneo: true }
        }) as any;

        if (!iscrizione) return res.status(404).json({ message: 'Iscrizione non trovata.' });

        const costo = Number((iscrizione.torneo as any).costoIscrizione || 0);

        await prisma.$transaction(async (tx) => {
            if (costo > 0) {
                await tx.saldoBorsellino.update({
                    where: { giocatoreId: iscrizione.giocatoreId },
                    data: { saldoAttuale: { increment: costo } }
                });

                await tx.movimentoContabile.create({
                    data: {
                        giocatoreId: iscrizione.giocatoreId,
                        importo: costo,
                        tipo: 'RICARICA',
                        descrizione: `Rimborso iscrizione: ${iscrizione.torneo.nome}`
                    }
                });
            }

            await tx.iscrizioneTorneo.delete({ where: { id } });
        });

        res.json({ message: 'Iscrizione cancellata e quota rimborsata.' });
    } catch (err) {
        res.status(500).json({ message: 'Errore durante la cancellazione.' });
    }
};
