import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { createClient } from '@supabase/supabase-js';

// Configurazione Supabase Storage Safe
const getSupabaseClient = () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('[SUPABASE] Errore: Variabili SUPABASE_URL o KEY mancanti su Vercel!');
        return null;
    }
    return createClient(url, key);
};

const supabase = getSupabaseClient();

// Configurazione Multer per caricamento Locandine (In Memoria per Vercel/Supabase)
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Formato file non supportato. Caricare PDF o immagini.'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadToSupabase = async (file: Express.Multer.File): Promise<string> => {
    if (!supabase) {
        throw new Error('Configurazione Supabase mancante sul server.');
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `locandina-${uniqueSuffix}${path.extname(file.originalname)}`;
    
    const { data, error } = await supabase.storage
        .from('locandine')
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: true
        });

    if (error) {
        throw new Error(`Errore Supabase: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('locandine')
        .getPublicUrl(fileName);
    
    return publicUrl;
};

// GET /api/tornei/public
export const getTorneiPublici = async (_req: Request, res: Response) => {
    try {
        const tornei = await prisma.torneo.findMany({
            include: {
                turni: true,
                stagione: true,
                sedi: {
                    select: { id: true, nome: true, locandina: true }
                },
                _count: {
                    select: { iscrizioni: true, risultati: true }
                }
            },
            orderBy: {
                dataInizio: 'desc'
            }
        });
        res.json(tornei);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero dei tornei', error });
    }
};

// GET /api/tornei/public/:id
export const getTorneoPublicById = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const torneo = await prisma.torneo.findUnique({
            where: { id },
            include: {
                stagione: true,
                turni: {
                    orderBy: { orarioInizio: 'asc' }
                },
                sedi: true,
                risultati: {
                    include: {
                        giocatore: {
                            select: { nome: true, cognome: true, sesso: true, categoria: true }
                        },
                        partite: {
                            orderBy: { numeroPartita: 'asc' }
                        }
                    },
                    orderBy: [
                        { isRiserva: 'asc' },
                        { posizione: 'asc' }
                    ]
                },
                _count: {
                    select: { iscrizioni: true, risultati: true }
                }
            }
        });

        if (!torneo) {
            return res.status(404).json({ message: 'Torneo non trovato' });
        }

        res.json(torneo);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero del torneo', error });
    }
};

// GET /api/tornei (solo ADMIN - lista filtrata per stagione)
export const getTorneiAdmin = async (req: Request, res: Response) => {
    const { stagioneId } = req.query;
    console.log('GET /api/tornei (Admin) - stagioneId:', stagioneId);
    try {
        const tornei = await prisma.torneo.findMany({
            where: stagioneId ? { stagioneId: stagioneId as string } : {},
            include: {
                _count: {
                    select: { iscrizioni: true, risultati: true }
                },
                stagione: true
            },
            orderBy: { dataInizio: 'desc' }
        });
        res.json(tornei);
    } catch (error) {
        console.error('SERVER ERROR (getTorneiAdmin):', error);
        res.status(500).json({ message: 'Errore nel recupero dei tornei admin', error: String(error) });
    }
};

// GET /api/tornei/:id (dettaglio con giorni/orari)
export const getTorneoById = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const torneo = await prisma.torneo.findUnique({
            where: { id },
            include: {
                turni: {
                    include: { sede: true },
                    orderBy: { giorno: 'asc' }
                },
                sedi: true,
                stagione: true
            }
        });
        if (!torneo) return res.status(404).json({ message: 'Torneo non trovato' });
        res.json(torneo);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero del dettaglio torneo', error });
    }
};

// POST /api/tornei (crea torneo)
export const createTorneo = async (req: Request, res: Response) => {
    console.log('--- CREATE TORNEO START ---');
    const { nome, tipologia, sede, stagioneId, dataInizio, dataFine, linkIscrizione, costoIscrizione, mostraBottoneIscrizione, locandinaUrl, sedi, categorie } = req.body;
    
    let locandina = locandinaUrl || null;
    let sediData = [];
    if (sedi) {
        try {
            sediData = typeof sedi === 'string' ? JSON.parse(sedi) : sedi;
        } catch (e) {
            console.error('Errore parsing sedi:', e);
        }
    }

    let categorieData = [];
    if (categorie) {
        try {
            categorieData = typeof categorie === 'string' ? JSON.parse(categorie) : categorie;
        } catch (e) {
            console.error('Errore parsing categorie:', e);
        }
    }

    try {
        const files = req.files as Express.Multer.File[] || [];
        
        // Cerca locandina principale
        const mainFile = files.find(f => f.fieldname === 'locandina_main' || f.fieldname === 'locandina');
        if (mainFile) {
            locandina = await uploadToSupabase(mainFile);
        }

        // Cerca locandine per le sedi
        for (let i = 0; i < sediData.length; i++) {
            const sedeFile = files.find(f => f.fieldname === `sede_locandina_${i}`);
            if (sedeFile) {
                sediData[i].locandina = await uploadToSupabase(sedeFile);
            }
        }

        const dataInizioParsed = dataInizio ? new Date(dataInizio) : null;
        if (!dataInizioParsed || isNaN(dataInizioParsed.getTime())) {
            throw new Error('Data inizio non valida');
        }

        const dataFineParsed = dataFine ? new Date(dataFine) : null;

        const nuovoTorneo = await prisma.torneo.create({
            data: {
                nome,
                tipologia,
                sede,
                locandina,
                linkIscrizione,
                stagioneId,
                costoIscrizione: costoIscrizione ? parseFloat(costoIscrizione) : 0,
                dataInizio: dataInizioParsed,
                dataFine: dataFineParsed,
                mostraBottoneIscrizione: (String(mostraBottoneIscrizione) === 'true' || mostraBottoneIscrizione === true),
                categorie: categorieData,
                sedi: {
                    create: sediData.map((s: any) => ({
                        nome: s.nome,
                        categorie: s.categorie || [],
                        locandina: s.locandina || null
                    }))
                }
            }
        });
        console.log('Torneo creato con successo:', nuovoTorneo.id);
        res.status(201).json(nuovoTorneo);
    } catch (error: any) {
        console.error('SERVER ERROR (createTorneo):', error);
        res.status(500).json({
            message: 'Errore nella creazione del torneo',
            error: error.message || String(error)
        });
    }
};

// PUT /api/tornei/:id (modifica)
export const updateTorneo = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    console.log(`--- UPDATE TORNEO START (ID: ${id}) ---`);
    const { nome, tipologia, sede, stagioneId, dataInizio, dataFine, linkIscrizione, completato, costoIscrizione, mostraBottoneIscrizione, locandinaUrl, sedi, categorie } = req.body;
    
    let locandina = locandinaUrl || undefined;
    let sediData = [];
    if (sedi) {
        try {
            sediData = typeof sedi === 'string' ? JSON.parse(sedi) : sedi;
        } catch (e) {
            console.error('Errore parsing sedi:', e);
        }
    }

    let categorieData = undefined;
    if (categorie) {
        try {
            categorieData = typeof categorie === 'string' ? JSON.parse(categorie) : categorie;
        } catch (e) {
            console.error('Errore parsing categorie:', e);
        }
    }

    try {
        const files = req.files as Express.Multer.File[] || [];
        
        // Cerca locandina principale
        const mainFile = files.find(f => f.fieldname === 'locandina_main' || f.fieldname === 'locandina');
        if (mainFile) {
            locandina = await uploadToSupabase(mainFile);
        }

        // Cerca locandine per le sedi
        for (let i = 0; i < sediData.length; i++) {
            const sedeFile = files.find(f => f.fieldname === `sede_locandina_${i}`);
            if (sedeFile) {
                sediData[i].locandina = await uploadToSupabase(sedeFile);
            }
        }

        const dataInizioParsed = dataInizio ? new Date(dataInizio) : undefined;
        if (dataInizioParsed !== undefined && isNaN(dataInizioParsed.getTime())) {
            throw new Error('Data inizio non valida');
        }

        const dataFineParsed = dataFine ? new Date(dataFine) : null;

        const updateData: any = {
            nome,
            tipologia,
            sede,
            stagioneId,
            dataInizio: dataInizioParsed,
            dataFine: dataFineParsed,
            linkIscrizione,
            costoIscrizione: costoIscrizione !== undefined ? (parseFloat(costoIscrizione) || 0) : undefined,
            completato: completato === 'true' || completato === true,
            mostraBottoneIscrizione: (String(mostraBottoneIscrizione) === 'true' || mostraBottoneIscrizione === true),
            categorie: categorieData
        };
        if (locandina) updateData.locandina = locandina;

        const torneoAggiornato = await prisma.$transaction(async (tx) => {
            const updated = await tx.torneo.update({
                where: { id },
                data: updateData
            });

            if (sedi) {
                await tx.sedeTorneo.deleteMany({ where: { torneoId: id } });
                
                if (sediData.length > 0) {
                    await tx.sedeTorneo.createMany({
                        data: sediData.map((s: any) => ({
                            torneoId: id,
                            nome: s.nome,
                            categorie: s.categorie || [],
                            locandina: s.locandina || null
                        }))
                    });
                }
            }
            return updated;
        });
        console.log('Torneo aggiornato con successo');
        res.json(torneoAggiornato);
    } catch (error: any) {
        console.error('SERVER ERROR (updateTorneo):', error);
        res.status(500).json({
            message: 'Errore nell\'aggiornamento del torneo',
            error: error.message || String(error)
        });
    }
};

// DELETE /api/tornei/:id
export const deleteTorneo = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.torneo.delete({ where: { id } });
        res.json({ message: 'Torneo e tutti i dati associati eliminati con successo' });
    } catch (error) {
        console.error('Errore durante l\'eliminazione del torneo:', error);
        res.status(500).json({ message: 'Errore nell\'eliminazione del torneo', error: String(error) });
    }
};

// POST /api/tornei/:id/giorni (aggiungi giorno/orario disponibile)
export const addGiornoTorneo = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { giorno, orarioInizio, orarioFine, postiDisponibili, sedeId } = req.body;

    try {
        let finalSedeId = sedeId;

        // Auto-assegnazione se manca la sede ed è unica per il torneo
        if (!finalSedeId) {
            const torneo = await prisma.torneo.findUnique({
                where: { id },
                include: { sedi: true }
            });
            if (torneo && torneo.sedi.length === 1) {
                finalSedeId = torneo.sedi[0].id;
            }
        }

        const nuovoGiorno = await prisma.giorniOrariTorneo.create({
            data: {
                torneoId: id,
                sedeId: finalSedeId || null,
                giorno: new Date(giorno),
                orarioInizio: new Date(orarioInizio),
                orarioFine: new Date(orarioFine),
                postiDisponibili: parseInt(postiDisponibili)
            }
        });
        res.status(201).json(nuovoGiorno);
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'aggiunta del giorno/orario', error });
    }
};

// PUT /api/tornei/:id/giorni/:giornoId (solo ADMIN)
export const updateGiornoTorneo = async (req: Request, res: Response) => {
    const giornoId = req.params.giornoId as string;
    const { giorno, orarioInizio, orarioFine, postiDisponibili, sedeId } = req.body;

    try {
        const giornoAggiornato = await prisma.giorniOrariTorneo.update({
            where: { id: giornoId },
            data: {
                giorno: new Date(giorno),
                orarioInizio: new Date(orarioInizio),
                orarioFine: new Date(orarioFine),
                postiDisponibili: parseInt(postiDisponibili),
                sedeId: sedeId || null
            }
        });
        res.json(giornoAggiornato);
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'aggiornamento del giorno/orario', error });
    }
};

// DELETE /api/tornei/:id/giorni/:giornoId
export const deleteGiornoTorneo = async (req: Request, res: Response) => {
    const giornoId = req.params.giornoId as string;
    try {
        await prisma.giorniOrariTorneo.delete({
            where: { id: giornoId }
        });
        res.json({ message: 'Giorno/orario eliminato con successo' });
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'eliminazione del giorno/orario', error });
    }
};

// GET /api/tornei/classifiche
export const getClassifiche = async (_req: Request, res: Response) => {
    try {
        const classifiche = await prisma.torneo.findMany({
            where: { completato: true },
            include: {
                risultati: {
                    include: {
                        giocatore: {
                            select: { nome: true, cognome: true, sesso: true, categoria: true }
                        },
                        partite: {
                            orderBy: { numeroPartita: 'asc' }
                        }
                    },
                    orderBy: [
                        { isRiserva: 'asc' },
                        { posizione: 'asc' }
                    ]
                },
                stagione: true
            },
            orderBy: { dataFine: 'desc' },
            take: 10
        });
        res.json(classifiche);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle classifiche', error });
    }
};

// GET /api/tornei/:id/risultati (solo ADMIN)
export const getRisultatiTorneoAdmin = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const risultati = await prisma.risultatoTorneo.findMany({
            where: { torneoId: id },
            include: {
                giocatore: {
                    select: { nome: true, cognome: true, categoria: true }
                }
            },
            orderBy: [
                { isRiserva: 'asc' },
                { posizione: 'asc' }
            ]
        });
        res.json(risultati);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero dei risultati', error });
    }
};

// POST /api/tornei/:id/risultati (solo ADMIN - upsert singolo risultato)
export const upsertRisultato = async (req: Request, res: Response) => {
    const torneoId = req.params.id as string;
    const { giocatoreId, posizione, partiteGiocate, totaleBirilli, totaleBirilliSquadra, isRiserva, partite } = req.body;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Calcolo riporto dai dati delle partite se presenti
            let calculatedRiporto = 0;
            if (partite && Array.isArray(partite)) {
                calculatedRiporto = partite.reduce((sum, p) => sum + (p.isRiporto ? (p.birilli || 0) : 0), 0);
            }

            const risultatoId = req.body.id;
            const commonData = {
                posizione: parseInt(posizione),
                partiteGiocate: parseInt(partiteGiocate),
                totaleBirilli: parseInt(totaleBirilli),
                totaleBirilliSquadra: totaleBirilliSquadra ? parseInt(totaleBirilliSquadra) : null,
                isRiserva: isRiserva === true || isRiserva === 'true',
                riporto: calculatedRiporto
            };

            const risultato = risultatoId 
                ? await tx.risultatoTorneo.update({
                    where: { id: risultatoId },
                    data: commonData
                  })
                : await tx.risultatoTorneo.create({
                    data: {
                        ...commonData,
                        torneoId,
                        giocatoreId
                    }
                  });

            // Gestione partite se fornite
            if (partite && Array.isArray(partite)) {
                await tx.partitaTorneo.deleteMany({
                    where: { risultatoTorneoId: risultato.id }
                });

                if (partite.length > 0) {
                    await tx.partitaTorneo.createMany({
                        data: partite.map((p: any, index: number) => ({
                            risultatoTorneoId: risultato.id,
                            numeroPartita: index + 1,
                            birilli: typeof p === 'object' ? p.birilli : p,
                            isRiporto: typeof p === 'object' ? !!p.isRiporto : false,
                            data: new Date()
                        }))
                    });
                }
            }

            // AGGIORNAMENTO STATISTICHE GIOCATORE (COERENTE CON IL TOTALE NETTO)
            const tuttiRisultati = await tx.risultatoTorneo.findMany({
                where: { giocatoreId },
                include: { partite: true }
            });

            // Ora r.totaleBirilli è già NETTO, la somma è diretta
            const totaleBirilliNetto = tuttiRisultati.reduce((sum, r) => sum + r.totaleBirilli, 0);
            const totalePartiteReali = tuttiRisultati.reduce((sum, r) => sum + r.partiteGiocate, 0);
            const mediaAttuale = totalePartiteReali > 0 ? totaleBirilliNetto / totalePartiteReali : 0;

            // Calcolo miglior partita ESCLUDENDO i riporti
            const tuttePartiteReali = tuttiRisultati.flatMap(r => 
                r.partite.filter(p => !p.isRiporto).map(p => p.birilli)
            );
            const migliorPartita = tuttePartiteReali.length > 0 ? Math.max(...tuttePartiteReali) : 0;

            await tx.giocatore.update({
                where: { id: giocatoreId },
                data: {
                    totaleBirilli: totaleBirilliNetto,
                    mediaAttuale,
                    migliorPartita
                }
            });

            return risultato;
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Errore nel salvataggio del risultato', error });
    }
};

// DELETE /api/tornei/:id/risultati/:risultatoId (solo ADMIN)
export const deleteRisultato = async (req: Request, res: Response) => {
    const risultatoId = req.params.risultatoId as string;
    try {
        await prisma.risultatoTorneo.delete({ where: { id: risultatoId } });
        res.json({ message: 'Risultato eliminato' });
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'eliminazione del risultato', error });
    }
};

