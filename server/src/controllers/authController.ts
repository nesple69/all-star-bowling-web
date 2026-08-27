import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { validationResult } from 'express-validator';

import { JWT_SECRET } from '../middleware/auth';

export const register = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, nome, cognome, ruolo } = req.body;

    try {
        if (username) {
            const usernameExists = await prisma.user.findUnique({ where: { username } });
            if (usernameExists) {
                return res.status(400).json({ message: 'Username già in uso' });
            }
        }

        if (email) {
            const emailExists = await prisma.user.findUnique({ where: { email } });
            if (emailExists) {
                return res.status(400).json({ message: 'Email già in uso' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                email: email || null,
                password: hashedPassword,
                nome,
                cognome,
                ruolo: ruolo || 'USER'
            }
        });

        res.status(201).json({ message: 'Utente creato correttamente', userId: user.id });
    } catch (error) {
        console.error('[AUTH_REGISTER_ERROR]', error);
        res.status(500).json({ message: 'Errore durante la registrazione' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body; // 'username' qui può contenere sia lo username che l'email

    try {
        // Cerca l'utente per username O per email (case-insensitive)
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: { equals: username, mode: 'insensitive' } },
                    { email: { equals: username, mode: 'insensitive' } }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ message: 'Credenziali non valide' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenziali non valide' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.ruolo },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, nome: user.nome, cognome: user.cognome, ruolo: user.ruolo } });
    } catch (error) {
        res.status(500).json({ message: 'Errore durante il login', error });
    }
};

export const getMe = async (req: any, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                username: true,
                email: true,
                nome: true,
                cognome: true,
                ruolo: true,
                createdAt: true,
                giocatore: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        saldo: {
                            select: { saldoAttuale: true }
                        },
                        iscrizioni: {
                            select: { torneoId: true, turnoId: true }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero dati utente', error });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    const { username, email, nome, cognome, password } = req.body;
    const userId = req.user.userId;

    try {
        // Verifica se lo username è già preso da qualcun altro
        if (username) {
            const existingUser = await prisma.user.findUnique({ where: { username } });
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ message: 'Username già in uso da un altro utente' });
            }
        }

        const updateData: any = {};
        if (username) updateData.username = username;
        if (email !== undefined) updateData.email = email || null;
        if (nome) updateData.nome = nome;
        if (cognome) updateData.cognome = cognome;

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                nome: true,
                cognome: true,
                ruolo: true
            }
        });

        res.json({ message: 'Profilo aggiornato con successo', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Errore durante l\'aggiornamento del profilo', error });
    }
};
