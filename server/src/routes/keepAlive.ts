import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/keep-alive
 *
 * Endpoint leggero per mantenere attivo il database Supabase.
 * Viene chiamato periodicamente dalla Vercel Cron Job (configurata in vercel.json)
 * per evitare che il database entri in modalità pausa/inattività.
 *
 * La query eseguita è intenzionalmente minimale: SELECT 1 tramite Prisma
 * basta a "svegliare" la connessione senza caricare il sistema.
 */
router.get('/', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        // Query minimale: verifica la connessione senza toccare dati applicativi.
        // $queryRaw è il modo più economico per fare un "ping" al DB con Prisma.
        await prisma.$queryRaw`SELECT 1`;

        const elapsed = Date.now() - startTime;

        console.log(`[Keep-Alive] ✅ DB ping OK in ${elapsed}ms — ${new Date().toISOString()}`);

        res.status(200).json({
            status: 'ok',
            message: 'Database is alive',
            db_ping_ms: elapsed,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        const elapsed = Date.now() - startTime;

        console.error(`[Keep-Alive] ❌ DB ping FAILED after ${elapsed}ms:`, error?.message);

        res.status(503).json({
            status: 'error',
            message: 'Database unreachable',
            db_ping_ms: elapsed,
            error: error?.message || 'Unknown error',
            timestamp: new Date().toISOString(),
        });
    }
});

export default router;
