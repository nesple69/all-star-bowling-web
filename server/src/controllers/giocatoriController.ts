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

        // Identifica stagione target: per utenti non-admin Ã¨ sempre e solo la stagione attiva
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

        // Se Ã¨ la stagione attiva, prendi solo i giocatori attivi in rosa
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

        // Statistiche aggregate ottimizzate a livello DB (prevenzione Out-Of-Memory su dataset ampi)
        interface AggregatedPlayerStats {
            giocatoreId: string;
            tornei: number;
            partite: number;
            birilli: number;
            migliorPartita: number;
        }

        const rawStats = targetStagioneId
            ? await prisma.$queryRaw<AggregatedPlayerStats[]>`
                SELECT 
                    r."giocatoreId",
                    COUNT(DISTINCT r.id)::int AS tornei,
                    COALESCE(SUM(r."partiteGiocate"), 0)::int AS partite,
                    COALESCE(SUM(r."totaleBirilli"), 0)::int AS birilli,
                    COALESCE(MAX(p.birilli), 0)::int AS "migliorPartita"
                FROM "RisultatoTorneo" r
                JOIN "Torneo" t ON r."torneoId" = t.id
                LEFT JOIN "PartitaTorneo" p ON p."risultatoTorneoId" = r.id AND p."isRiporto" = false
                WHERE t."stagioneId" = ${targetStagioneId}
                GROUP BY r."giocatoreId"
            `
            : await prisma.$queryRaw<AggregatedPlayerStats[]>`
                SELECT 
                    r."giocatoreId",
                    COUNT(DISTINCT r.id)::int AS tornei,
                    COALESCE(SUM(r."partiteGiocate"), 0)::int AS partite,
                    COALESCE(SUM(r."totaleBirilli"), 0)::int AS birilli,
                    COALESCE(MAX(p.birilli), 0)::int AS "migliorPartita"
                FROM "RisultatoTorneo" r
                LEFT JOIN "PartitaTorneo" p ON p."risultatoTorneoId" = r.id AND p."isRiporto" = false
                GROUP BY r."giocatoreId"
            `;

        // Mappa delle statistiche per giocatore
        const statsMap = new Map<string, { tornei: number; partite: number; birilli: number; migliorPartita: number }>();
        for (const s of rawStats) {
            statsMap.set(s.giocatoreId, {
                tornei: Number(s.tornei || 0),
                partite: Number(s.partite || 0),
                birilli: Number(s.birilli || 0),
                migliorPartita: Number(s.migliorPartita || 0)
            });
        }

        // Se Ã¨ selezionata una stagione passata (non attiva), mostra solo chi ha preso parte a quella stagione
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
                dataSollecitoCertificato: isOwnerOrAdmin ? g.dataSollecitoCertificato : undefined,
                dataSollecitoBorsellino: isOwnerOrAdmin ? g.dataSollecitoBorsellino : undefined,
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
    const { stagioneId } = req.query;
    const authReq = req as AuthRequest;
    const currentUser = authReq.user;
    const isAdmin = currentUser?.role === 'ADMIN';

    try {
        let targetStagioneId: string | null = null;
        const stagioneAttiva = await prisma.stagione.findFirst({
            where: { attiva: true }
        });

        if (isAdmin && stagioneId && stagioneId !== 'ALL') {
            targetStagioneId = String(stagioneId);
        } else if (isAdmin && stagioneId === 'ALL') {
            targetStagioneId = null; // Storico globale per admin
        } else if (stagioneId && stagioneId !== 'ALL') {
            targetStagioneId = String(stagioneId);
        } else if (stagioneAttiva) {
            targetStagioneId = stagioneAttiva.id;
        }

        const whereRisultati: Prisma.RisultatoTorneoWhereInput = {
            giocatoreId: id as string,
            ...(targetStagioneId ? { torneo: { stagioneId: targetStagioneId } } : {})
        };

        const whereIscrizioni: Prisma.IscrizioneTorneoWhereInput = {
            giocatoreId: id as string,
            ...(targetStagioneId ? { torneo: { stagioneId: targetStagioneId } } : {})
        };

        const giocatore = await prisma.giocatore.findUnique({
            where: { id: id as string },
            include: {
                user: {
                    select: { email: true, nome: true, cognome: true }
                },
                iscrizioni: {
                    where: whereIscrizioni,
                    include: { torneo: true }
                },
                risultati: {
                    where: whereRisultati,
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

        // Calcolo statistiche specifiche per la stagione richiesta
        let torneiCount = giocatore.risultati.length;
        let partiteCount = 0;
        let birilliCount = 0;
        let maxGame = 0;

        giocatore.risultati.forEach(r => {
            partiteCount += r.partiteGiocate;
            birilliCount += r.totaleBirilli;
            const games = r.partite.filter(p => !p.isRiporto).map(p => p.birilli);
            if (games.length > 0) {
                const mg = Math.max(...games);
                if (mg > maxGame) maxGame = mg;
            }
        });

        const seasonMedia = partiteCount > 0 ? Number((birilliCount / partiteCount).toFixed(2)) : 0;
        const isAuthorized = isAdmin || (currentUser && currentUser.userId === giocatore.userId);

        const safeGiocatore = {
            ...giocatore,
            mediaAttuale: seasonMedia,
            totaleBirilli: birilliCount,
            partiteGiocate: partiteCount,
            torneiGiocati: torneiCount,
            migliorPartita: maxGame,
            stagioneRiferimentoId: targetStagioneId,
            stagioneRiferimentoNome: targetStagioneId && stagioneAttiva && targetStagioneId === stagioneAttiva.id
                ? stagioneAttiva.nome
                : undefined,
            telefono: isAuthorized ? (giocatore as any).telefono : undefined,
            certificatoMedicoScadenza: isAuthorized ? (giocatore as any).certificatoMedicoScadenza : undefined,
            dataSollecitoCertificato: isAuthorized ? (giocatore as any).dataSollecitoCertificato : undefined,
            dataSollecitoBorsellino: isAuthorized ? (giocatore as any).dataSollecitoBorsellino : undefined,
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
            return res.status(400).json({ message: 'Email giÃ  in uso' });
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
        email,
        password,
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
        const existingGiocatore = await prisma.giocatore.findUnique({
            where: { id: id as string },
            include: { user: true }
        });

        if (!existingGiocatore) {
            return res.status(404).json({ message: 'Giocatore non trovato' });
        }

        if (existingGiocatore.userId) {
            const userDataToUpdate: any = {};
            if (nome) userDataToUpdate.nome = nome;
            if (cognome) userDataToUpdate.cognome = cognome;

            if (email && email !== existingGiocatore.user.email) {
                const emailInUse = await prisma.user.findUnique({ where: { email } });
                if (emailInUse && emailInUse.id !== existingGiocatore.userId) {
                    return res.status(400).json({ message: 'Email giÃ  in uso da un altro utente' });
                }
                userDataToUpdate.email = email;
            }

            if (password && password.trim() !== '') {
                userDataToUpdate.password = await bcrypt.hash(password, 10);
            }

            if (Object.keys(userDataToUpdate).length > 0) {
                await prisma.user.update({
                    where: { id: existingGiocatore.userId },
                    data: userDataToUpdate
                });
            }
        }

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
                ...(parsedCertificato !== undefined ? { dataSollecitoCertificato: null } : {}),
                isAziendale: isAziendale !== undefined ? isAziendale : undefined,
                aziendaAffiliata: aziendaAffiliata !== undefined ? (aziendaAffiliata || null) : undefined,
                attivo: attivo !== undefined ? (attivo === true || attivo === 'true') : undefined,
                totaleBirilli: totaleBirilli !== undefined ? totaleBirilli : undefined,
                mediaAttuale: mediaAttuale
            },
            include: {
                user: {
                    select: {
                        email: true,
                        ruolo: true
                    }
                }
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

// PATCH /api/giocatori/:id/registra-sollecito-certificato (solo ADMIN)
export const registraSollecitoCertificato = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const now = new Date();
        const updated = await prisma.giocatore.update({
            where: { id },
            data: { dataSollecitoCertificato: now }
        });
        res.json({
            message: 'Sollecito certificato registrato con successo',
            dataSollecitoCertificato: updated.dataSollecitoCertificato
        });
    } catch (error) {
        console.error('[REGISTRA_SOLLECITO_ERROR]', error);
        res.status(500).json({ message: 'Errore durante la registrazione del sollecito' });
    }
};

// DELETE /api/giocatori/:id


// PATCH /api/giocatori/:id/reset-sollecito-certificato (solo ADMIN)
export const resetSollecitoCertificato = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const updated = await prisma.giocatore.update({
            where: { id },
            data: { dataSollecitoCertificato: null }
        });
        res.json({
            message: 'Sollecito certificato rimosso con successo',
            dataSollecitoCertificato: updated.dataSollecitoCertificato
        });
    } catch (error) {
        console.error('[RESET_SOLLECITO_CERTIFICATO_ERROR]', error);
        res.status(500).json({ message: 'Errore durante la rimozione del sollecito' });
    }
};

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
