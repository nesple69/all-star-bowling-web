import { Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';

// GET /api/users - Lista tutti gli utenti
export const getAllUsers = async (_req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                nome: true,
                cognome: true,
                ruolo: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero utenti', error });
    }
};

// POST /api/users/create-admin - Crea nuovo admin
export const createAdmin = async (req: AuthRequest, res: Response) => {
    const { username, email, password, nome, cognome } = req.body;

    if (!username || !password || !nome || !cognome) {
        return res.status(400).json({ message: 'Tutti i campi obbligatori devono essere compilati' });
    }

    try {
        // Verifica username univoco
        const exists = await prisma.user.findUnique({ where: { username } });
        if (exists) {
            return res.status(400).json({ message: 'Username già in uso' });
        }

        if (email) {
            const emailExists = await prisma.user.findUnique({ where: { email } });
            if (emailExists) {
                return res.status(400).json({ message: 'Email già in uso' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await prisma.user.create({
            data: {
                username,
                email: email || null,
                password: hashedPassword,
                nome,
                cognome,
                ruolo: 'ADMIN'
            }
        });

        res.status(201).json({
            message: 'Admin creato con successo',
            user: { id: newAdmin.id, username: newAdmin.username }
        });
    } catch (error) {
        console.error('[CREATE_ADMIN_ERROR]', error);
        res.status(500).json({ message: 'Errore nella creazione dell\'amministratore' });
    }
};

// PUT /api/users/:id/role - Cambia ruolo utente
export const updateUserRole = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { ruolo } = req.body;

    try {
        // Verifica che non sia l'ultimo admin
        if (ruolo === 'USER') {
            const adminCount = await prisma.user.count({ where: { ruolo: 'ADMIN' } });
            if (adminCount <= 1) {
                return res.status(400).json({
                    message: 'Impossibile rimuovere l\'ultimo amministratore'
                });
            }
        }

        const updated = await prisma.user.update({
            where: { id: id as string },
            data: { ruolo }
        });

        res.json({ message: 'Ruolo aggiornato', user: updated });
    } catch (error) {
        console.error('[UPDATE_USER_ROLE_ERROR]', error);
        res.status(500).json({ message: 'Errore nell\'aggiornamento del ruolo' });
    }
};

// DELETE /api/users/:id - Elimina utente
export const deleteUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        // Impedisce eliminazione di se stesso
        if (req.user?.userId === id) {
            return res.status(400).json({ message: 'Non puoi eliminare il tuo stesso account' });
        }

        // Verifica che non sia l'ultimo admin
        const user = await prisma.user.findUnique({
            where: { id: id as string },
            include: { giocatore: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        if (user.ruolo === 'ADMIN') {
            const adminCount = await prisma.user.count({ where: { ruolo: 'ADMIN' } });
            if (adminCount <= 1) {
                return res.status(400).json({
                    message: 'Impossibile eliminare l\'ultimo amministratore'
                });
            }
        }

        // Se l'utente ha un profilo giocatore associato, esegue l'eliminazione atomica pulita
        if (user.giocatore) {
            const giocatoreId = user.giocatore.id;
            await prisma.$transaction([
                prisma.iscrizioneTorneo.deleteMany({ where: { giocatoreId } }),
                prisma.risultatoTorneo.deleteMany({ where: { giocatoreId } }),
                prisma.saldoBorsellino.deleteMany({ where: { giocatoreId } }),
                prisma.movimentoContabile.deleteMany({ where: { giocatoreId } }),
                prisma.giocatore.delete({ where: { id: giocatoreId } }),
                prisma.user.delete({ where: { id: id as string } })
            ]);
        } else {
            await prisma.user.delete({ where: { id: id as string } });
        }

        res.json({ message: 'Utente eliminato con successo' });
    } catch (error) {
        console.error('[DELETE_USER_ERROR]', error);
        res.status(500).json({ message: 'Errore nell\'eliminazione dell\'utente' });
    }
};

// PUT /api/users/:id/reset-password - Resetta password utente (solo ADMIN)
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'La nuova password deve contenere almeno 6 caratteri' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: id as string },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password utente aggiornata con successo' });
    } catch (error) {
        console.error('[RESET_PASSWORD_ERROR]', error);
        res.status(500).json({ message: 'Errore durante il reset della password' });
    }
};
