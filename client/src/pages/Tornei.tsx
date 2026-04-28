import React, { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Calendar, MapPin, Search, UserPlus, Users, Loader2, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { API_BASE_URL } from '../config';

interface Torneo {
    id: string;
    nome: string;
    tipologia: string;
    sede: string;
    dataInizio: string;
    dataFine: string;
    completato: boolean;
    mostraBottoneIscrizione: boolean;
    linkIscrizione?: string | null;
    stagioneId: string;
    locandina?: string | null;
    sedi?: { id: string; nome: string; locandina?: string | null }[];
    stagione: {
        nome: string;
    };
    turni?: any[];
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

const Tornei: React.FC = () => {
    const [filter, setFilter] = useState<'TUTTI' | 'IN_CORSO' | 'COMPLETATI'>('TUTTI');
    const [searchQuery, setSearchQuery] = useState('');
    const [iscrittiMap, setIscrittiMap] = useState<Record<string, IscrittoPublic[]>>({});
    const [loadingIscritti, setLoadingIscritti] = useState<Record<string, boolean>>({});
    const [openIscritti, setOpenIscritti] = useState<Record<string, boolean>>({});
    const navigate = useNavigate();

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

    const fetchTorneiData = async () => {
        const response = await axios.get(`${API_BASE_URL}/api/tornei/public`);
        const torneiData = response.data;

        // Carica disponibilità per tornei non completati
        const attivi = torneiData.filter((t: Torneo) => !t.completato);
        const dispResults = await Promise.all(
            attivi.map(async (t: Torneo) => {
                try {
                    const res = await axios.get(`${API_BASE_URL}/api/tornei/public/${t.id}/disponibilita`);
                    const postiTotali = res.data.reduce((sum: number, s: any) => sum + (s.postiRimanenti || 0), 0);
                    return { id: t.id, posti: postiTotali };
                } catch {
                    return { id: t.id, posti: 0 };
                }
            })
        );
        const map: Record<string, number> = {};
        dispResults.forEach((d: { id: string; posti: number }) => { map[d.id] = d.posti; });
        return { tornei: torneiData, disponibilitaMap: map };
    };

    const { data: torneiDataResult, isLoading, error: queryError } = useQuery({
        queryKey: ['torneiPublicData'],
        queryFn: fetchTorneiData,
    });

    const error = queryError ? (queryError as any).response?.data?.message || queryError.message || 'Errore di connessione' : null;
    const tornei = torneiDataResult?.tornei || [];
    const disponibilitaMap = torneiDataResult?.disponibilitaMap || {};

    const filteredTornei = tornei
        .filter((t: Torneo) => {
            const matchSearch = t.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.sede.toLowerCase().includes(searchQuery.toLowerCase());

            if (filter === 'COMPLETATI') return matchSearch && t.completato;
            if (filter === 'IN_CORSO') return matchSearch && !t.completato;
            return matchSearch;
        })
        .sort((a: Torneo, b: Torneo) => new Date(b.dataInizio).getTime() - new Date(a.dataInizio).getTime());

    // Verifica se il torneo è ancora prenotabile
    const isPrenotabile = (t: Torneo): boolean => {
        if (t.completato) return false;
        const now = new Date();
        const dataRif = t.dataFine ? new Date(t.dataFine) : new Date(t.dataInizio);
        if (now > dataRif) return false;
        const postiRimanenti = disponibilitaMap[t.id];
        if (postiRimanenti !== undefined && postiRimanenti <= 0) return false;
        return true;
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
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <h3 className="text-xl font-black uppercase text-dark">Servitore non raggiungibile</h3>
                <p className="text-gray-500 font-medium">{error}</p>
                <span className="text-[10px] text-gray-400">
                    Punto di accesso: <code className="bg-gray-100 px-1">{API_BASE_URL || '(Relativo)'}/api/tornei/public</code>
                </span>
                <button onClick={() => window.location.reload()} className="bg-primary text-white px-6 py-2 rounded-xl font-black uppercase text-xs">Riprova</button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in text-dark pb-20">
            {/* Header */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                                <Trophy className="text-secondary w-8 h-8" />
                                Calendario Tornei
                            </h1>
                            {tornei.length > 0 && (
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest px-3 py-1.5 bg-primary/5 rounded-xl border border-primary/10 shadow-sm self-center">
                                    {tornei[0].stagione.nome}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 mt-1 font-medium italic">Scopri i prossimi eventi e consulta le classifiche ufficiali.</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cerca torneo o sede..."
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-primary outline-none font-bold transition-all text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
                        {(['TUTTI', 'IN_CORSO', 'COMPLETATI'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista Cards Orizzontali */}
            <div className="flex flex-col gap-6">
                {filteredTornei.length > 0 ? (
                    filteredTornei.map((t: Torneo) => {
                        const prenotabile = isPrenotabile(t);
                        const dataInizio = new Date(t.dataInizio);

                        return (
                            <div
                                key={t.id}
                                className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group overflow-hidden"
                            >
                                <div className="flex flex-col md:flex-row">
                                    {/* Sinistra: Data Box */}
                                    <div className="md:w-32 bg-gray-50/50 border-r border-gray-100 flex flex-col items-center justify-center p-6 text-center shrink-0">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                                            {format(dataInizio, 'MMM', { locale: it })}
                                        </span>
                                        <span className="text-4xl font-black text-dark leading-none mb-1">
                                            {format(dataInizio, 'dd')}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400">
                                            {format(dataInizio, 'yyyy')}
                                        </span>
                                    </div>

                                    {/* Centro: Info */}
                                    <Link to={`/tornei/${t.id}`} className="flex-1 p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-50">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-black uppercase leading-tight group-hover:text-primary transition-colors">
                                                    {t.nome}
                                                </h3>
                                                {t.completato && (
                                                    <span className="bg-green-50 text-green-500 p-1.5 rounded-xl">
                                                        <Trophy className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-4 items-center">
                                                <div className="flex items-center gap-2 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                                                    <MapPin className="w-3.5 h-3.5 text-primary/50" />
                                                    {t.sede}
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                                                    <Users className="w-3.5 h-3.5 text-secondary/50" />
                                                    {t.tipologia}
                                                </div>
                                                {t.dataFine && t.dataFine !== t.dataInizio && (
                                                    <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[9px] tracking-widest">
                                                        <Calendar className="w-3 h-3" />
                                                        Al {format(new Date(t.dataFine), 'dd MMM yyyy', { locale: it })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Link>

                                    {/* Destra: Azioni */}
                                    <div className="md:w-64 p-8 flex flex-col justify-center gap-3 bg-gray-50/20">
                                        {(() => {
                                            const now = new Date();
                                            const dataFineTorneo = t.dataFine ? new Date(t.dataFine) : new Date(t.dataInizio);
                                            const dataScadenzaOffset = new Date(dataFineTorneo);
                                            dataScadenzaOffset.setDate(dataScadenzaOffset.getDate() + 2);
                                            const isScaduto2Giorni = now > dataScadenzaOffset;

                                            return (
                                                <>
                                                    {/* Locandine */}
                                                    {(() => {
                                                        const shortenSede = (nome: string) => {
                                                            const keywords = [' Via ', ' V.le ', ' Viale ', ' Piazza ', ' Corso ', ' Str. ', ' Strada '];
                                                            for (const kw of keywords) {
                                                                const idx = nome.toUpperCase().indexOf(kw.toUpperCase());
                                                                if (idx > 0) return nome.substring(0, idx).trim();
                                                            }
                                                            return nome.length > 22 ? nome.substring(0, 20) + '…' : nome;
                                                        };
                                                        const sediConLocandina = (t.sedi || []).filter(s => s.locandina);
                                                        const hasMain = !!t.locandina && !isScaduto2Giorni;
                                                        if (!hasMain && sediConLocandina.length === 0) return null;
                                                        return (
                                                            <>
                                                                {hasMain && (
                                                                    <a
                                                                        href={t.locandina!.startsWith('http') ? t.locandina! : `${API_BASE_URL}${t.locandina}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="w-full py-2.5 bg-white border border-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                                    >
                                                                        📄 {shortenSede(t.sede)}
                                                                    </a>
                                                                )}
                                                                {sediConLocandina.map(s => (
                                                                    <a
                                                                        key={s.id}
                                                                        href={s.locandina!.startsWith('http') ? s.locandina! : `${API_BASE_URL}${s.locandina}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="w-full py-2.5 bg-white border border-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                                    >
                                                                        📄 Locandina – {shortenSede(s.nome)}
                                                                    </a>
                                                                ))}
                                                            </>
                                                        );
                                                    })()}

                                                    {/* Vedi iscritti */}
                                                    {t.turni && t.turni.length > 0 && !isScaduto2Giorni && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                fetchIscritti(t.id);
                                                            }}
                                                            className="w-full py-2.5 bg-white border border-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                        >
                                                            {loadingIscritti[t.id] ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Users className="w-3.5 h-3.5" />
                                                            )}
                                                            {openIscritti[t.id] ? 'Chiudi Atleti' : 'Vedi Iscritti'}
                                                        </button>
                                                    )}

                                                    {/* Iscrizione / Classifica */}
                                                    {(() => {
                                                        const rawLink = (t.linkIscrizione || '').trim().toLowerCase();
                                                        const isDocument = rawLink.endsWith('.pdf') || 
                                                                         rawLink.includes('/uploads/') || 
                                                                         rawLink.includes('locandina') || 
                                                                         rawLink.includes('regolamento') ||
                                                                         /\.(pdf|jpg|jpeg|png|webp)(\?.*)?$/i.test(rawLink);

                                                        const isExternalLink = t.linkIscrizione && 
                                                                            t.linkIscrizione.trim() && 
                                                                            t.linkIscrizione !== t.locandina &&
                                                                            !isDocument;

                                                        if (!t.completato && !isScaduto2Giorni && t.mostraBottoneIscrizione) {
                                                            return (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/tornei/${t.id}/iscrizione`);
                                                                    }}
                                                                    className="w-full py-3 bg-secondary text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <UserPlus className="w-4 h-4" />
                                                                    Iscriviti
                                                                </button>
                                                            );
                                                        }

                                                        if (t.completato) {
                                                            return (
                                                                <Link
                                                                    to={`/tornei/${t.id}`}
                                                                    className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border-2 border-green-100 bg-green-50 text-green-600 hover:bg-green-100 transition-all"
                                                                >
                                                                    <Trophy className="w-4 h-4" />
                                                                    Classifica
                                                                </Link>
                                                            );
                                                        }

                                                        return (
                                                            <div className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-gray-100 bg-gray-50 text-gray-400 opacity-60">
                                                                {isScaduto2Giorni ? 'Archiviato' : 'Terminato'}
                                                            </div>
                                                        );
                                                    })()}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Sezione Iscritti Espandibile (Full width sotto) */}
                                {openIscritti[t.id] && iscrittiMap[t.id] && (
                                    <div className="px-8 pb-8 pt-4 border-t border-gray-50 bg-gray-50/10 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                <Users className="w-3 h-3" />
                                                Atleti Iscritti ({iscrittiMap[t.id].length})
                                            </h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                            {iscrittiMap[t.id].length > 0 ? (
                                                iscrittiMap[t.id].map((isc, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                        <div className="flex flex-col">
                                                            <span className="text-[12px] font-black uppercase text-dark">
                                                                {isc.giocatore.cognome} {isc.giocatore.nome}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                                {isc.giocatore.sesso}/{isc.giocatore.categoria}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 uppercase">
                                                                {format(new Date(isc.turno.orarioInizio), 'dd/MM HH:mm')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[10px] font-bold text-gray-300 italic py-2 col-span-full">Ancora nessun iscritto</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
                        <Trophy className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-gray-300 uppercase">Nessun torneo trovato</h3>
                        <p className="text-sm text-gray-200 font-bold mt-1">Prova a cambiare i filtri di ricerca.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tornei;
