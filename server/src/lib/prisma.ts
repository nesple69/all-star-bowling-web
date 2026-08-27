import { PrismaClient } from '@prisma/client';

// Singleton pattern per Vercel serverless:
// evita di creare una nuova connessione ad ogni invocazione della funzione
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

globalForPrisma.prisma = prisma;

export default prisma;
