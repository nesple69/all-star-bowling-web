import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { subDays, addDays } from 'date-fns';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        // 0. Trova la stagione attiva
        const stagioneAttiva = await prisma.stagione.findFirst({
            where: { attiva: true }
        });

        // 1. Totale iscritti per categoria e sesso
        const statsPerCategoria = await prisma.giocatore.groupBy({
            by: ['categoria', 'sesso'],
            _count: {
                id: true
            }
        });

        // 2. Prossimi Impegni (Tutti i tornei non ancora completati - ma solo recenti o futuri)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const prossimiTornei = await prisma.torneo.findMany({
            where: {
                completato: false,
                stagioneId: stagioneAttiva?.id,
                dataInizio: {
                    gte: fourteenDaysAgo
                }
            },
            take: 20,
            orderBy: {
                dataInizio: 'asc'
            },
            include: {
                stagione: true,
                sedi: {
                    select: { id: true, nome: true, locandina: true }
                }
            }
        });

        // 3. Ultimi 4 tornei completati con top 10 giocatori
        const ultimiTornei = await prisma.torneo.findMany({
            where: {
                completato: true,
                stagioneId: stagioneAttiva?.id
            },
            take: 4,
            orderBy: {
                dataInizio: 'desc'
            },
            include: {
                risultati: {
                    orderBy: {
                        posizione: 'asc'
                    },
                    take: 10,
                    include: {
                        giocatore: {
                            select: {
                                nome: true,
                                cognome: true,
                                categoria: true,
                                sesso: true
                            }
                        }
                    }
                },
                stagione: true
            }
        });

        // 4. Certificati in scadenza (< 20 giorni o già scaduti) - Solo per ADMIN (Privacy/GDPR)
        const isAdmin = (req as any).user?.role === 'ADMIN';
        let certificatiInScadenza: any[] = [];

        if (isAdmin) {
            const limiteScadenza = addDays(oggi, 20);
            certificatiInScadenza = await prisma.giocatore.findMany({
                where: {
                    certificatoMedicoScadenza: {
                        lte: limiteScadenza
                    }
                },
                orderBy: {
                    certificatoMedicoScadenza: 'asc'
                },
                select: {
                    id: true,
                    nome: true,
                    cognome: true,
                    certificatoMedicoScadenza: true
                }
            });
        }

        res.json({
            statsPerCategoria: statsPerCategoria.map(s => ({
                categoria: `${s.sesso}/${s.categoria}`,
                count: s._count.id
            })),
            prossimiTornei,
            ultimiTornei,
            certificatiInScadenza
        });
    } catch (error) {
        console.error('Errore nel recupero delle statistiche dashboard:', error);
        res.status(500).json({ message: 'Errore nel caricamento della dashboard' });
    }
};
