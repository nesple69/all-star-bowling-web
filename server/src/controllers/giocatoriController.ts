import { Request, Response } from 'express';
import { CategoriaGiocatore, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';

// GET /api/giocatori
export const getAllGiocatori = async (req: Request, res: Response) => {
    const { categoria, stagioneId, attivo } = req.query;
    const authReq = req as AuthRequest;
    const currentUser = authReq.user;
    const isAdmin = currentUser?.role === 'ADMIN';

    try {
        const where: Prisma.GiocatoreWhereInput = {};
        if (categoria) {
            where.categoria = categoria as CategoriaGiocatore;
        }

        if (attivo === 'true' || attivo === '1') {
            where.attivo = true;
        } else if (attivo === 'false' || attivo === '0') {
            where.attivo = false;
        }

        if (stagioneId) {
            where.iscrizioni = {
                some: {
                    torneo: {
                        stagioneId: stagioneId as string
                    }
                }
            };
        }

        const giocatori = await prisma.giocatore.findMany({
            where,
            include: {
                user: {
                    select: {
                        email: true,
                        ruolo: true
                    }
                },
                saldo: true,
                _count: {
                    select: { risultati: true }
                }
            },
            orderBy: { cognome: 'asc' }
        });

        const partiteStats = await prisma.risultatoTorneo.groupBy({
            by: ['giocatoreId'],
            _sum: {
                partiteGiocate: true
            }
        });

        const partiteMap = new Map(partiteStats.map(s => [s.giocatoreId, s._sum.partiteGiocate || 0]));

        const safeGiocatori = giocatori.map((g: any) => {
            const isOwnerOrAdmin = isAdmin || (currentUser && currentUser.userId === g.userId);
            return {
                ...g,
                torneiGiocati: g._count.risultati,
                partiteGiocate: partiteMap.get(g.id) || 0,
                telefono: isOwnerOrAdmin ? g.telefono : undefined,
                certificatoMedicoScadenza: isOwnerOrAdmin ? g.certificatoMedicoScadenza : undefined,
                user: isOwnerOrAdmin ? g.user : undefined,
                saldo: isOwnerOrAdmin ? g.saldo : undefined
            };
        });

        res.json(safeGiocatori);
    } catch (error) {
        console.error('[GET_GIOCATORI_ERROR]', error);
        res.status(500).json({ message: 'Errore nel recupero dei giocatori' });
    }
};

// GET /api/giocatori/stats
export const getGiocatoriStats = async (_req: Request, res: Response) => {
    try {
        const stats = await prisma.giocatore.groupBy({
            by: ['categoria'],
            _count: {
                _all: true
            },
            _avg: {
                mediaAttuale: true
            }
        });

        res.json(stats);
    } catch (error) {
        console.error('[GET_GIOCATORI_STATS_ERROR]', error);
        res.status(500).json({ message: 'Errore nel recupero delle statistiche' });
    }
};

// GET /api/giocatori/:id
export const getGiocatoreById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const authReq = req as AuthRequest;
    const currentUser = authReq.user;
    const isAdmin = currentUser?.role === 'ADMIN';

    try {
        const giocatore = await prisma.giocatore.findUnique({
            where: { id: id as string },
            include: {
                user: {
                    select: { email: true, nome: true, cognome: true }
                },
                iscrizioni: {
                    include: { torneo: true }
                },
                risultati: {
                    include: {
                        torneo: true,
                        partite: {
                            orderBy: { numeroPartita: 'asc' }
                        }
                    }
                },
                saldo: true
            }
        });

        if (!giocatore) {
            return res.status(404).json({ message: 'Giocatore non trovato' });
        }

        const isAuthorized = isAdmin || (currentUser && currentUser.userId === giocatore.userId);

        const safeGiocatore = {
            ...giocatore,
            telefono: isAuthorized ? (giocatore as any).telefono : undefined,
            certificatoMedicoScadenza: isAuthorized ? (giocatore as any).certificatoMedicoScadenza : undefined,
            user: isAuthorized ? (giocatore as any).user : { nome: giocatore.nome, cognome: giocatore.cognome },
            saldo: isAuthorized ? (giocatore as any).saldo : undefined
        };

        res.json(safeGiocatore);
    } catch (error) {
        console.error('[GET_GIOCATORE_BY_ID_ERROR]', error);
        res.status(500).json({ message: 'Errore nel recupero del giocatore' });
    }
};

// POST /api/giocatori
export const createGiocatore = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        email,
        password,
        nome,
        cognome,
        dataNascita,
        telefono,
        numeroTessera,
        sesso,
        categoria,
        isSenior,
        fasciaSenior,
        certificatoMedicoScadenza,
        isAziendale,
        aziendaAffiliata
    } = req.body;

    try {
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'Email già in uso' });
        }

        const hashedPassword = await bcrypt.hash(password || 'Bowling2026!', 10);

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    nome,
                    cognome,
                    ruolo: 'USER'
                }
            });

            const giocatore = await tx.giocatore.create({
                data: {
                    nome,
                    cognome,
                    dataNascita: new Date(dataNascita),
                    telefono,
                    numeroTessera,
                    sesso,
                    categoria,
                    isSenior: isSenior || false,
                    fasciaSenior: fasciaSenior || 'NONE',
                    certificatoMedicoScadenza: certificatoMedicoScadenza ? new Date(certificatoMedicoScadenza) : null,
                    isAziendale: isAziendale || false,
                    aziendaAffiliata,
                    attivo: req.body.attivo !== undefined ? (req.body.attivo === true || req.body.attivo === 'true') : true,
                    userId: user.id
                }
            });

            await tx.saldoBorsellino.create({
                data: {
                    giocatoreId: giocatore.id,
                    saldoAttuale: 0
                }
            });

            return giocatore;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('[CREATE_GIOCATORE_ERROR]', error);
        res.status(500).json({ message: 'Errore nella creazione del giocatore' });
    }
};

// PUT /api/giocatori/:id
export const updateGiocatore = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        nome,
        cognome,
        dataNascita,
        telefono,
        numeroTessera,
        sesso,
        categoria,
        isSenior,
        fasciaSenior,
        certificatoMedicoScadenza,
        isAziendale,
        aziendaAffiliata,
        attivo,
        totaleBirilli,
        partiteGiocate
    } = req.body;

    try {
        let mediaAttuale = undefined;
        if (totaleBirilli !== undefined && partiteGiocate > 0) {
            mediaAttuale = totaleBirilli / partiteGiocate;
        }

        let parsedCertificato: Date | null | undefined = undefined;
        if (certificatoMedicoScadenza === null || certificatoMedicoScadenza === '') {
            parsedCertificato = null;
        } else if (certificatoMedicoScadenza !== undefined) {
            parsedCertificato = new Date(certificatoMedicoScadenza);
        }

        const giocatore = await prisma.giocatore.update({
            where: { id: id as string },
            data: {
                nome,
                cognome,
                dataNascita: dataNascita ? new Date(dataNascita) : undefined,
                telefono: telefono !== undefined ? (telefono || null) : undefined,
                numeroTessera: numeroTessera !== undefined ? (numeroTessera || null) : undefined,
                sesso,
                categoria: categoria as any,
                isSenior: isSenior !== undefined ? isSenior : undefined,
                fasciaSenior: fasciaSenior as any,
                certificatoMedicoScadenza: parsedCertificato,
                isAziendale: isAziendale !== undefined ? isAziendale : undefined,
                aziendaAffiliata: aziendaAffiliata !== undefined ? (aziendaAffiliata || null) : undefined,
                attivo: attivo !== undefined ? (attivo === true || attivo === 'true') : undefined,
                totaleBirilli: totaleBirilli !== undefined ? totaleBirilli : undefined,
                mediaAttuale: mediaAttuale
            }
        });

        res.json(giocatore);
    } catch (error) {
        console.error('[UPDATE_GIOCATORE_ERROR]', error);
        res.status(500).json({ message: 'Errore nell\'aggiornamento del giocatore' });
    }
};

// PATCH /api/giocatori/:id/toggle-attivo (solo ADMIN)
export const toggleStatoAttivo = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const giocatore = await prisma.giocatore.findUnique({
            where: { id }
        });
        if (!giocatore) {
            return res.status(404).json({ message: 'Giocatore non trovato' });
        }

        const updated = await prisma.giocatore.update({
            where: { id },
            data: { attivo: !giocatore.attivo }
        });

        res.json({
            message: `Stato tesseramento ${updated.attivo ? 'attivato' : 'disattivato (non rinnovato)'} con successo`,
            giocatore: updated
        });
    } catch (error) {
        console.error('[TOGGLE_ATTIVO_ERROR]', error);
        res.status(500).json({ message: 'Errore durante la modifica dello stato tesserato' });
    }
};

// DELETE /api/giocatori/:id
export const deleteGiocatore = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        const giocatore = await prisma.giocatore.findUnique({ where: { id } });
        if (!giocatore) {
            return res.status(404).json({ message: 'Giocatore non trovato' });
        }

        await prisma.$transaction([
            prisma.iscrizioneTorneo.deleteMany({ where: { giocatoreId: id as string } }),
            prisma.risultatoTorneo.deleteMany({ where: { giocatoreId: id as string } }),
            prisma.saldoBorsellino.deleteMany({ where: { giocatoreId: id as string } }),
            prisma.movimentoContabile.deleteMany({ where: { giocatoreId: id as string } }),
            prisma.giocatore.delete({ where: { id: id as string } }),
            prisma.user.delete({ where: { id: giocatore.userId as string } })
        ]);

        res.json({ message: 'Giocatore ed utente associato eliminati correttamente' });
    } catch (error) {
        console.error('[DELETE_GIOCATORE_ERROR]', error);
        res.status(500).json({ message: 'Errore nell\'eliminazione del giocatore' });
    }
};
