import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'fallback_secret') {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET non configurato o insicuro in ambiente di produzione.');
        }
        console.warn('⚠️ ATTENZIONE: JWT_SECRET non configurato o impostato su fallback_secret. Configurare una chiave sicura.');
        return 'fallback_dev_secret_only_for_local_env_never_prod';
    }
    return secret;
};

export const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token mancante' });
    }

    jwt.verify(token, JWT_SECRET, (err, user: any) => {
        if (err) {
            return res.status(403).json({ message: 'Token non valido o scaduto' });
        }
        req.user = user;
        next();
    });
};

export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user: any) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Accesso negato: richiesti privilegi di amministratore' });
    }
    next();
};
