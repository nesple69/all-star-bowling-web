import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
    Trophy, AlertTriangle, Clock, CheckCircle2,
    Users, Calendar, MapPin, CreditCard,
    ChevronUp
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';

interface DashboardData {
    statsPerCategoria: { categoria: string; count: number }[];
    prossimiTornei: any[];
    ultimiTornei: {
        id: string;
        nome: string;
        tipologia: string;
        dataInizio: string;
        stagione: { nome: string };
        risultati: {
            id: string;
            posizione: number;
            partiteGiocate: number;
            totaleBirilli: number;
            totaleBirilliSquadra?: number;
            divisione?: string | null;
            isRiserva: boolean;
            giocatore: {
                nome: string;
                cognome: string;
                sesso: string;
                categoria: string;
            };
            partite: {
                birilli: number;
            }[];
        }[];
    }[];
    certificatiInScadenza: any[];
}

interface IscrittoPublic {
    giocatore: {
        nome: string;
        cognome: string;
        sesso: string;
        categoria: string;
    };
    turno: {
        giorno: string;
        orarioInizio: string;
    };
    secondoTurno?: {
        giorno: string;
        orarioInizio: string;
    } | null;
}

const CATEGORY_COLORS: Record<string, string> = {
    'A': 'from-amber-400 to-amber-600',
    'B': 'from-amber-300 to-amber-500',
    'C': 'from-purple-400 to-purple-600',
    'D': 'from-purple-300 to-purple-500',
    'ES': 'from-emerald-400 to-emerald-600',
    'DS': 'from-slate-400 to-slate-600'
};

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const [iscrittiMap, setIscrittiMap] = useState<Record<string, IscrittoPublic[]>>({});
    // @ts-ignore
    const [loadingIscritti, setLoadingIscritti] = useState<Record<string, boolean>>({});
    const [openIscritti, setOpenIscritti] = useState<Record<string, boolean>>({});

    const fetchStats = async (): Promise<DashboardData> => {
        const response = await axios.get(`${API_BASE_URL}/api/dashboard/stats`);
        return response.data;
    };

    const { data, isLoading, error: queryError } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: fetchStats,
    });

    const error = queryError ? (queryError as any).response?.data?.message || queryError.message || 'Errore di connessione' : null;

    // @ts-ignore
    const fetchIscritti = async (torneoId: string) => {
        if (iscrittiMap[torneoId]) {
            setOpenIscritti(prev => ({ ...prev, [torneoId]: !prev[torneoId] }));
            return;
        }

        setLoadingIscritti(prev => ({ ...prev, [torneoId]: true }));
        try {
            const res = await axios.get(`${API_BASE_URL}/api/tornei/public/${torneoId}/iscritti`);
            setIscrittiMap(prev => ({ ...prev, [torneoId]: res.data }));
            setOpenIscritti(prev => ({ ...prev, [torneoId]: true }));
        } catch (err) {
            console.error('Errore caricamento iscritti:', err);
        } finally {
            setLoadingIscritti(prev => ({ ...prev, [torneoId]: false }));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 animate-fade-in">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <h3 className="text-xl font-black uppercase tracking-tight text-dark">Connessione Fallita</h3>
                <p className="text-gray-500 font-medium text-center max-w-md">
                    Non riesco a contattare il server.
                    <br />
                    <span className="text-xs text-red-400 mt-2 block font-mono">
                        {error}
                    </span>
                    <br />
                    <span className="text-[10px] text-gray-400">
                        Punto di accesso: <code className="bg-gray-100 px-1">{API_BASE_URL || '(Relativo)'}/api/dashboard/stats</code>
                        <br />
                        Stato Axios: <code className="bg-gray-100 px-1">{error}</code>
                    </span>
                </p>
                <div className="flex space-x-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-primary text-white font-black px-6 py-2 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                    >
                        Riprova
                    </button>
                    <a
                        href={`${API_BASE_URL}/api/health`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gray-200 text-gray-600 font-black px-6 py-2 rounded-xl uppercase tracking-widest text-xs hover:bg-gray-300 transition-all"
                    >
                        Test Server
                    </a>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const saldoAttuale = user?.giocatore?.saldo?.saldoAttuale || 0;

    return (
        <div className="space-y-10 animate-fade-in pb-12">
            {/* Sezione Saldo Personale (se presente) */}
            {user?.giocatore && (
                <div className="bg-white rounded-2xl p-6 border-2 border-primary/20 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-center gap-4 relative">
                        <div className="p-4 bg-primary rounded-2xl text-white shadow-xl shadow-primary/30">
                            <CreditCard className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Il Tuo Borsellino</p>
                            <h2 className="text-2xl font-black text-dark uppercase tracking-tight">{user.giocatore.nome} {user.giocatore.cognome}</h2>
                        </div>
                    </div>
                    <div className="text-center md:text-right relative">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Saldo Attuale</p>
                        <p className={`text-4xl font-black ${Number(saldoAttuale) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(saldoAttuale))}
                        </p>
                    </div>
                </div>
            )}

            {/* 1. Header con cards statistiche */}
            <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 border-b-2 border-primary/20 pb-3 max-w-5xl mx-auto">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-black uppercase tracking-tighter text-dark">I Nostri Atleti</h2>
                </div>
                <div className="flex flex-nowrap justify-start md:justify-center gap-2 max-w-6xl mx-auto px-4 overflow-x-auto pb-4 custom-scrollbar no-scrollbar-md">
                    {data.statsPerCategoria.sort((a, b) => a.categoria.localeCompare(b.categoria)).map((cat) => {
                        const baseCat = cat.categoria.split('/')[1] || cat.categoria;
                        return (
                            <div key={cat.categoria}
                                className={`bg-gradient-to-br ${CATEGORY_COLORS[baseCat] || 'from-gray-400 to-gray-600'} rounded-xl px-4 py-2 text-white shadow-md transform hover:scale-105 transition-all cursor-default group flex flex-col items-center min-w-[85px] h-[55px] justify-center shrink-0`}
                            >
                                <span className="text-[10px] font-black leading-none mb-1 opacity-90">{cat.categoria}</span>
                                <p className="text-xl font-black leading-none">{cat.count}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* 2. Sezione "Prossimi Impegni" */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-primary/20 pb-3">
                        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-dark">
                            <Calendar className="w-5 h-5 text-primary" />
                            Prossimi Impegni
                        </h2>
                    </div>
                    <div className="space-y-4">
                        {data.prossimiTornei.length > 0 ? (
                            data.prossimiTornei.map((torneo) => (
                                <div key={torneo.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="font-black uppercase text-dark leading-tight">{torneo.nome}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                            <MapPin className="w-3 h-3" />
                                            {torneo.sede}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-primary font-bold">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(torneo.dataInizio), 'dd MMM yyyy', { locale: it })}
                                            {torneo.dataFine && torneo.dataFine !== torneo.dataInizio && (
                                                <> - {format(new Date(torneo.dataFine), 'dd MMM yyyy', { locale: it })}</>
                                            )}
                                        </div>
                                    </div>

                                    {/* NUOVA LOGICA: Unico tasto Dettagli e Iscrizione */}
                                    <div className="flex flex-col gap-2 pt-2 border-t border-gray-50">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fetchIscritti(torneo.id);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                                        >
                                            <Users className="w-4 h-4" />
                                            {openIscritti[torneo.id] ? 'Chiudi Atleti' : 'Vedi Iscritti'}
                                        </button>

                                        <button
                                            onClick={() => navigate(`/tornei/${torneo.id}`)}
                                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all shadow-lg shadow-secondary/20"
                                        >
                                            <Trophy className="w-4 h-4" />
                                            Dettagli e Iscrizione
                                        </button>
                                    </div>

                                    {/* Sezione Iscritti Espandibile (Opzionale, mantenuta se vuoi vederli subito) */}
                                    {openIscritti[torneo.id] && iscrittiMap[torneo.id] && (
                                        <div className="mt-2 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200 space-y-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                    Atleti Iscritti ({iscrittiMap[torneo.id].length})
                                                </h4>
                                                <button onClick={() => setOpenIscritti(prev => ({ ...prev, [torneo.id]: false }))}>
                                                    <ChevronUp className="w-3 h-3 text-gray-300 hover:text-gray-500" />
                                                </button>
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {iscrittiMap[torneo.id].length > 0 ? (
                                                    iscrittiMap[torneo.id].map((isc, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-gray-50/50 p-3 rounded-lg border border-gray-100/50">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black uppercase text-dark">
                                                                    {isc.giocatore.cognome} {isc.giocatore.nome}
                                                                </span>
                                                                <span className="text-sm font-bold text-gray-400 uppercase">
                                                                    {isc.giocatore.sesso}/{isc.giocatore.categoria}
                                                                </span>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <span className="text-sm font-black text-primary uppercase bg-primary/5 px-2 py-1 rounded-md">
                                                                    {format(new Date(isc.turno.orarioInizio.replace('Z', '')), 'dd/MM HH:mm')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase text-center py-2">Nessun iscritto</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200 text-gray-400">
                                Nessun torneo imminente
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Sezione "Ultimi Risultati" */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-secondary/20 pb-3">
                        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-dark">
                            <Trophy className="w-5 h-5 text-secondary" />
                            Ultimi Risultati
                        </h2>
                    </div>
                    <div className="space-y-8">
                        {data.ultimiTornei.length > 0 ? (
                            data.ultimiTornei.map((torneo) => (
                                <div key={torneo.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="bg-dark p-2 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-white/80 tracking-widest leading-none mb-1">{torneo.stagione.nome}</p>
                                                <h4 className="text-white text-xs font-black uppercase leading-tight">{torneo.nome}</h4>
                                            </div>
                                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                                                {format(new Date(torneo.dataInizio), 'dd/MM/yy')}
                                            </span>
                                        </div>
                                        <div className="px-2 py-0.5 bg-secondary text-dark rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                                            {torneo.tipologia}
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Pos</th>
                                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Atleta</th>
                                                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Partite</th>
                                                    <th className="px-4 py-3 text-center text-[10px] font-black text-primary uppercase tracking-widest">Media</th>
                                                    <th className="px-4 py-3 text-center text-[10px] font-black text-dark uppercase tracking-widest">Total</th>
                                                    {torneo.tipologia !== 'SINGOLO' && (
                                                        <th className="px-4 py-3 text-center text-[10px] font-black text-secondary uppercase tracking-widest">Team</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const isTeam = torneo.tipologia !== 'SINGOLO';
                                                    const groupedTeams = torneo.risultati.reduce((acc: any, ris: any) => {
                                                        const teamId = torneo.tipologia === 'SINGOLO' ? ris.id : ris.posizione;
                                                        if (!acc[teamId]) acc[teamId] = [];
                                                        acc[teamId].push(ris);
                                                        return acc;
                                                    }, {});

                                                    const divisions: Record<string, any[]> = {};

                                                    Object.values(groupedTeams).forEach((team: any) => {
                                                        const p1 = team[0];
                                                        let divName = p1.divisione || 'Generale';

                                                        if (torneo.tipologia === 'SINGOLO' && p1.giocatore?.sesso && p1.giocatore?.categoria) {
                                                            divName = `${p1.giocatore.sesso}/${p1.giocatore.categoria}`;
                                                        } else if (torneo.tipologia === 'DOPPIO' || torneo.tipologia === 'TRIS') {
                                                            const hasEccellenza = team.some((m: any) => ['A', 'B'].includes(m.giocatore?.categoria));
                                                            const allFemale = team.every((m: any) => m.giocatore?.sesso === 'F');
                                                            const genere = allFemale ? 'Femminile' : 'Maschile';
                                                            const livello = hasEccellenza ? 'Eccellenza' : 'Cadetti';
                                                            divName = `${livello} ${genere}`;
                                                        } else if (torneo.tipologia === 'SQUADRA_4' || torneo.tipologia === 'SQUADRA') {
                                                            const hasEccellenza = team.some((m: any) => ['A', 'B'].includes(m.giocatore?.categoria));
                                                            divName = hasEccellenza ? 'Eccellenza' : 'Cadetti';
                                                        }

                                                        if (!divisions[divName]) divisions[divName] = [];
                                                        divisions[divName].push(team);
                                                    });

                                                    const sortedDivisionNames = Object.keys(divisions).sort((a, b) => a.localeCompare(b));

                                                    return sortedDivisionNames.map((divName) => {
                                                        const teamsInDiv = divisions[divName];
                                                        const sortedTeams = teamsInDiv.sort((a, b) => a[0].posizione - b[0].posizione);

                                                        return (
                                                            <React.Fragment key={divName}>
                                                                <tr className="bg-primary/5">
                                                                    <td colSpan={isTeam ? 6 : 5} className="px-4 py-1.5 border-y border-primary/10">
                                                                        <span className="text-[11px] font-black uppercase tracking-widest text-primary">
                                                                            Categoria {divName}
                                                                        </span>
                                                                    </td>
                                                                </tr>

                                                                {sortedTeams.map((members: any) => {
                                                                    const teamTotal = members[0].totaleBirilliSquadra || members.reduce((sum: number, m: any) => sum + m.totaleBirilli, 0);

                                                                    return members.map((r: any, memberIdx: number) => {
                                                                        const isFirstInGroup = memberIdx === 0;
                                                                        const isLastInGroup = memberIdx === members.length - 1;

                                                                        return (
                                                                            <tr key={r.id} className={`transition-colors ${r.isRiserva ? 'opacity-60 bg-gray-50/30' : ''} ${isLastInGroup ? 'border-b border-gray-100' : 'border-b border-gray-50'} hover:bg-gray-50/50`}>
                                                                                <td className="px-2 py-2 text-center align-middle">
                                                                                    {isFirstInGroup && (
                                                                                        r.isRiserva ? (
                                                                                            <span className="text-[9px] font-black text-gray-300 uppercase leading-none">RIS</span>
                                                                                        ) : (
                                                                                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${r.posizione === 1 ? 'bg-amber-400 text-white shadow-sm' :
                                                                                                r.posizione === 2 ? 'bg-slate-300 text-white' :
                                                                                                    r.posizione === 3 ? 'bg-amber-600/30 text-amber-700' : 'text-gray-400'
                                                                                                }`}>
                                                                                                {r.posizione}
                                                                                            </span>
                                                                                        )
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-2 py-2">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[12px] font-bold text-dark leading-tight">
                                                                                            {r.giocatore.cognome} {r.giocatore.nome}
                                                                                        </span>
                                                                                        <span className="text-[9px] font-black text-primary uppercase">
                                                                                            {r.giocatore.sesso}/{r.giocatore.categoria}
                                                                                        </span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-1 py-2">
                                                                                    <div className="flex flex-wrap justify-center gap-0.5">
                                                                                        {r.partite && r.partite.length > 0 ? (
                                                                                            r.partite.map((p: any, idx: number) => (
                                                                                                <span key={idx} className="text-[10px] font-bold text-dark/70 bg-gray-50 px-1 rounded border border-gray-100 min-w-[20px] text-center">
                                                                                                    {p.birilli}
                                                                                                </span>
                                                                                            ))
                                                                                        ) : (
                                                                                            <span className="text-[11px] text-gray-400 italic font-bold">{r.partiteGiocate} p.</span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-2 py-2 text-center">
                                                                                    <span className="text-[13px] font-black text-primary">
                                                                                        {r.partiteGiocate > 0 ? (r.totaleBirilli / r.partiteGiocate).toFixed(1) : '0.0'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-2 py-2 text-center text-[12px] font-black text-dark">
                                                                                    {r.totaleBirilli}
                                                                                </td>
                                                                                {isTeam && (
                                                                                    <td className="px-2 py-2 text-center align-middle">
                                                                                        {isFirstInGroup && (
                                                                                            <span className="text-[12px] font-black text-secondary">
                                                                                                {teamTotal || '-'}
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    });
                                                                })}
                                                            </React.Fragment>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-400 italic">Dati non pervenuti</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Sezione "Certificati in Scadenza" (footer) */}
            {isAdmin() && (
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 border-b-2 border-red-100 pb-3">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h2 className="text-xl font-black uppercase tracking-tighter text-red-600">Certificati in Scadenza</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {data.certificatiInScadenza.length > 0 ? (
                            data.certificatiInScadenza.map((atleta) => {
                                const giorniRimanenti = differenceInDays(new Date(atleta.certificatoMedicoScadenza), new Date());
                                const isUrgent = giorniRimanenti < 10;

                                return (
                                    <div key={atleta.id} className={`flex items-center justify-between p-4 rounded-xl border ${isUrgent ? 'bg-red-50 border-red-200 text-red-700' : 'bg-orange-50 border-orange-200 text-orange-700'
                                        } shadow-sm transition-all hover:shadow-md`}>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold uppercase">{atleta.cognome} {atleta.nome}</span>
                                            <span className="text-[10px] font-black tracking-widest opacity-70">
                                                {format(new Date(atleta.certificatoMedicoScadenza), 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                        <div className={`text-xs font-black px-2 py-1 rounded ${isUrgent ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                                            {giorniRimanenti < 0 ? 'SCADUTO' : `${giorniRimanenti} GG`}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="lg:col-span-4 bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <p className="text-xs font-black uppercase tracking-widest">Ottimo! Tutti i certificati sono in regola.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
