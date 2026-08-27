import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/stagioni
export const getStagioni = async (_req: Request, res: Response) => {
    try {
        const stagioni = await prisma.stagione.findMany({
            orderBy: { dataInizio: 'desc' }
        });
        res.json(stagioni);
    } catch (error) {
    }
};

// GET /api/stagioni/attiva
export const getStagioneAttiva = async (_req: Request, res: Response) => {
    try {
        const stagioneAttiva = await prisma.stagione.findFirst({
            where: { attiva: true }
        });

        if (!stagioneAttiva) {
            return res.status(404).json({ message: 'Nessuna stagione attiva trovata' });
        }

        res.json(stagioneAttiva);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero della stagione attiva', error });
    }
};

// POST /api/stagioni (ADMIN)
export const createStagione = async (req: Request, res: Response) => {
    const { nome, dataInizio, dataFine, attiva } = req.body;
    try {
        // Se la nuova stagione è attiva, disattiva le altre
        if (attiva) {
            await prisma.stagione.updateMany({
                where: { attiva: true },
                data: { attiva: false }
            });
        }

        const nuovaStagione = await prisma.stagione.create({
            data: {
                nome,
                dataInizio: new Date(dataInizio),
                dataFine: new Date(dataFine),
                attiva: attiva === true || attiva === 'true'
            }
        });
        res.status(201).json(nuovaStagione);
    } catch (error) {
        res.status(500).json({ message: 'Errore nella creazione della stagione', error });
    }
};

// PUT /api/stagioni/:id (ADMIN)
export const updateStagione = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { nome, dataInizio, dataFine, attiva } = req.body;
    try {
        // Se attiviamo questa stagione, disattiviamo le altre
        if (attiva === true || attiva === 'true') {
            await prisma.stagione.updateMany({
                where: { attiva: true },
                data: { attiva: false }
            });
        }

        const stagioneAggiornata = await prisma.stagione.update({
            where: { id },
            data: {
                nome,
                dataInizio: dataInizio ? new Date(dataInizio) : undefined,
                dataFine: dataFine ? new Date(dataFine) : undefined,
                attiva: attiva === true || attiva === 'true'
            }
        });
        res.json(stagioneAggiornata);
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'aggiornamento della stagione', error });
    }
};

// DELETE /api/stagioni/:id (ADMIN)
export const deleteStagione = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        // Controllo se ci sono tornei associati
        const torneiCount = await prisma.torneo.count({
            where: { stagioneId: id }
        });

        if (torneiCount > 0) {
            return res.status(400).json({
                message: 'Non è possibile eliminare una stagione con tornei associati.'
            });
        }

        await prisma.stagione.delete({ where: { id } });
        res.json({ message: 'Stagione eliminata con successo' });
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'eliminazione della stagione', error });
    }
};

// POST /api/stagioni/rinnovi-bulk (ADMIN)
export const bulkRinnovoTesserati = async (req: Request, res: Response) => {
    const { rinnovatiIds = [], nonRinnovatiIds = [] } = req.body;
    try {
        await prisma.$transaction([
            prisma.giocatore.updateMany({
                where: { id: { in: rinnovatiIds } },
                data: { attivo: true }
            }),
            prisma.giocatore.updateMany({
                where: { id: { in: nonRinnovatiIds } },
                data: { attivo: false }
            })
        ]);

        res.json({
            message: 'Stato rinnovi tesserati aggiornato con successo',
            rinnovati: rinnovatiIds.length,
            nonRinnovati: nonRinnovatiIds.length
        });
    } catch (error) {
        console.error('[BULK_RINNOVO_ERROR]', error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento dei rinnovi' });
    }
};
