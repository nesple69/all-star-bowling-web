import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import {
    Trophy, Calendar, MapPin, Download,
    ChevronLeft, Users, FileText, UserPlus, CheckCircle2,
    AlertCircle, Clock, Check, X, Award, Search, Loader2
} from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

interface Torneo {
    id: string;
    nome: string;
    tipologia: 'SINGOLO' | 'DOPPIO' | 'TRIS' | 'SQUADRA_4';
    sede: string;
    dataInizio: string;
    dataFine: string;
    completato: boolean;
    locandina?: string;
    linkIscrizione?: string;
    stagione: { nome: string };
    risultati: any[];
    turni: any[];
    mostraBottoneIscrizione: boolean;
    costoIscrizione: number;
    sedi: { id: string; nome: string; categorie: string[]; locandina?: string | null }[];
    torneoOrigine?: { id: string; nome: string } | null;
}

interface Disponibilita {
    id: string;
    giorno: string;
    orarioInizio: string;
    postiTotali: number;
    postiOccupati: number;
    postiRimanenti: number;
    sede?: { id: string; nome: string } | null;
}

interface SquadraPubblica {
    id: string;
    nomeSquadra: string;
    turnoId?: string | null;
    secondoTurnoId?: string | null;
    confermatoIl?: string | null;
    confermataDa?: { id: string; nome: string; cognome: string } | null;
    turno?: {
        giorno: string;
        orarioInizio: string;
        sede?: { nome: string } | null;
    } | null;
    secondoTurno?: {
        giorno: string;
        orarioInizio: string;
        sede?: { nome: string } | null;
    } | null;
    iscrizioni: {
        id: string;
        giocatore: {
            id: string;
            nome: string;
            cognome: string;
            categoria: string;
            mediaAttuale: number;
            sesso: string;
        };
    }[];
}

interface MieSquadreData {
    giocatore: {
        id: string;
        nome: string;
        cognome: string;
        numeroTessera?: string;
        categoria: string;
        certificatoMedicoScadenza: string | null;
        saldoAttuale: number;
    } | null;
    disponibilita: {
        id: string;
        stato: 'IN_ATTESA' | 'ASSEGNATO' | 'RISERVA' | 'RITIRATO';
        note?: string | null;
    } | null;
    squadra: SquadraPubblica | null;
}

interface AtletaDisponibile {
    id: string;
    giocatoreId: string;
    stato: string;
    createdAt: string;
    giocatore: {
        id: string;
        nome: string;
        cognome: string;
        categoria: string;
        mediaAttuale: number;
        sesso: string;
    };
}

const DettaglioTorneo: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();

    const [disponibilita, setDisponibilita] = useState<Disponibilita[]>([]);
    const [iscritti, setIscritti] = useState<any[]>([]);
    const [candidatiDisponibili, setCandidatiDisponibili] = useState<AtletaDisponibile[]>([]);
    const [squadreConfermate, setSquadreConfermate] = useState<SquadraPubblica[]>([]);
    const [mieSquadre, setMieSquadre] = useState<MieSquadreData | null>(null);

    // Gestione Accesso Atleta tramite Numero Tessera
    const [tesseraInput, setTesseraInput] = useState(() => {
        return localStorage.getItem('allstar_tessera') || user?.giocatore?.numeroTessera || '';
    });
    const [tesseraAttiva, setTesseraAttiva] = useState(() => {
        return localStorage.getItem('allstar_tessera') || user?.giocatore?.numeroTessera || '';
    });
    const [cercandoTessera, setCercandoTessera] = useState(false);
    const [erroreTessera, setErroreTessera] = useState('');

    const [activeTab, setActiveTab] = useState<'squadre' | 'turni' | 'iscritti' | 'disponibili'>('squadre');
    const [isLoading, setIsLoading] = useState(true);

    // Modale Scelta Turno Squadra
    const [modalTurnoOpen, setModalTurnoOpen] = useState(false);
    const [selectedTurnoId, setSelectedTurnoId] = useState('');
    const [selectedSecondoTurnoId, setSelectedSecondoTurnoId] = useState('');
    const [salvataggioTurno, setSalvataggioTurno] = useState(false);

    // Feedback
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; testo: string } | null>(null);
    const [azioneInCorso, setAzioneInCorso] = useState(false);

    const fetchTorneoData = async () => {
        const resTorneo = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}`);
        const resDisp = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/disponibilita`);
        setDisponibilita(resDisp.data);

        try {
            const resIscr = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/iscritti`);
            setIscritti(resIscr.data);
        } catch (err) {
            console.error('Errore iscritti:', err);
        }

        try {
            const resCand = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/disponibilita-atleti`);
            setCandidatiDisponibili(resCand.data);
        } catch (err) {
            console.error('Errore candidati:', err);
        }

        try {
            const resSquadre = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/squadre`);
            setSquadreConfermate(resSquadre.data);
        } catch (err) {
            console.error('Errore formazioni:', err);
        }

        setIsLoading(false);
        return {
            torneo: resTorneo.data as Torneo,
            disponibilita: resDisp.data as Disponibilita[]
        };
    };

    const { data, refetch: refetchTorneo } = useQuery({
        queryKey: ['torneoDetail', id],
        queryFn: fetchTorneoData,
        enabled: !!id
    });

    const torneo = data?.torneo;

    // Carica stato atleta per tornei a squadre (tramite tessera o login)
    const ricaricaMieSquadre = async (tesseraParam?: string) => {
        const tesseraDaUsare = (tesseraParam !== undefined ? tesseraParam : tesseraAttiva).trim();
        if (!id) return;
        if (!tesseraDaUsare && !token) {
            setMieSquadre(null);
            return;
        }

        try {
            const query = tesseraDaUsare ? `?tessera=${encodeURIComponent(tesseraDaUsare)}` : '';
            const res = await axios.get(`${API_BASE_URL}/api/tornei/${id}/mie-squadre${query}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setMieSquadre(res.data);
            if (res.data?.giocatore) {
                setErroreTessera('');
            }
        } catch (err) {
            console.error('Errore getMieSquadreTorneo:', err);
        }
    };

    // Auto-carica tessera se presente all'avvio
    useEffect(() => {
        const salvata = localStorage.getItem('allstar_tessera') || user?.giocatore?.numeroTessera;
        if (salvata && id) {
            setTesseraAttiva(salvata);
            setTesseraInput(salvata);
            ricaricaMieSquadre(salvata);
        } else if (token && id) {
            ricaricaMieSquadre();
        }
    }, [token, id, user?.giocatore?.numeroTessera]);

    // Imposta tab iniziale
    useEffect(() => {
        if (torneo?.tipologia === 'SINGOLO') {
            setActiveTab('turni');
        } else {
            setActiveTab('squadre');
        }
    }, [torneo?.tipologia]);

    const handleOpenIscrizione = (turnoId?: string) => {
        navigate(`/tornei/${id}/iscrizione${turnoId ? `?turnoId=${turnoId}` : ''}`);
    };

    // Ricerca / Accesso con Numero Tessera
    const handleCercaTessera = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const t = tesseraInput.trim().toUpperCase();
        if (!t) {
            setErroreTessera('Inserisci il tuo numero di tessera.');
            return;
        }

        setCercandoTessera(true);
        setErroreTessera('');
        try {
            const res = await axios.get(`${API_BASE_URL}/api/tornei/${id}/mie-squadre?tessera=${encodeURIComponent(t)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.data?.giocatore) {
                setErroreTessera(`Nessun atleta trovato con numero di tessera "${t}". Verifica e riprova.`);
                setMieSquadre(null);
            } else {
                setMieSquadre(res.data);
                setTesseraAttiva(t);
                localStorage.setItem('allstar_tessera', t);
            }
        } catch (err: any) {
            setErroreTessera(err.response?.data?.message || 'Errore nella verifica del numero di tessera.');
        } finally {
            setCercandoTessera(false);
        }
    };

    const handleCambiaTessera = () => {
        localStorage.removeItem('allstar_tessera');
        setTesseraAttiva('');
        setTesseraInput('');
        setMieSquadre(null);
        setErroreTessera('');
    };

    // Azione Atleta: Dai Disponibilità
    const handleDaiDisponibilita = async () => {
        const tesseraDaUsare = (tesseraAttiva || localStorage.getItem('allstar_tessera') || '').trim();
        if (!tesseraDaUsare && !token) {
            setFeedback({ tipo: 'error', testo: 'Inserisci il tuo numero di tessera prima di dare la disponibilità.' });
            return;
        }

        setAzioneInCorso(true);
        setFeedback(null);
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/tornei/${id}/disponibilita`,
                { numeroTessera: tesseraDaUsare },
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            setFeedback({ tipo: 'success', testo: res.data.message || 'Disponibilità registrata!' });
            await Promise.all([ricaricaMieSquadre(tesseraDaUsare), refetchTorneo()]);
        } catch (err: any) {
            setFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore nella registrazione della disponibilità.'
            });
        } finally {
            setAzioneInCorso(false);
        }
    };

    // Azione Atleta: Ritira Disponibilità
    const handleRitiraDisponibilita = async () => {
        const tesseraDaUsare = (tesseraAttiva || localStorage.getItem('allstar_tessera') || '').trim();
        if (!window.confirm('Sei sicuro di voler ritirare la tua disponibilità per questo torneo?')) {
            return;
        }

        setAzioneInCorso(true);
        setFeedback(null);
        try {
            const res = await axios.delete(`${API_BASE_URL}/api/tornei/${id}/disponibilita`, {
                data: { numeroTessera: tesseraDaUsare },
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setFeedback({ tipo: 'success', testo: res.data.message || 'Disponibilità ritirata.' });
            await Promise.all([ricaricaMieSquadre(tesseraDaUsare), refetchTorneo()]);
        } catch (err: any) {
            setFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore nel ritiro della disponibilità.'
            });
        } finally {
            setAzioneInCorso(false);
        }
    };

    // Azione Atleta: Conferma Turno per la Squadra
    const handleConfermaTurnoSquadra = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mieSquadre?.squadra?.id || !selectedTurnoId) return;
        const tesseraDaUsare = (tesseraAttiva || localStorage.getItem('allstar_tessera') || '').trim();

        setSalvataggioTurno(true);
        setFeedback(null);
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/tornei/squadre/${mieSquadre.squadra.id}/scegli-turno`,
                {
                    turnoId: selectedTurnoId,
                    secondoTurnoId: selectedSecondoTurnoId || null,
                    numeroTessera: tesseraDaUsare
                },
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            setFeedback({ tipo: 'success', testo: res.data.message || 'Turno assegnato con successo alla squadra!' });
            setModalTurnoOpen(false);
            await Promise.all([ricaricaMieSquadre(tesseraDaUsare), refetchTorneo()]);
        } catch (err: any) {
            setFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore nella scelta del turno.'
            });
        } finally {
            setSalvataggioTurno(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!torneo) return <div className="text-center py-20 font-black uppercase text-gray-300">Torneo non trovato</div>;

    const isScaduto2Giorni = differenceInDays(new Date(torneo.dataInizio), new Date()) <= -2;
    const isTorneoASquadre = torneo.tipologia !== 'SINGOLO';

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 text-dark">
            {/* Nav & Action */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <Link to="/tornei" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-black uppercase text-xs tracking-widest group">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Tutti i tornei
                </Link>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {torneo.locandina && (
                        <a
                            href={torneo.locandina.startsWith('http') ? torneo.locandina : `${API_BASE_URL}${torneo.locandina}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Scarica Locandina
                        </a>
                    )}

                    {/* Per il SINGOLO: pulsante classico d'iscrizione */}
                    {!isTorneoASquadre && torneo.mostraBottoneIscrizione && !torneo.completato && !isScaduto2Giorni && (
                        <button
                            onClick={() => handleOpenIscrizione(torneo.turni[0]?.id || '')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-secondary text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-secondary/20 hover:scale-105 transition-all"
                        >
                            <UserPlus className="w-4 h-4" />
                            Iscriviti Ora
                        </button>
                    )}
                </div>
            </div>

            {/* Feedback Alert */}
            {feedback && (
                <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold uppercase tracking-wide border shadow-sm ${
                    feedback.tipo === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.tipo === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{feedback.testo}</span>
                    </div>
                    <button onClick={() => setFeedback(null)} className="text-[10px] underline font-black ml-4">Chiudi</button>
                </div>
            )}

            {/* Hero Section */}
            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/10">
                            {torneo.stagione.nome}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                            {torneo.tipologia.replace('_', ' ')}
                        </span>
                        {isTorneoASquadre && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-200">
                                Gara a Squadre con Coach
                            </span>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">{torneo.nome}</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="flex items-center gap-4 group">
                            <div className="p-4 bg-gray-50 rounded-3xl group-hover:bg-primary/5 transition-colors">
                                <Calendar className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periodo Svolgimento</p>
                                <p className="font-black text-gray-700 uppercase">
                                    {format(new Date(torneo.dataInizio), 'dd MMMM', { locale: it })}
                                    {torneo.dataFine && torneo.dataFine !== torneo.dataInizio && (
                                        <> - {format(new Date(torneo.dataFine), 'dd MMMM yyyy', { locale: it })}</>
                                    )}
                                    {(!torneo.dataFine || torneo.dataFine === torneo.dataInizio) && (
                                        <> {format(new Date(torneo.dataInizio), 'yyyy', { locale: it })}</>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group">
                            <div className="p-4 bg-gray-50 rounded-3xl group-hover:bg-primary/5 transition-colors">
                                <MapPin className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sedi di Gara</p>
                                {torneo.sedi && torneo.sedi.length > 0 ? (
                                    <div className="space-y-2 mt-1">
                                        {torneo.sedi.map((s, idx) => (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-gray-700 uppercase text-sm leading-tight">{s.nome}</span>
                                                    {s.categorie && s.categorie.length > 0 && (
                                                        <span className="text-[9px] font-black bg-primary/5 text-primary/70 px-2 py-0.5 rounded border border-primary/10">
                                                            {s.categorie.join(', ')}
                                                        </span>
                                                    )}
                                                    {s.locandina && (
                                                        <a 
                                                            href={s.locandina.startsWith('http') ? s.locandina : `${API_BASE_URL}${s.locandina}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 px-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5 group/loc"
                                                        >
                                                            <FileText className="w-3 h-3 group-hover/loc:scale-110 transition-transform" />
                                                            <span className="text-[8px] font-black uppercase tracking-tighter">Locandina</span>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="font-black text-gray-700 uppercase">{torneo.sede}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEZIONE SPECIALE: WORKFLOW DISPONIBILITÀ E SQUADRA DELL'ATLETA LOGGATO */}
            {isTorneoASquadre && !torneo.completato && (
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-widest">
                                <Award className="w-4 h-4" />
                                <span>Iscrizione per Gare a Squadre</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-1">
                                La tua Partecipazione ({torneo.tipologia.replace('_', ' ')})
                            </h2>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Quota Torneo Atleta</span>
                            <span className="text-xl sm:text-2xl font-black text-amber-300">€{Number(torneo.costoIscrizione || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    {!mieSquadre?.giocatore ? (
                        <div className="bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/15 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-400 text-slate-950 rounded-xl shrink-0">
                                    <Search className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm sm:text-base uppercase text-white">
                                        Accedi con il tuo Numero di Tessera FISB
                                    </h3>
                                    <p className="text-xs text-slate-300 font-medium">
                                        Inserisci la tua tessera per dare la disponibilità o per gestire la tua formazione.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleCercaTessera} className="flex flex-col sm:flex-row gap-3 pt-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={tesseraInput}
                                        onChange={(e) => setTesseraInput(e.target.value.toUpperCase())}
                                        placeholder="ES. AA9689, AC3818..."
                                        className="w-full bg-slate-950/70 border-2 border-white/20 focus:border-amber-400 rounded-xl px-4 py-3 text-white placeholder-slate-500 font-mono font-bold uppercase tracking-wider text-sm outline-none transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={cercandoTessera || !tesseraInput.trim()}
                                    className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
                                >
                                    {cercandoTessera ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    <span>Verifica Tessera</span>
                                </button>
                            </form>

                            {erroreTessera && (
                                <div className="p-3.5 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    <span>{erroreTessera}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Barra Identificazione Atleta */}
                            <div className="bg-white/10 backdrop-blur-md px-4 sm:px-6 py-3 rounded-2xl border border-white/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
                                        {mieSquadre.giocatore.categoria || 'A'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-white uppercase text-sm sm:text-base">
                                                {mieSquadre.giocatore.nome} {mieSquadre.giocatore.cognome}
                                            </span>
                                            <span className="text-amber-300 font-mono text-xs font-black bg-amber-400/10 px-2 py-0.5 rounded border border-amber-300/30">
                                                {mieSquadre.giocatore.numeroTessera}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            Saldo Borsellino: <strong className="text-white">€{Number(mieSquadre.giocatore.saldoAttuale || 0).toFixed(2)}</strong>
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCambiaTessera}
                                    className="text-[11px] text-slate-300 hover:text-amber-300 font-bold uppercase tracking-wider underline hover:no-underline transition-colors"
                                >
                                    Non sei tu? Cambia tessera
                                </button>
                            </div>

                            {/* STATO 1: L'atleta non ha ancora dato disponibilità e non è in squadra */}
                            {!mieSquadre?.disponibilita && !mieSquadre?.squadra && (() => {
                                const costoQuota = Number(torneo.costoIscrizione || 0);
                                const saldo = Number(mieSquadre.giocatore.saldoAttuale || 0);
                                const isSaldoSufficiente = costoQuota <= 0 || saldo >= costoQuota;

                                const dataInizioTorneo = torneo.dataInizio ? new Date(torneo.dataInizio) : new Date();
                                const isCertificatoValido = mieSquadre.giocatore.certificatoMedicoScadenza
                                    ? new Date(mieSquadre.giocatore.certificatoMedicoScadenza) >= dataInizioTorneo
                                    : false;

                                const canPartecipare = isCertificatoValido && isSaldoSufficiente;

                                return (
                                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 space-y-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            <div>
                                                <p className="font-black text-sm uppercase text-white">
                                                    Vuoi partecipare a questa gara di {torneo.tipologia.replace('_', ' ')}?
                                                </p>
                                                <p className="text-xs text-slate-300 font-medium mt-1">
                                                    Dai la tua disponibilità: verrai inserito nell'elenco per il Coach, che comporrà le formazioni ufficiali.
                                                </p>
                                            </div>

                                            <button
                                                onClick={handleDaiDisponibilita}
                                                disabled={azioneInCorso || !canPartecipare}
                                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all transform hover:scale-105 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                            >
                                                {azioneInCorso ? 'Registrazione...' : 'Do la mia disponibilità'}
                                            </button>
                                        </div>

                                        {/* Avvisi Certificato o Saldo */}
                                        {!isCertificatoValido && (
                                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                                <span>
                                                    Certificato medico scaduto o non registrato ({mieSquadre.giocatore.certificatoMedicoScadenza ? format(new Date(mieSquadre.giocatore.certificatoMedicoScadenza), 'dd/MM/yyyy') : 'assente'}). È necessario rinnovarlo prima di partecipare.
                                                </span>
                                            </div>
                                        )}

                                        {!isSaldoSufficiente && (
                                            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-bold flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                                <span>
                                                    Saldo borsellino insufficiente: hai €{saldo.toFixed(2)}, la quota del torneo è €{costoQuota.toFixed(2)}. Ricarica il borsellino per dare disponibilità.
                                                </span>
                                            </div>
                                        )}

                                        {/* Promemoria per il giocatore sul borsellino e certificato */}
                                        <div className="pt-3 border-t border-white/10 flex flex-wrap gap-4 text-[10px] text-slate-300">
                                            <span className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                                                Quota Torneo: <strong>€{costoQuota.toFixed(2)}</strong> (verrà scalata dal borsellino solo quando il Coach confermerà la squadra)
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <CheckCircle2 className={`w-3.5 h-3.5 ${isCertificatoValido ? 'text-emerald-400' : 'text-red-400'}`} />
                                                Certificato Medico: <strong>{isCertificatoValido ? 'In regola' : 'Da rinnovare'}</strong>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* STATO 2: Disponibilità data, in attesa del Coach */}
                            {mieSquadre?.disponibilita?.stato === 'IN_ATTESA' && !mieSquadre?.squadra && (
                                <div className="bg-amber-400/15 border border-amber-300/40 p-6 rounded-2xl space-y-3">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-amber-400 text-slate-950 rounded-xl">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-sm uppercase text-amber-300">
                                                    Disponibilità Registrata con Successo!
                                                </h3>
                                                <p className="text-xs text-slate-300 font-medium">
                                                    Sei nella lista atleti disponibili. Il Coach sta componendo le squadre.
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleRitiraDisponibilita}
                                            disabled={azioneInCorso}
                                            className="px-4 py-2 bg-white/10 hover:bg-red-500/20 text-red-300 border border-red-400/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                                        >
                                            Ritira Disponibilità
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STATO 3: Assegnato a una Squadra Confermata dal Coach */}
                            {mieSquadre?.squadra && (
                                <div className="bg-emerald-950/60 border border-emerald-400/40 p-6 rounded-2xl space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block">
                                                {torneo.torneoOrigine ? 'Formazione Confermata (Ereditata dalla 1^ Fase)' : 'La tua Formazione Assegnata dal Coach'}
                                            </span>
                                            <h3 className="font-black text-xl uppercase text-white tracking-tight">
                                                {mieSquadre.squadra.nomeSquadra}
                                            </h3>
                                        </div>

                                        {/* Stato scelta turni */}
                                        {!mieSquadre.squadra.turnoId ? (
                                            <button
                                                onClick={() => {
                                                    setSelectedTurnoId(disponibilita[0]?.id || '');
                                                    setSelectedSecondoTurnoId('');
                                                    setModalTurnoOpen(true);
                                                }}
                                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all hover:scale-105"
                                            >
                                                Scegli Turni di Gioco per la Squadra
                                            </button>
                                        ) : (
                                            <div className="text-right">
                                                <span className="px-3 py-1 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 rounded-lg text-xs font-black uppercase flex items-center gap-1.5">
                                                    <Check className="w-3.5 h-3.5" />
                                                    Turni Confermati
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Componenti della Formazione */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
                                        {mieSquadre.squadra.iscrizioni.map((isc, idx) => (
                                            <div key={idx} className="bg-white/10 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                                                <span className="font-black uppercase text-xs text-white">
                                                    {isc.giocatore.cognome} {isc.giocatore.nome}
                                                </span>
                                                <span className="text-[9px] font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                                    Cat. {isc.giocatore.categoria}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Riepilogo Turni Scelti */}
                                    {mieSquadre.squadra.turnoId ? (
                                        <div className="pt-3 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-200 font-medium">
                                            <span>
                                                Turno Principale: <strong className="text-amber-300">{format(new Date(mieSquadre.squadra.turno?.orarioInizio || 0), 'EEEE dd MMMM HH:mm', { locale: it })}</strong>
                                            </span>
                                            {mieSquadre.squadra.secondoTurno && (
                                                <span>
                                                    Turno Riserva: <strong>{format(new Date(mieSquadre.squadra.secondoTurno.orarioInizio), 'dd/MM HH:mm')}</strong>
                                                </span>
                                            )}
                                            {mieSquadre.squadra.confermataDa && (
                                                <span className="text-slate-400">
                                                    (Confermato da: {mieSquadre.squadra.confermataDa.nome} {mieSquadre.squadra.confermataDa.cognome})
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-amber-200/80 italic font-medium">
                                            ⚠️ Nota: Uno qualsiasi dei compagni di squadra può selezionare il turno preferito e il turno di riserva. Una volta confermata, la scelta è definitiva e bloccata per tutta la formazione.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* SEZIONE CONTENUTI TAB (FORMAZIONI / TURNI / CANDIDATI) */}
            {torneo.completato ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden p-8 text-center text-gray-400 uppercase font-black">
                    Torneo Completato
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Barra Pulsanti Tab */}
                    <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-100 self-start w-fit shadow-sm gap-1">
                        {isTorneoASquadre && (
                            <button
                                onClick={() => setActiveTab('squadre')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === 'squadre' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Formazioni Ufficiali ({squadreConfermate.length})
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab('turni')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === 'turni' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            Turni e Disponibilità Posti
                        </button>

                        {isTorneoASquadre && (
                            <button
                                onClick={() => setActiveTab('disponibili')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === 'disponibili' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Atleti Disponibili ({candidatiDisponibili.length})
                            </button>
                        )}

                        {!isTorneoASquadre && (
                            <button
                                onClick={() => setActiveTab('iscritti')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === 'iscritti' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Iscritti ({iscritti.length})
                            </button>
                        )}
                    </div>

                    {/* VISTA 1: FORMAZIONI CONFERMATE DAL COACH (DOPPIO, TRIS, SQUADRA) */}
                    {activeTab === 'squadre' && isTorneoASquadre && (
                        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 shadow-sm animate-fade-in space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2.5 text-dark">
                                        <Trophy className="text-amber-500 w-6 h-6" />
                                        <span>Formazioni Ufficiali Confermate ({squadreConfermate.length})</span>
                                    </h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                                        Squadre ufficiali formate dal Coach per questo torneo
                                    </p>
                                </div>
                            </div>

                            {squadreConfermate.length === 0 ? (
                                <div className="text-center py-16 text-gray-400 space-y-2">
                                    <Users className="w-10 h-10 text-gray-300 mx-auto" />
                                    <p className="text-xs font-bold uppercase tracking-wider">
                                        Il Coach non ha ancora confermato le formazioni per questo torneo.
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                        Non appena il Coach pubblicherà le squadre, saranno visibili qui con i relativi atleti e turni di gioco.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {squadreConfermate.map((sq) => {
                                        const haSceltoTurno = !!sq.turnoId;
                                        return (
                                            <div
                                                key={sq.id}
                                                className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200/90 space-y-4 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                                    <h3 className="font-black text-base uppercase text-primary tracking-tight">
                                                        {sq.nomeSquadra}
                                                    </h3>
                                                    <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                                                        {sq.iscrizioni.length} Atleti
                                                    </span>
                                                </div>

                                                {/* Atleti della squadra */}
                                                <div className="space-y-1.5">
                                                    {sq.iscrizioni.map((isc, iIdx) => (
                                                        <div
                                                            key={iIdx}
                                                            className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl text-xs border border-gray-100"
                                                        >
                                                            <span className="font-black uppercase text-dark">
                                                                {isc.giocatore.cognome} {isc.giocatore.nome}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase">
                                                                Cat. {isc.giocatore.categoria} ({isc.giocatore.sesso})
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Stato Turno di Gioco */}
                                                <div className="pt-2 border-t border-gray-200">
                                                    {haSceltoTurno ? (
                                                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-1 text-xs">
                                                            <div className="flex items-center gap-1.5 text-emerald-800 font-black uppercase text-[10px]">
                                                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Turno Confermato</span>
                                                            </div>
                                                            <p className="font-black text-slate-800">
                                                                {format(new Date(sq.turno?.orarioInizio || 0), 'EEEE dd MMMM HH:mm', { locale: it })}
                                                                {sq.turno?.sede ? ` (${sq.turno.sede.nome})` : ''}
                                                            </p>
                                                            {sq.secondoTurno && (
                                                                <p className="text-[10px] text-gray-500 font-medium">
                                                                    Riserva: {format(new Date(sq.secondoTurno.orarioInizio), 'dd/MM HH:mm')}
                                                                </p>
                                                            )}
                                                            {sq.confermataDa && (
                                                                <p className="text-[10px] text-gray-400">
                                                                    Scelto da: {sq.confermataDa.nome} {sq.confermataDa.cognome}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-bold uppercase">
                                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                                            <span>In attesa che un componente scelga i turni</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VISTA 2: TURNI E DISPONIBILITA' POSTI */}
                    {activeTab === 'turni' && (
                        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 shadow-sm animate-fade-in space-y-6">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-dark">
                                <Users className="text-secondary w-6 h-6" />
                                Turni di Gioco Ufficiali
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {disponibilita.map((t) => {
                                    const isEsaurito = t.postiRimanenti <= 0;
                                    return (
                                        <div key={t.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/60 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                        {format(new Date(t.giorno.replace('Z', '')), 'EEEE dd MMMM', { locale: it })}
                                                    </p>
                                                    <p className="font-black text-lg text-dark">
                                                        {format(new Date(t.orarioInizio.replace('Z', '')), 'HH:mm')}
                                                    </p>
                                                    {t.sede && (
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                                                            {t.sede.nome}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Posti Liberi</p>
                                                    <p className={`font-black ${isEsaurito ? 'text-red-500' : 'text-secondary'}`}>
                                                        {t.postiRimanenti} / {t.postiTotali}
                                                    </p>
                                                </div>
                                            </div>

                                            {!isTorneoASquadre && (
                                                <button
                                                    disabled={isEsaurito}
                                                    onClick={() => handleOpenIscrizione(t.id)}
                                                    className={`w-full py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                                                        isEsaurito ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white shadow-md hover:scale-105'
                                                    }`}
                                                >
                                                    {isEsaurito ? 'Esaurito' : 'Iscriviti a questo turno'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* VISTA 3: LISTA ATLETI DISPONIBILI */}
                    {activeTab === 'disponibili' && isTorneoASquadre && (
                        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 shadow-sm animate-fade-in space-y-6">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-dark">
                                    <Award className="text-amber-500 w-6 h-6" />
                                    Lista Disponibilità Atleti ({candidatiDisponibili.length})
                                </h2>
                                <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                                    Atleti che hanno espresso disponibilità a giocare questo torneo
                                </p>
                            </div>

                            {candidatiDisponibili.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 italic uppercase text-xs font-bold tracking-widest">
                                    Nessun atleta ha ancora dato disponibilità per questo torneo.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {candidatiDisponibili.map((c) => (
                                        <div key={c.id} className="bg-gray-50/70 p-3.5 rounded-2xl border border-gray-100 flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <p className="font-black text-xs uppercase text-dark">
                                                    {c.giocatore.cognome} {c.giocatore.nome}
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">
                                                    Cat. {c.giocatore.categoria} • {c.giocatore.sesso}
                                                </p>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                                c.stato === 'ASSEGNATO'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : c.stato === 'RISERVA'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {c.stato === 'ASSEGNATO' ? 'In Squadra' : c.stato === 'RISERVA' ? 'Riserva' : 'In Attesa'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VISTA 4: ISCRITTI INDIVIDUALI (SOLO SINGOLO) */}
                    {activeTab === 'iscritti' && !isTorneoASquadre && (
                        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 shadow-sm animate-fade-in space-y-6">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-dark">
                                <Users className="text-primary w-6 h-6" />
                                Atleti Iscritti ({iscritti.length})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {iscritti.map((isc: any, idx: number) => (
                                    <div key={idx} className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <p className="font-black text-xs uppercase text-dark">
                                            {isc.giocatore.cognome} {isc.giocatore.nome}
                                        </p>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                            Cat. {isc.giocatore.categoria}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODALE: SCELTA TURNI DI GIOCO PER LA SQUADRA */}
            {modalTurnoOpen && mieSquadre?.squadra && (
                <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
                                    {mieSquadre.squadra.nomeSquadra}
                                </span>
                                <h3 className="text-xl font-black uppercase tracking-tight text-dark">
                                    Scegli i Turni di Gioco
                                </h3>
                            </div>
                            <button
                                onClick={() => setModalTurnoOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleConfermaTurnoSquadra} className="space-y-5">
                            {/* Turno Principale */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-gray-500">
                                    Turno Principale (Scelta Preferita) *
                                </label>
                                <select
                                    value={selectedTurnoId}
                                    onChange={(e) => setSelectedTurnoId(e.target.value)}
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold text-dark focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                                >
                                    <option value="" disabled>Seleziona Turno...</option>
                                    {disponibilita.map((t) => {
                                        const postiLiberi = t.postiRimanenti;
                                        const isEsaurito = postiLiberi < (mieSquadre.squadra?.iscrizioni?.length || 2);
                                        return (
                                            <option key={t.id} value={t.id} disabled={isEsaurito}>
                                                {format(new Date(t.giorno.replace('Z', '')), 'EEE dd/MM', { locale: it })} ore {format(new Date(t.orarioInizio.replace('Z', '')), 'HH:mm')}
                                                {t.sede ? ` - ${t.sede.nome}` : ''} ({postiLiberi} posti liberi) {isEsaurito ? '- ESAURITO' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Turno di Riserva */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-gray-500">
                                    Turno di Riserva (Opzionale / Consigliato)
                                </label>
                                <select
                                    value={selectedSecondoTurnoId}
                                    onChange={(e) => setSelectedSecondoTurnoId(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold text-dark focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                                >
                                    <option value="">Nessun turno di riserva</option>
                                    {disponibilita.filter(t => t.id !== selectedTurnoId).map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {format(new Date(t.giorno.replace('Z', '')), 'EEE dd/MM', { locale: it })} ore {format(new Date(t.orarioInizio.replace('Z', '')), 'HH:mm')}
                                            {t.sede ? ` - ${t.sede.nome}` : ''} ({t.postiRimanenti} posti)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                                <p className="font-bold uppercase">⚠️ Attenzione:</p>
                                <p>Una volta confermata la scelta del turno, questa sarà bloccata per tutta la tua squadra e nessun altro compagno potrà modificarla.</p>
                                {torneo && Number(torneo.costoIscrizione || 0) > 0 && (
                                    <p className="text-amber-800 font-bold mt-1">
                                        💳 Confermando il turno per la squadra, verrà scalata la quota di partecipazione di €{Number(torneo.costoIscrizione).toFixed(2)} dal borsellino di ciascun componente della formazione.
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalTurnoOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold uppercase text-xs rounded-xl transition-all"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvataggioTurno || !selectedTurnoId}
                                    className="flex-2 py-3 bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
                                >
                                    {salvataggioTurno ? 'Salvataggio...' : 'Conferma Turni per la Squadra'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DettaglioTorneo;
