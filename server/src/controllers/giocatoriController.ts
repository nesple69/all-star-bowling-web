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

        // Identifica stagione target: per utenti non-admin è sempre e solo la stagione attiva
        let targetStagioneId: string | null = null;
        const stagioneAttiva = await prisma.stagione.findFirst({
            where: { attiva: true }
        });

        if (isAdmin && stagioneId && stagioneId !== 'ALL') {
            targetStagioneId = String(stagioneId);
        } else if (isAdmin && stagioneId === 'ALL') {
            targetStagioneId = null; // Storico globale solo per admin
        } else if (stagioneAttiva) {
            targetStagioneId = stagioneAttiva.id;
        }

        const isStagioneAttivaSelected = targetStagioneId && stagioneAttiva && targetStagioneId === stagioneAttiva.id;

        // Se è la stagione attiva, prendi solo i giocatori attivi in rosa
        if (isStagioneAttivaSelected) {
            where.attivo = true;
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
                saldo: true
            },
            orderBy: { cognome: 'asc' }
        });

        // Risultati filtrati per la stagione target (se definita)
        const whereRisultati: Prisma.RisultatoTorneoWhereInput = targetStagioneId
            ? { torneo: { stagioneId: targetStagioneId } }
            : {};

        const risultatiStagione = await prisma.risultatoTorneo.findMany({
            where: whereRisultati,
            include: {
                partite: true
            }
        });

        // Mappa delle statistiche per giocatore
        const statsMap = new Map<string, { tornei: number, partite: number, birilli: number, migliorPartita: number }>();

        risultatiStagione.forEach(r => {
            const current = statsMap.get(r.giocatoreId) || { tornei: 0, partite: 0, birilli: 0, migliorPartita: 0 };
            current.tornei += 1;
            current.partite += r.partiteGiocate;
            current.birilli += r.totaleBirilli;

            const games = r.partite.filter(p => !p.isRiporto).map(p => p.birilli);
            if (games.length > 0) {
                const maxG = Math.max(...games);
                if (maxG > current.migliorPartita) {
                    current.migliorPartita = maxG;
                }
            }

            statsMap.set(r.giocatoreId, current);
        });

        // Se è selezionata una stagione passata (non attiva), mostra solo chi ha preso parte a quella stagione
        const giocatoriStagione = targetStagioneId && !isStagioneAttivaSelected
            ? giocatori.filter((g: any) => statsMap.has(g.id))
            : giocatori;

        const safeGiocatori = giocatoriStagione.map((g: any) => {
            const isOwnerOrAdmin = isAdmin || (currentUser && currentUser.userId === g.userId);
            const playerStats = statsMap.get(g.id) || { tornei: 0, partite: 0, birilli: 0, migliorPartita: 0 };
            const seasonMedia = playerStats.partite > 0
                ? Number((playerStats.birilli / playerStats.partite).toFixed(2))
                : 0;

            return {
                ...g,
                torneiGiocati: playerStats.tornei,
                partiteGiocate: playerStats.partite,
                totaleBirilli: playerStats.birilli,
                mediaAttuale: seasonMedia,
                migliorPartita: playerStats.migliorPartita,
                stagioneRiferimentoId: targetStagioneId,
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
                        torneo: {
                            include: {
                                stagione: true
                            }
                        },
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
