import { Router, Request, Response } from 'express';
import { generaBackupPDF } from '../services/backupService';
import { authenticateToken, isAdmin, AuthRequest } from '../middleware/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const router = Router();
const execAsync = promisify(exec);

// Middleware di autenticazione admin per tutte le rotte
router.use(authenticateToken);
router.use(isAdmin);

/**
 * GET /api/backup/genera/:stagioneId
 * Genera backup PDF per una stagione specifica
 */
router.get('/genera/:stagioneId', async (req: AuthRequest, res: Response) => {
    try {
        const { stagioneId } = req.params;

        if (!stagioneId) {
            return res.status(400).json({ message: 'ID stagione mancante' });
        }

        // Genera il PDF
        const pdfBuffer = await generaBackupPDF(stagioneId as string);

        // Imposta gli headers per il download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="backup-stagione-${stagioneId}-${new Date().toISOString().split('T')[0]}.pdf"`
        );
        res.setHeader('Content-Length', pdfBuffer.length);

        // Invia il PDF
        res.send(pdfBuffer);
    } catch (error: any) {
        console.error('Errore nella generazione del backup PDF:', error);

        if (error.message === 'Stagione non trovata') {
            return res.status(404).json({ message: 'Stagione non trovata' });
        }

        res.status(500).json({
            message: 'Errore nella generazione del backup PDF',
            error: error.message
        });
    }
});

import os from 'os';
import { prisma } from '../lib/prisma';

/**
 * Genera un dump completo in formato JSON di tutti i dati applicativi
 */
async function generateJsonDatabaseBackup(): Promise<string> {
    const [
        users,
        giocatori,
        stagioni,
        tornei,
        turni,
        iscrizioni,
        risultati,
        partite,
        sedi,
        movimenti,
        saldi
    ] = await Promise.all([
        prisma.user.findMany({ select: { id: true, username: true, email: true, nome: true, cognome: true, ruolo: true, createdAt: true } }),
        prisma.giocatore.findMany(),
        prisma.stagione.findMany(),
        prisma.torneo.findMany(),
        prisma.giorniOrariTorneo.findMany(),
        prisma.iscrizioneTorneo.findMany(),
        prisma.risultatoTorneo.findMany(),
        prisma.partitaTorneo.findMany(),
        prisma.sedeTorneo.findMany(),
        prisma.movimentoContabile.findMany(),
        prisma.saldoBorsellino.findMany()
    ]);

    const backupPayload = {
        metadata: {
            app: 'All Star Team Management',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            format: 'json-snapshot'
        },
        data: {
            users,
            giocatori,
            stagioni,
            tornei,
            turni,
            iscrizioni,
            risultati,
            partite,
            sedi,
            movimenti,
            saldi
        }
    };

    return JSON.stringify(backupPayload, null, 2);
}

/**
 * GET /api/backup/database
 * Genera dump completo del database (SQL nativo con pg_dump o Smart Fallback JSON per ambienti cloud/serverless)
 */
router.get('/database', async (req: AuthRequest, res: Response) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        return res.status(500).json({ message: 'DATABASE_URL non configurato' });
    }

    try {
        const tempDir = os.tmpdir();
        const sqlFilename = `backup-database-${timestamp}.sql`;
        const sqlBackupPath = path.join(tempDir, sqlFilename);

        const dbUrl = new URL(databaseUrl);
        const dbUser = dbUrl.username;
        const dbPassword = dbUrl.password;
        const dbHost = dbUrl.hostname;
        const dbPort = dbUrl.port || '5432';
        const dbName = dbUrl.pathname.substring(1);

        // Tentativo di dump nativo con pg_dump
        try {
            const pgDumpCommand = `pg_dump -h "${dbHost}" -p "${dbPort}" -U "${dbUser}" -d "${dbName}" -F p -f "${sqlBackupPath}"`;

            await execAsync(pgDumpCommand, {
                env: {
                    ...process.env,
                    PGPASSWORD: dbPassword
                },
                timeout: 30000
            });

            if (fs.existsSync(sqlBackupPath)) {
                const fileBuffer = fs.readFileSync(sqlBackupPath);
                res.setHeader('Content-Type', 'application/sql');
                res.setHeader('Content-Disposition', `attachment; filename="${sqlFilename}"`);
                res.setHeader('Content-Length', fileBuffer.length);

                res.send(fileBuffer);

                setTimeout(() => {
                    try { if (fs.existsSync(sqlBackupPath)) fs.unlinkSync(sqlBackupPath); } catch {}
                }, 3000);
                return;
            }
        } catch (pgError: any) {
            console.warn('⚠️ pg_dump non disponibile nell\'ambiente host. Esecuzione Smart JSON Fallback:', pgError.message);
        }

        // Fallback: Esportazione JSON strutturata (funziona ovunque, incluso Vercel)
        const jsonContent = await generateJsonDatabaseBackup();
        const jsonBuffer = Buffer.from(jsonContent, 'utf-8');
        const jsonFilename = `backup-database-${timestamp}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${jsonFilename}"`);
        res.setHeader('Content-Length', jsonBuffer.length);

        res.send(jsonBuffer);

    } catch (error: any) {
        console.error('Errore nel backup del database:', error);
        res.status(500).json({
            message: 'Errore durante la generazione del backup del database'
        });
    }
});

export default router;
