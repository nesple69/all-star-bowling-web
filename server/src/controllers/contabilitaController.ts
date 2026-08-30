import { Request, Response } from 'express';
import { TipoMovimento, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getBorsellinoGiocatore = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const authReq = req as AuthRequest;
    const currentUser = authReq.user;
    const soloAttiva = req.query.soloAttiva === 'true' || req.query.soloAttiva === '1';
    const { dataInizio, dataFine, limit } = req.query;

    try {
        const giocatore = await prisma.giocatore.findUnique({
            where: { id },
            select: { id: true, userId: true }
        });

        if (!giocatore) {
            return res.status(404).json({ message: 'Giocatore non trovato' });
        }

        // BOLA / IDOR check: consentito solo a chi possiede il profilo o ad un ADMIN
        if (currentUser?.role !== 'ADMIN' && currentUser?.userId !== giocatore.userId) {
            return res.status(403).json({ message: 'Accesso negato all\'estratto conto del giocatore' });
        }

        const saldo = await prisma.saldoBorsellino.findUnique({
            where: { giocatoreId: id }
        });

        let whereClause: any = { giocatoreId: id };

        if (dataInizio || dataFine) {
            whereClause.data = {};
            if (dataInizio) {
                whereClause.data.gte = new Date(dataInizio as string);
            }
            if (dataFine) {
                const fine = new Date(dataFine as string);
                fine.setHours(23, 59, 59, 999);
                whereClause.data.lte = fine;
            }
        } else if (soloAttiva) {
            const stagioneAttiva = await prisma.stagione.findFirst({
                where: { attiva: true }
            });
            if (stagioneAttiva) {
                whereClause.data = {
                    gte: stagioneAttiva.dataInizio,
                    lte: stagioneAttiva.dataFine
                };
            }
        }

        const takeLimit = limit === 'all' || limit === '0' ? undefined : (limit ? parseInt(limit as string, 10) : undefined);

        const movimenti = await prisma.movimentoContabile.findMany({
            where: whereClause,
            orderBy: { data: 'desc' },
            take: takeLimit
        });

        res.json({
            saldo: saldo ? Number(saldo.saldoAttuale) : 0,
            movimenti
        });
    } catch (error) {
        console.error('Errore recupero borsellino:', error);
        res.status(500).json({ message: 'Errore nel recupero dei dati del borsellino' });
    }
};

// POST /api/contabilita/ricarica
export const ricaricaBorsellino = async (req: Request, res: Response) => {
    const { giocatoreId, importo, descrizione, data: customData } = req.body;
    const adminId = (req as AuthRequest).user?.userId;

    const parsedImporto = Math.abs(parseFloat(importo));
    if (!parsedImporto || isNaN(parsedImporto) || parsedImporto <= 0) {
        return res.status(400).json({ message: 'L\'importo della ricarica deve essere positivo' });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crea il movimento
            const movimento = await tx.movimentoContabile.create({
                data: {
                    giocatoreId,
                    importo: parsedImporto,
                    tipo: TipoMovimento.RICARICA,
                    descrizione: descrizione || 'Ricarica manuale admin',
                    adminId,
                    data: customData ? new Date(customData) : undefined
                }
            });

            // 2. Aggiorna il saldo
            const saldo = await tx.saldoBorsellino.upsert({
                where: { giocatoreId },
                update: {
                    saldoAttuale: { increment: parsedImporto }
                },
                create: {
                    giocatoreId,
                    saldoAttuale: parsedImporto
                }
            });

            return { movimento, saldo };
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Errore ricarica:', error);
        res.status(500).json({ message: 'Errore durante la ricarica del borsellino' });
    }
};

// POST /api/contabilita/addebito
export const addebitoManuale = async (req: Request, res: Response) => {
    const { giocatoreId, importo, descrizione, data: customData } = req.body;
    const adminId = (req as AuthRequest).user?.userId;

    const parsedImporto = Math.abs(parseFloat(importo));
    if (!parsedImporto || isNaN(parsedImporto) || parsedImporto <= 0) {
        return res.status(400).json({ message: 'L\'importo dell\'addebito deve essere positivo' });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crea il movimento con importo positivo (il tipo determina la detrazione)
            const movimento = await tx.movimentoContabile.create({
                data: {
                    giocatoreId,
                    importo: parsedImporto,
                    tipo: TipoMovimento.ADDEBITO_MANUALE,
                    descrizione: descrizione || 'Addebito manuale admin',
                    adminId,
                    data: customData ? new Date(customData) : undefined
                }
            });

            // 2. Aggiorna il saldo (decremento)
            const saldo = await tx.saldoBorsellino.upsert({
                where: { giocatoreId },
                update: {
                    saldoAttuale: { decrement: parsedImporto }
                },
                create: {
                    giocatoreId,
                    saldoAttuale: -parsedImporto
                }
            });

            return { movimento, saldo };
        });

        res.status(201).json(result);
    } catch (error: any) {
        console.error('Errore addebito:', error);
        res.status(500).json({ message: 'Errore durante l\'addebito manuale' });
    }
};

// POST /api/contabilita/rimborso
export const registraRimborso = async (req: Request, res: Response) => {
    const { giocatoreId, importo, descrizione, data: customData } = req.body;
    const adminId = (req as AuthRequest).user?.userId;

    const parsedImporto = Math.abs(parseFloat(importo));
    if (!parsedImporto || isNaN(parsedImporto) || parsedImporto <= 0) {
        return res.status(400).json({ message: 'L\'importo del rimborso deve essere positivo' });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crea il movimento (il rimborso spese non altera il saldo virtuale borsellino)
            const movimento = await tx.movimentoContabile.create({
                data: {
                    giocatoreId,
                    importo: parsedImporto,
                    tipo: TipoMovimento.RIMBORSO,
                    descrizione: descrizione || 'Rimborso spese',
                    adminId,
                    data: customData ? new Date(customData) : undefined
                }
            });

            // 2. Recupera il saldo attuale
            const saldo = await tx.saldoBorsellino.findUnique({
                where: { giocatoreId }
            });

            return { movimento, saldo };
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Errore registrazione rimborso:', error);
        res.status(500).json({ message: 'Errore durante la registrazione del rimborso' });
    }
};

// GET /api/contabilita/movimenti
export const getAllMovimenti = async (req: Request, res: Response) => {
    try {
        const movimenti = await prisma.movimentoContabile.findMany({
            include: {
                giocatore: {
                    select: {
                        nome: true,
                        cognome: true,
                        numeroTessera: true
                    }
                }
            },
            orderBy: { data: 'desc' },
            take: 200
        });

        res.json(movimenti);
    } catch (error) {
        console.error('Errore recupero movimenti:', error);
        res.status(500).json({ message: 'Errore nel recupero dello storico movimenti' });
    }
};

// GET /api/contabilita/saldi
export const getAllSaldi = async (req: Request, res: Response) => {
    try {
        const saldi = await prisma.giocatore.findMany({
            select: {
                id: true,
                nome: true,
                cognome: true,
                numeroTessera: true,
                telefono: true,
                saldo: {
                    select: {
                        saldoAttuale: true
                    }
                }
            },
            orderBy: [
                { cognome: 'asc' },
                { nome: 'asc' }
            ]
        });

        const result = saldi.map(g => ({
            id: g.id,
            nome: g.nome,
            cognome: g.cognome,
            numeroTessera: g.numeroTessera,
            telefono: g.telefono,
            saldoAttuale: g.saldo ? Number(g.saldo.saldoAttuale) : 0
        }));

        res.json(result);
    } catch (error) {
        console.error('Errore recupero saldi:', error);
        res.status(500).json({ message: 'Errore nel recupero dei saldi dei giocatori' });
    }
};

// Helper per ricalcolare il saldo di un giocatore con precisione decimale esatta
export const recalculateSaldo = async (giocatoreId: string, tx: Prisma.TransactionClient): Promise<number> => {
    const movimenti = await tx.movimentoContabile.findMany({
        where: { giocatoreId }
    });

    let nuovoSaldo = new Prisma.Decimal(0);

    for (const m of movimenti) {
        const imp = new Prisma.Decimal(Math.abs(Number(m.importo)).toString());
        switch (m.tipo) {
            case TipoMovimento.RICARICA:
                nuovoSaldo = nuovoSaldo.plus(imp);
                break;
            case TipoMovimento.ADDEBITO_MANUALE:
            case TipoMovimento.ISCRIZIONE_TORNEO:
            case TipoMovimento.ACQUISTO_MAGLIA:
                nuovoSaldo = nuovoSaldo.minus(imp);
                break;
            case TipoMovimento.RIMBORSO:
                // I rimborsi spese sono uscite di cassa, non modificano il credito personale gare
                break;
        }
    }

    await tx.saldoBorsellino.upsert({
        where: { giocatoreId },
        update: { saldoAttuale: nuovoSaldo },
        create: { giocatoreId, saldoAttuale: nuovoSaldo }
    });

    return nuovoSaldo.toNumber();
};

// PUT /api/contabilita/movimenti/:id
export const updateMovimento = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { importo, tipo, descrizione, data } = req.body;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Trova il movimento esistente
            const movimentoEsistente = await tx.movimentoContabile.findUnique({
                where: { id }
            });

            if (!movimentoEsistente) {
                throw new Error('Movimento non trovato');
            }

            const parsedImporto = importo !== undefined ? Math.abs(parseFloat(importo)) : undefined;

            // 2. Aggiorna il movimento
            const movimentoAggiornato = await tx.movimentoContabile.update({
                where: { id },
                data: {
                    importo: parsedImporto !== undefined ? parsedImporto : undefined,
                    tipo: tipo || undefined,
                    descrizione: descrizione || undefined,
                    data: data ? new Date(data) : undefined
                }
            });

            // 3. Ricalcola il saldo per quel giocatore
            const nuovoSaldo = await recalculateSaldo(movimentoEsistente.giocatoreId, tx);

            return { movimento: movimentoAggiornato, saldo: nuovoSaldo };
        });

        res.json(result);
    } catch (error: any) {
        console.error('Errore aggiornamento movimento:', error);
        if (error.message === 'Movimento non trovato') {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Errore durante l\'aggiornamento del movimento' });
    }
};

// DELETE /api/contabilita/movimenti/:id
export const deleteMovimento = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const movimentoEsistente = await tx.movimentoContabile.findUnique({
                where: { id }
            });

            if (!movimentoEsistente) {
                throw new Error('Movimento non trovato');
            }

            const giocatoreId = movimentoEsistente.giocatoreId;

            // Elimina il movimento
            await tx.movimentoContabile.delete({
                where: { id }
            });

            // Ricalcola il saldo
            const nuovoSaldo = await recalculateSaldo(giocatoreId, tx);

            return { success: true, saldo: nuovoSaldo };
        });

        res.json(result);
    } catch (error: any) {
        console.error('Errore eliminazione movimento:', error);
        if (error.message === 'Movimento non trovato') {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Errore durante l\'eliminazione del movimento' });
    }
};
