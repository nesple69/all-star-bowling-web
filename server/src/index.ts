import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth';
import giocatoriRoutes from './routes/giocatori';
import torneiRoutes from './routes/tornei';
import dashboardRoutes from './routes/dashboard';
import stagioniRoutes from './routes/stagioni';
import contabilitaRoutes from './routes/contabilita';
import importRoutes from './routes/import';
import partiteRoutes from './routes/partite';
import backupRoutes from './routes/backup';
import usersRoutes from './routes/users';
import keepAliveRoutes from './routes/keepAlive';
import { prisma } from './lib/prisma';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Logger base con diagnosi Vercel
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (Original: ${req.originalUrl})`);
    next();
});

// Rotte - Supporto doppio prefisso per Vercel
const apiRouter = express.Router();

import { authenticateToken, isAdmin } from './middleware/auth';

// Diagnostica Ambiente (Protetta: solo ADMIN)
apiRouter.get('/debug-env', authenticateToken, isAdmin, (req, res) => {
    res.json({
        status: 'diagnostic',
        has_db: !!process.env.DATABASE_URL,
        supabase_url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'MISSING',
        has_supabase_key: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
        node_env: process.env.NODE_ENV,
        env_keys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('URL') || k.includes('DATABASE'))
    });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/giocatori', giocatoriRoutes);
// Middleware per gestire i vecchi link della locandina (Legacy Redirect)
// Reindirizza le chiamate a /uploads/locandine verso Supabase usando originalUrl per Vercel
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/uploads/locandine/')) {
        const filename = req.originalUrl.split('/').pop();
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

        console.log(`[REDIRECT] Richiesta locandina: ${req.originalUrl} -> Filename: ${filename}`);

        if (filename && filename !== 'locandine' && supabaseUrl) {
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/locandine/${filename}`;
            console.log(`[REDIRECT] Reindirizzamento a Supabase: ${publicUrl}`);
            return res.redirect(publicUrl);
        } else if (!supabaseUrl) {
            console.error('[REDIRECT] Errore: SUPABASE_URL non configurata!');
        }
    }
    next();
});

apiRouter.use('/tornei', torneiRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/stagioni', stagioniRoutes);
apiRouter.use('/import', importRoutes);
apiRouter.use('/partite', partiteRoutes);
apiRouter.use('/backup', backupRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/keep-alive', keepAliveRoutes);
apiRouter.use('/', contabilitaRoutes);

// Applichiamo il router sia a /api che alla radice per massima compatibilità
app.use('/api', apiRouter);
app.use('/', apiRouter);





app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        v_antigravity: '1.0.42_FINAL_SYNC',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Gestore 404 globale
app.use('/*', (req, res) => {
    console.warn(`⚠️ 404: ${req.method} ${req.url} (${req.originalUrl})`);
    res.status(404).json({
        error: 'Risorsa non trovata',
        url: req.url,
        originalUrl: req.originalUrl,
        method: req.method
    });
});

// Gestore errori globale (CRUCIALE)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('💥 Error caught by global handler:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Errore interno del server',
        error: err.code || String(err),
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Export app for Vercel
export default app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
