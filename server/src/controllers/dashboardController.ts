import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { addDays } from 'date-fns';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const isAdmin = (req as any).user?.role === 'ADMIN';

        // 1. Trova la stagione attiva
        const stagioneAttiva = await prisma.stagione.findFirst({
            where: { attiva: true }
        });

        const activeStagioneId = stagioneAttiva?.id;
        const limiteScadenza = addDays(oggi, 20);

        // 2. Esecuzione parallela di tutte le query della dashboard (eliminazione del waterfall)
        const [statsPerCategoria, prossimiTornei, ultimiTornei, certificatiInScadenza] = await Promise.all([
            // Totale iscritti per categoria e sesso (solo atleti attivi)
            prisma.giocatore.groupBy({
                by: ['categoria', 'sesso'],
                where: {
                    attivo: true
                },
                _count: {
                    id: true
                }
            }),

            // Prossimi Impegni (tornei recenti o futuri non completati)
            prisma.torneo.findMany({
                where: {
                    completato: false,
                    stagioneId: activeStagioneId,
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
            }),

            // Ultimi 4 tornei completati con top 10 giocatori
            prisma.torneo.findMany({
                where: {
                    completato: true,
                    stagioneId: activeStagioneId
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
            }),

            // Certificati in scadenza (< 20 giorni o già scaduti) - Solo per ADMIN
            isAdmin
                ? prisma.giocatore.findMany({
                    where: {
                        attivo: true,
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
                        telefono: true,
                        certificatoMedicoScadenza: true,
                        dataSollecitoCertificato: true
                    }
                })
                : Promise.resolve([])
        ]);

        // Caching edge / CDN: per visitatori pubblici i dati aggregati vengono serviti da CDN Vercel
        if (!isAdmin) {
            res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        } else {
            res.setHeader('Cache-Control', 'private, no-cache');
        }

        res.json({
            stagioneAttiva: stagioneAttiva ? {
                id: stagioneAttiva.id,
                nome: stagioneAttiva.nome
            } : null,
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
