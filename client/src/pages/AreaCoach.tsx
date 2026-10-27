import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import {
    Users, Trophy, CheckCircle2, AlertCircle, Plus, Trash2,
    ShieldCheck, Clock, RefreshCw, Eye, Edit3, Award
} from 'lucide-react';
import { format } from 'date-fns';

interface GiocatoreDisponibile {
    id: string;
    nome: string;
    cognome: string;
    categoria: string;
    mediaAttuale: number;
    sesso: string;
    isSenior?: boolean;
    fasciaSenior?: string;
    saldo?: {
        saldoAttuale: number;
    };
}

interface DisponibilitaItem {
    id: string;
    torneoId: string;
    giocatoreId: string;
    stato: 'IN_ATTESA' | 'ASSEGNATO' | 'RISERVA' | 'RITIRATO';
    note?: string | null;
    createdAt: string;
    giocatore: GiocatoreDisponibile;
}

interface SquadraFormata {
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

interface TorneoCoach {
    id: string;
    nome: string;
    tipologia: 'SINGOLO' | 'DOPPIO' | 'TRIS' | 'SQUADRA_4';
    costoIscrizione: number;
    dataInizio: string;
    completato: boolean;
    turni: any[];
    torneoOrigineId?: string | null;
    torneoOrigine?: { id: string; nome: string } | null;
}

interface BozzaSquadra {
    tempId: string;
    nomeSquadra: string;
    giocatoreIds: string[];
}

const AreaCoach: React.FC = () => {
    const { token } = useAuth();
    const [tornei, setTornei] = useState<TorneoCoach[]>([]);
    const [selectedTorneoId, setSelectedTorneoId] = useState<string>('');
    const [loadingTornei, setLoadingTornei] = useState(true);

    const [torneoCorrente, setTorneoCorrente] = useState<TorneoCoach | null>(null);
    const [disponibili, setDisponibili] = useState<DisponibilitaItem[]>([]);
    const [squadrePubblicate, setSquadrePubblicate] = useState<SquadraFormata[]>([]);
    const [loadingDettaglio, setLoadingDettaglio] = useState(false);

    // Tab attivo nel pannello Coach: 'componi' o 'confermate'
    const [vistaAttiva, setVistaAttiva] = useState<'componi' | 'confermate'>('componi');

    // Bozza formazioni create dal Coach in locale prima dell'invio
    const [bozzaSquadre, setBozzaSquadre] = useState<BozzaSquadra[]>([]);
    const [riserveIds, setRiserveIds] = useState<string[]>([]);
    const [filtroCategoria, setFiltroCategoria] = useState<string>('TUTTE');
    const [cercaAtleta, setCercaAtleta] = useState<string>('');

    const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
    const [messaggioFeedback, setMessaggioFeedback] = useState<{ tipo: 'success' | 'error'; testo: string } | null>(null);

    // 1. Carica lista tornei a squadre
    useEffect(() => {
        const fetchTornei = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/tornei/public`);
                const nonSingoli = (res.data || []).filter(
                    (t: TorneoCoach) => t.tipologia !== 'SINGOLO' && !t.completato
                );
                setTornei(nonSingoli);
                if (nonSingoli.length > 0) {
                    setSelectedTorneoId(nonSingoli[0].id);
                }
            } catch (err) {
                console.error('Errore caricamento tornei:', err);
            } finally {
                setLoadingTornei(false);
            }
        };
        fetchTornei();
    }, []);

    // 2. Carica dettagli del torneo selezionato (candidati e squadre formate)
    const ricaricaDatiTorneo = async (torneoId: string) => {
        if (!torneoId || !token) return;
        setLoadingDettaglio(true);
        setMessaggioFeedback(null);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/coach/tornei/${torneoId}/formazioni`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const tData = res.data.torneo;
            const sqPub = res.data.squadre || [];
            setTorneoCorrente(tData);
            setDisponibili(res.data.disponibili || []);
            setSquadrePubblicate(sqPub);
            setBozzaSquadre([]);
            setRiserveIds([]);
            if (sqPub.length > 0) {
                setVistaAttiva('confermate');
            }
        } catch (err: any) {
            console.error('Errore getFormazioniCoach:', err);
            setMessaggioFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore nel caricamento dei dati del torneo.'
            });
        } finally {
            setLoadingDettaglio(false);
        }
    };

    useEffect(() => {
        if (selectedTorneoId) {
            ricaricaDatiTorneo(selectedTorneoId);
        }
    }, [selectedTorneoId, token]);

    // Numero atleti richiesti per squadra
    const getTargetCount = () => {
        if (!torneoCorrente) return 2;
        if (torneoCorrente.tipologia === 'DOPPIO') return 2;
        if (torneoCorrente.tipologia === 'TRIS') return 3;
        if (torneoCorrente.tipologia === 'SQUADRA_4') return 4;
        return 2;
    };

    const targetAtletiPerSquadra = getTargetCount();

    // Atleti disponibili che non sono ancora assegnati a squadre pubblicate né in bozza
    const atletiAssegnatiInBozza = new Set(bozzaSquadre.flatMap(b => b.giocatoreIds));
    const atletiAssegnatiPubblicati = new Set(
        squadrePubblicate.flatMap(s => s.iscrizioni.map(i => i.giocatore.id))
    );

    const atletiLiberi = disponibili.filter(d => {
        const id = d.giocatore.id;
        return !atletiAssegnatiPubblicati.has(id) && !atletiAssegnatiInBozza.has(id);
    });

    const atletiFiltrati = atletiLiberi.filter(d => {
        const matchCat = filtroCategoria === 'TUTTE' || d.giocatore.categoria === filtroCategoria;
        const matchSearch =
            d.giocatore.nome.toLowerCase().includes(cercaAtleta.toLowerCase()) ||
            d.giocatore.cognome.toLowerCase().includes(cercaAtleta.toLowerCase());
        return matchCat && matchSearch;
    });

    // Funzione: Crea nuova bozza squadra
    const handleCreaNuovaBozza = () => {
        const numeroProssima = squadrePubblicate.length + bozzaSquadre.length + 1;
        const prefisso = torneoCorrente?.tipologia === 'DOPPIO' ? 'Doppio' : torneoCorrente?.tipologia === 'TRIS' ? 'Tris' : 'Squadra';
        const nuovaBozza: BozzaSquadra = {
            tempId: `temp_${Date.now()}`,
            nomeSquadra: `All Star ${prefisso} ${numeroProssima}`,
            giocatoreIds: []
        };
        setBozzaSquadre([...bozzaSquadre, nuovaBozza]);
    };

    // Funzione: Aggiungi atleta a una squadra in bozza
    const handleAggiungiAtletaASquadra = (tempId: string, giocatoreId: string) => {
        setBozzaSquadre(prev => prev.map(sq => {
            if (sq.tempId === tempId) {
                if (sq.giocatoreIds.length >= targetAtletiPerSquadra) return sq;
                if (sq.giocatoreIds.includes(giocatoreId)) return sq;
                return { ...sq, giocatoreIds: [...sq.giocatoreIds, giocatoreId] };
            }
            return sq;
        }));
    };

    // Funzione: Rimuovi atleta da una bozza
    const handleRimuoviAtletaDaBozza = (tempId: string, giocatoreId: string) => {
        setBozzaSquadre(prev => prev.map(sq => {
            if (sq.tempId === tempId) {
                return { ...sq, giocatoreIds: sq.giocatoreIds.filter(id => id !== giocatoreId) };
            }
            return sq;
        }));
    };

    // Funzione: Rimuovi intera squadra in bozza
    const handleEliminaBozza = (tempId: string) => {
        setBozzaSquadre(prev => prev.filter(sq => sq.tempId !== tempId));
    };

    // Funzione: Modifica nome squadra in bozza
    const handleModificaNomeSquadra = (tempId: string, nuovoNome: string) => {
        setBozzaSquadre(prev => prev.map(sq => sq.tempId === tempId ? { ...sq, nomeSquadra: nuovoNome } : sq));
    };

    // Funzione: Invia formazioni al server
    const handleConfermaEPubblica = async () => {
        if (!torneoCorrente || bozzaSquadre.length === 0) return;

        // Validazione: tutte le squadre devono essere complete
        for (const b of bozzaSquadre) {
            if (b.giocatoreIds.length !== targetAtletiPerSquadra) {
                setMessaggioFeedback({
                    tipo: 'error',
                    testo: `La squadra "${b.nomeSquadra}" è incompleta: ha ${b.giocatoreIds.length} atleti su ${targetAtletiPerSquadra} richiesti.`
                });
                return;
            }
            if (!b.nomeSquadra.trim()) {
                setMessaggioFeedback({
                    tipo: 'error',
                    testo: 'Tutte le squadre devono avere un nome valido.'
                });
                return;
            }
        }

        const totaleAtleti = bozzaSquadre.length * targetAtletiPerSquadra;

        const conferma = window.confirm(
            `Confermi la pubblicazione di ${bozzaSquadre.length} formazioni (${totaleAtleti} atleti in totale)?\n\nLe formazioni saranno subito visibili online per gli atleti e per la scelta dei turni!`
        );

        if (!conferma) return;

        setSalvataggioInCorso(true);
        setMessaggioFeedback(null);

        try {
            const payload = {
                squadre: bozzaSquadre.map(b => ({
                    nomeSquadra: b.nomeSquadra.trim(),
                    giocatoreIds: b.giocatoreIds
                })),
                riserveIds
            };

            const res = await axios.post(
                `${API_BASE_URL}/api/coach/tornei/${torneoCorrente.id}/conferma-squadre`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessaggioFeedback({
                tipo: 'success',
                testo: res.data.message || 'Formazioni pubblicate con successo!'
            });

            await ricaricaDatiTorneo(torneoCorrente.id);
            setVistaAttiva('confermate'); // Passa automaticamente alla vista formazioni confermate
        } catch (err: any) {
            console.error('Errore pubblicazione squadre:', err);
            setMessaggioFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore durante la pubblicazione delle squadre.'
            });
        } finally {
            setSalvataggioInCorso(false);
        }
    };

    // Funzione: Annulla squadra già pubblicata
    const handleAnnullaSquadraPubblicata = async (squadra: SquadraFormata) => {
        const conferma = window.confirm(
            `Sei sicuro di voler annullare la squadra "${squadra.nomeSquadra}"?\n\nLa disponibilità dei giocatori tornerà "IN ATTESA" e potranno essere ricollocati.`
        );
        if (!conferma) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/coach/squadre/${squadra.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessaggioFeedback({
                tipo: 'success',
                testo: `Squadra "${squadra.nomeSquadra}" annullata con successo.`
            });
            if (torneoCorrente) {
                await ricaricaDatiTorneo(torneoCorrente.id);
            }
        } catch (err: any) {
            console.error('Errore annullamento squadra:', err);
            setMessaggioFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore nell\'annullamento della squadra.'
            });
        }
    };

    const categorieUniche = ['TUTTE', 'A', 'B', 'C', 'D', 'ES', 'DS'];

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in text-slate-800">
            {/* Header Pagina */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Area Riservata Coach</span>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
                            Composizione Squadre & Formazioni
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm font-medium">
                            Seleziona gli atleti che hanno dato disponibilità, componi le coppie/squadre e pubblicale online.
                        </p>
                    </div>

                    {/* Torneo Selector */}
                    <div className="w-full md:w-auto min-w-[280px]">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Seleziona Torneo da Gestire
                        </label>
                        <select
                            value={selectedTorneoId}
                            onChange={(e) => setSelectedTorneoId(e.target.value)}
                            disabled={loadingTornei || tornei.length === 0}
                            className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold uppercase focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        >
                            {tornei.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.nome} ({t.tipologia.replace('_', ' ')})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Feedback Alert */}
            {messaggioFeedback && (
                <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold uppercase tracking-wide border shadow-sm ${
                    messaggioFeedback.tipo === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    <div className="flex items-center gap-2">
                        {messaggioFeedback.tipo === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{messaggioFeedback.testo}</span>
                    </div>
                    <button
                        onClick={() => setMessaggioFeedback(null)}
                        className="text-[10px] underline font-black ml-4"
                    >
                        Chiudi
                    </button>
                </div>
            )}

            {loadingDettaglio ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : !torneoCorrente ? (
                <div className="bg-white rounded-3xl p-12 text-center text-gray-400 font-bold uppercase text-xs">
                    Nessun torneo selezionato o disponibile per la gestione formazioni.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Statistiche Rapide Torneo (senza cifre in denaro) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Formato Torneo</span>
                            <span className="text-lg font-black text-primary uppercase">{torneoCorrente.tipologia.replace('_', ' ')}</span>
                            <span className="text-[10px] text-gray-500 font-medium block">({targetAtletiPerSquadra} atleti per squadra)</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Candidati Totali</span>
                            <span className="text-lg font-black text-amber-600">{disponibili.length}</span>
                            <span className="text-[10px] text-gray-500 font-medium block">hanno dato disponibilità</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Ancora Liberi</span>
                            <span className="text-lg font-black text-blue-600">{atletiLiberi.length}</span>
                            <span className="text-[10px] text-gray-500 font-medium block">da assegnare a una squadra</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Squadre Confermate</span>
                            <span className="text-lg font-black text-emerald-600">{squadrePubblicate.length}</span>
                            <span className="text-[10px] text-gray-500 font-medium block">pubblicate online</span>
                        </div>
                    </div>

                    {/* Avviso Torneo Collegato / Eredità Automatica */}
                    {(torneoCorrente.torneoOrigine || torneoCorrente.nome.toLowerCase().includes('2° fase') || torneoCorrente.nome.toLowerCase().includes('2^ fase')) && (
                        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 border border-blue-200/80 p-5 rounded-2xl flex items-start gap-3">
                            <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                                <Award className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-black text-xs uppercase tracking-wider text-blue-950">
                                    Formazioni Ereditate Automaticamente dalla 1^ Fase
                                </h3>
                                <p className="text-[11px] font-medium text-blue-900 leading-relaxed">
                                    Per questo torneo le formazioni sono sincronizzate e confermate in automatico dalla 1^ Fase (<strong>{torneoCorrente.torneoOrigine?.nome || 'Fase Precedente'}</strong>). Non è necessario comporre o confermare nuovamente le squadre: gli atleti possono accedere e confermare direttamente i turni di gioco desiderati.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Barra di Navigazione Tab del Coach */}
                    <div className="flex bg-white p-2 rounded-2xl border border-gray-100 shadow-sm gap-2">
                        <button
                            onClick={() => setVistaAttiva('componi')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                vistaAttiva === 'componi'
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            <Edit3 className="w-4 h-4" />
                            <span>Componi Squadre ({bozzaSquadre.length} in bozza)</span>
                        </button>

                        <button
                            onClick={() => setVistaAttiva('confermate')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                vistaAttiva === 'confermate'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            <Eye className="w-4 h-4" />
                            <span>Formazioni Confermate Online ({squadrePubblicate.length})</span>
                        </button>
                    </div>

                    {/* VISTA 1: COMPOSIZIONE FORMAZIONI (BOZZE E CANDIDATI) */}
                    {vistaAttiva === 'componi' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* COLONNA SINISTRA: Lista Atleti Disponibili (5 Colonne) */}
                            <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" />
                                        <span>Candidati Disponibili ({atletiLiberi.length})</span>
                                    </h2>
                                    <button
                                        onClick={() => ricaricaDatiTorneo(torneoCorrente.id)}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                        title="Ricarica elenco"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Filtri Categoria e Ricerca */}
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Cerca atleta per nome o cognome..."
                                        value={cercaAtleta}
                                        onChange={(e) => setCercaAtleta(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary"
                                    />

                                    <div className="flex flex-wrap gap-1">
                                        {categorieUniche.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setFiltroCategoria(cat)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                    filtroCategoria === cat
                                                        ? 'bg-primary text-white shadow-xs'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Lista Card Atleti */}
                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                                    {atletiFiltrati.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 font-bold uppercase text-xs">
                                            Nessun atleta disponibile trovato con questi filtri.
                                        </div>
                                    ) : (
                                        atletiFiltrati.map(d => {
                                            const g = d.giocatore;
                                            return (
                                                <div
                                                    key={g.id}
                                                    className="bg-gray-50/70 hover:bg-gray-100/70 p-3 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 transition-colors"
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-black text-xs uppercase text-dark">
                                                                {g.cognome} {g.nome}
                                                            </span>
                                                            <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.2 rounded">
                                                                Cat. {g.categoria}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-gray-400">
                                                                {g.sesso}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
                                                            <span>Media: <strong>{g.mediaAttuale ? g.mediaAttuale.toFixed(1) : '-'}</strong></span>
                                                        </div>
                                                    </div>

                                                    {/* Assegna a squadra */}
                                                    {bozzaSquadre.length > 0 ? (
                                                        <div className="shrink-0 flex items-center gap-1">
                                                            <select
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        handleAggiungiAtletaASquadra(e.target.value, g.id);
                                                                        e.target.value = '';
                                                                    }
                                                                }}
                                                                defaultValue=""
                                                                className="bg-white border border-gray-200 text-gray-800 text-[10px] font-black rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary uppercase cursor-pointer"
                                                            >
                                                                <option value="" disabled>+ Assegna a...</option>
                                                                {bozzaSquadre.map((b, bIdx) => (
                                                                    <option
                                                                        key={b.tempId}
                                                                        value={b.tempId}
                                                                        disabled={b.giocatoreIds.length >= targetAtletiPerSquadra}
                                                                    >
                                                                        Sq. {bIdx + 1} ({b.giocatoreIds.length}/{targetAtletiPerSquadra})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] font-bold uppercase text-gray-400 italic">
                                                            Crea prima una squadra
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* COLONNA DESTRA: Gestione Squadre in Bozza (7 Colonne) */}
                            <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm space-y-5">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-gray-100">
                                    <div>
                                        <h2 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                                            <Trophy className="w-5 h-5 text-amber-500" />
                                            <span>Componi Formazioni ({bozzaSquadre.length})</span>
                                        </h2>
                                        <p className="text-[11px] text-gray-400 font-bold uppercase">
                                            Componi le formazioni con gli atleti disponibili e premi Conferma Formazioni.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCreaNuovaBozza}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-md shrink-0 self-start sm:self-auto"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Aggiungi Squadra</span>
                                    </button>
                                </div>

                                {bozzaSquadre.length === 0 ? (
                                    <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 space-y-2">
                                        <Trophy className="w-10 h-10 text-gray-300 mx-auto" />
                                        <p className="text-sm font-bold uppercase">Nessuna squadra in composizione.</p>
                                        <p className="text-xs font-medium text-gray-400">Clicca sul pulsante "+ Aggiungi Squadra" per iniziare a formare i team.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {bozzaSquadre.map((b, bIdx) => {
                                            const isCompleta = b.giocatoreIds.length === targetAtletiPerSquadra;
                                            return (
                                                <div
                                                    key={b.tempId}
                                                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                                        isCompleta
                                                            ? 'bg-emerald-50/40 border-emerald-200'
                                                            : 'bg-gray-50/70 border-gray-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                                {bIdx + 1}
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={b.nomeSquadra}
                                                                onChange={(e) => handleModificaNomeSquadra(b.tempId, e.target.value)}
                                                                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-black uppercase text-dark w-full max-w-[240px] focus:outline-none focus:ring-1 focus:ring-primary"
                                                                placeholder="Nome Squadra..."
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                                isCompleta ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {b.giocatoreIds.length} / {targetAtletiPerSquadra} atleti
                                                            </span>
                                                            <button
                                                                onClick={() => handleEliminaBozza(b.tempId)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                                                title="Elimina squadra"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Slot Atleti per questa squadra */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {Array.from({ length: targetAtletiPerSquadra }).map((_, slotIdx) => {
                                                            const atletaId = b.giocatoreIds[slotIdx];
                                                            const itemDisp = disponibili.find(d => d.giocatore.id === atletaId);

                                                            return (
                                                                <div
                                                                    key={slotIdx}
                                                                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                                                        itemDisp
                                                                            ? 'bg-white border-gray-200'
                                                                            : 'bg-white/60 border-dashed border-gray-300 text-gray-400'
                                                                    }`}
                                                                >
                                                                    {itemDisp ? (
                                                                        <>
                                                                            <div className="truncate space-x-1.5">
                                                                                <span className="font-black uppercase text-dark">
                                                                                    {itemDisp.giocatore.cognome} {itemDisp.giocatore.nome}
                                                                                </span>
                                                                                <span className="text-[9px] font-bold text-gray-400">
                                                                                    ({itemDisp.giocatore.categoria})
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleRimuoviAtletaDaBozza(b.tempId, atletaId)}
                                                                                className="text-gray-400 hover:text-red-500 ml-1 p-0.5"
                                                                                title="Rimuovi da questa squadra"
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider italic">
                                                                            Slot {slotIdx + 1} vuoto
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Bottone Pubblicazione */}
                                        <div className="pt-3 border-t border-gray-100 flex justify-end">
                                            <button
                                                onClick={handleConfermaEPubblica}
                                                disabled={salvataggioInCorso}
                                                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>{salvataggioInCorso ? 'Pubblicazione in corso...' : 'Conferma e Pubblica Formazioni'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VISTA 2: FORMAZIONI CONFERMATE E PUBBLICATE */}
                    {vistaAttiva === 'confermate' && (
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        <span>Formazioni Ufficiali Online ({squadrePubblicate.length})</span>
                                    </h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase mt-0.5">
                                        Squadre visibili online agli atleti per la scelta del turno
                                    </p>
                                </div>
                                <button
                                    onClick={() => ricaricaDatiTorneo(torneoCorrente.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors self-start sm:self-auto"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Aggiorna Dati</span>
                                </button>
                            </div>

                            {squadrePubblicate.length === 0 ? (
                                <div className="p-12 text-center text-gray-400 font-bold uppercase text-xs">
                                    Nessuna formazione ancora confermata per questo torneo. Componile dal tab "Componi Squadre".
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {squadrePubblicate.map((sq) => {
                                        const haSceltoTurno = !!sq.turnoId;
                                        return (
                                            <div
                                                key={sq.id}
                                                className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200/80 space-y-4"
                                            >
                                                <div className="flex justify-between items-start gap-2 pb-2 border-b border-gray-200">
                                                    <div>
                                                        <h3 className="font-black text-base uppercase text-primary tracking-tight">
                                                            {sq.nomeSquadra}
                                                        </h3>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">
                                                            {sq.iscrizioni.length} Atleti
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleAnnullaSquadraPubblicata(sq)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Annulla squadra"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Atleti della squadra */}
                                                <div className="space-y-1.5">
                                                    {sq.iscrizioni.map((isc, iIdx) => (
                                                        <div
                                                            key={iIdx}
                                                            className="flex items-center justify-between bg-white px-3 py-2 rounded-xl text-xs border border-gray-100"
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
                                                <div className="pt-2 border-t border-gray-200/60">
                                                    {haSceltoTurno ? (
                                                        <div className="bg-emerald-100/60 border border-emerald-200 p-2.5 rounded-xl space-y-1 text-xs">
                                                            <div className="flex items-center gap-1.5 text-emerald-800 font-black uppercase text-[10px]">
                                                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Turno Confermato</span>
                                                            </div>
                                                            <p className="font-black text-slate-800">
                                                                {format(new Date(sq.turno?.orarioInizio || 0), 'EEEE dd MMMM HH:mm')}
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
                </div>
            )}
        </div>
    );
};

export default AreaCoach;
