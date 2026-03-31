import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/tornei/lookup-tessera/:tessera (Pubblico - Lookup giocatore per tessera)
export const lookupTessera = async (req: Request, res: Response) => {
    const tessera = req.params.tessera as string;
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
                saldo: { select: { saldoAttuale: true } },
                iscrizioni: {
                    select: { torneoId: true, turnoId: true, stato: true }
                }
            }
        });

        if (!giocatore) {
            return res.status(404).json({ message: 'Numero tessera non trovato. Verifica e riprova.' });
        }

        res.json(giocatore);
    } catch (err) {
        console.error('Errore lookup tessera:', err);
        res.status(500).json({ message: 'Errore nel recupero dati giocatore.' });
    }
};

// GET /api/tornei/:id/iscrizioni (Admin - Lista iscritti con dettagli)
export const getIscrizioniTorneo = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        // --- AUTO-UNIFICAZIONE (Self-Healing) ---
        const allTurni = await prisma.giorniOrariTorneo.findMany({
            where: { torneoId: id },
            orderBy: { orarioInizio: 'asc' }
        });

        const groups: Record<string, any[]> = {};
        allTurni.forEach(t => {
            const dateStr = t.giorno.toISOString().split('T')[0];
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });

        for (const dateStr in groups) {
            const group = groups[dateStr];
            if (group.length > 1) {
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
                    await prisma.giorniOrariTorneo.delete({ where: { id: r.id } }).catch(() => {});
                }
            }
        }
        // --- AUTO-ASSEGNAZIONE SEDE (Self-Healing) ---
        // Se il torneo ha una sola sede e ci sono iscrizioni o turni senza sede, assegnamola.
        const torneoInfo = await prisma.torneo.findUnique({
            where: { id },
            include: { sedi: true }
        });

        if (torneoInfo && torneoInfo.sedi.length === 1) {
            const singleSedeId = torneoInfo.sedi[0].id;
            await prisma.giorniOrariTorneo.updateMany({
                where: { torneoId: id, sedeId: null },
                data: { sedeId: singleSedeId }
            });
            await prisma.iscrizioneTorneo.updateMany({
                where: { torneoId: id, sedeId: null },
                data: { sedeId: singleSedeId }
            });
        }
        // --- FINE AUTO-ASSEGNAZIONE SEDE ---

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
                        orarioFine: true,
                        postiDisponibili: true
                    }
                },
                secondoTurno: {
                    select: {
                        id: true,
                        giorno: true,
                        orarioInizio: true,
                        orarioFine: true
                    }
                },
                sede: {
                    select: { id: true, nome: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(iscrizioni);
    } catch (err) {
        console.error('Errore nel recupero iscrizioni:', err);
        res.status(500).json({ message: 'Errore nel recupero iscrizioni.' });
    }
};

// GET /api/tornei/public/:id/iscritti (Pubblico - Lista iscritti limitata)
export const getIscrizioniPublic = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        // --- AUTO-UNIFICAZIONE (Self-Healing) ---
        // Identifichiamo i turni dello stesso giorno e torneo con orari diversi
        const allTurni = await prisma.giorniOrariTorneo.findMany({
            where: { torneoId: id },
            orderBy: { orarioInizio: 'asc' }
        });

        const groups: Record<string, any[]> = {};
        allTurni.forEach(t => {
            const dateStr = t.giorno.toISOString().split('T')[0];
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });

        for (const dateStr in groups) {
            const group = groups[dateStr];
            if (group.length > 1) {
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
                    await prisma.giorniOrariTorneo.delete({ where: { id: r.id } }).catch(() => {});
                }
            }
        }

        // --- AUTO-ASSEGNAZIONE SEDE (Self-Healing) ---
        const torneoInfo = await prisma.torneo.findUnique({
            where: { id },
            include: { sedi: true }
        });

        if (torneoInfo && torneoInfo.sedi.length === 1) {
            const singleSedeId = torneoInfo.sedi[0].id;
            await prisma.giorniOrariTorneo.updateMany({
                where: { torneoId: id, sedeId: null },
                data: { sedeId: singleSedeId }
            });
            await prisma.iscrizioneTorneo.updateMany({
                where: { torneoId: id, sedeId: null },
                data: { sedeId: singleSedeId }
            });
        }
        // --- FINE AUTO-ASSEGNAZIONE SEDE ---

        const iscrizioni = await prisma.iscrizioneTorneo.findMany({
            where: {
                torneoId: id,
                NOT: { stato: 'RIFIUTATA' }
            },
            include: {
                giocatore: {
                    select: {
                        nome: true,
                        cognome: true,
                        sesso: true,
                        categoria: true
                    }
                },
                turno: {
                    select: {
                        giorno: true,
                        orarioInizio: true
                    }
                },
                secondoTurno: {
                    select: {
                        giorno: true,
                        orarioInizio: true
                    }
                }
            }
        });

        // Ordinamento lato JS per data del turno (dal più lontano al più vicino)
        const ordinati = iscrizioni.sort((a, b) => {
            const dateA = new Date(a.turno.orarioInizio).getTime();
            const dateB = new Date(b.turno.orarioInizio).getTime();
            return dateB - dateA; // Dal più lontano al più vicino
        });

        res.json(ordinati);
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
            orarioFine: t.orarioFine || null,
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

// POST /api/tornei/iscriviti (Giocatore - Iscrizione con Borsellino)
export const iscriviGiocatore = async (req: any, res: Response) => {
    const { torneoId, turnoId, giocatoreId, secondoTurnoId, sedeId } = req.body;
    const isAdmin = req.user?.role === 'ADMIN';

    try {
        const torneo = await prisma.torneo.findUnique({
            where: { id: torneoId },
            include: { turni: true }
        });

        const giocatore = await prisma.giocatore.findUnique({
            where: { id: giocatoreId }
        });

        if (!giocatore) return res.status(404).json({ message: 'Giocatore non trovato.' });

        // Validazione Certificato Medico
        if (giocatore.certificatoMedicoScadenza) {
            const oggi = new Date();
            const scadenza = new Date(giocatore.certificatoMedicoScadenza);

            if (scadenza < oggi) {
                return res.status(400).json({
                    message: 'aggiorna il tuo certificato medico prima di partecipare a gare agonistiche, grazie'
                });
            }
        }

        const turno = await prisma.giorniOrariTorneo.findUnique({
            where: { id: turnoId },
            include: {
                _count: { select: { iscrizioni: true } }
            }
        });

        if (!torneo || !turno) return res.status(404).json({ message: 'Torneo o Turno non trovato.' });

        // Validazione Seconda Scelta
        const numTurni = torneo.turni.length;
        if (numTurni > 1 && !secondoTurnoId) {
            return res.status(400).json({ message: 'Scegli anche una turno di riserva nel caso la tua prima scelta non fosse disponibile.' });
        }

        if (secondoTurnoId && secondoTurnoId === turnoId) {
            return res.status(400).json({ message: 'Il turno di riserva deve essere diverso dalla prima scelta.' });
        }

        if (secondoTurnoId) {
            const extraTurno = torneo.turni.find(t => t.id === secondoTurnoId);
            if (!extraTurno) return res.status(400).json({ message: 'Turno di riserva non valido per questo torneo.' });
        }

        // Già iscritto?
        const esistente = await prisma.iscrizioneTorneo.findFirst({
            where: { torneoId, giocatoreId }
        });
        if (esistente) return res.status(400).json({ message: 'Sei già iscritto a questo torneo.' });

        // Posti disponibili?
        const occupati = (turno as any)._count?.iscrizioni || 0;
        if (occupati >= turno.postiDisponibili) {
            return res.status(400).json({ message: 'Turno esaurito.' });
        }

        const costo = Number((torneo as any).costoIscrizione || 0);

        const risultato = await prisma.$transaction(async (tx) => {
            if (costo > 0) {
                const saldo = await tx.saldoBorsellino.findUnique({ where: { giocatoreId } });
                
                // Se non è admin, controlla se il saldo è sufficiente
                if (!isAdmin && (!saldo || Number(saldo.saldoAttuale) < costo)) {
                    throw new Error('Saldo insufficiente nel borsellino.');
                }

                await tx.saldoBorsellino.update({
                    where: { giocatoreId },
                    data: { saldoAttuale: { decrement: costo } }
                });

                await tx.movimentoContabile.create({
                    data: {
                        giocatoreId,
                        importo: -costo,
                        tipo: 'ISCRIZIONE_TORNEO',
                        descrizione: `Iscrizione torneo: ${torneo.nome}`
                    }
                });
            }

            return await tx.iscrizioneTorneo.create({
                data: {
                    torneoId,
                    giocatoreId,
                    turnoId,
                    secondoTurnoId: secondoTurnoId || null,
                    sedeId: sedeId || (turno as any).sedeId || null,
                    stato: 'PENDENTE'
                }
            });
        });

        res.json({ message: 'Iscrizione inviata! In attesa di conferma.', iscrizione: risultato });
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
