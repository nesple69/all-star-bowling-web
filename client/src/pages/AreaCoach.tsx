import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import {
    Users, Trophy, CheckCircle2, AlertCircle, Plus, Trash2,
    ShieldCheck, Clock, RefreshCw, Eye, Edit3, Mail, Copy, Check, Flag, X
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const safeFormatDate = (val: any, pattern: string): string => {
    if (!val) return '';
    try {
        let d: Date;
        if (typeof val === 'string') {
            d = new Date(val.replace('Z', ''));
        } else if (val instanceof Date) {
            d = val;
        } else {
            d = new Date(val);
        }
        if (isNaN(d.getTime())) return '';
        return format(d, pattern, { locale: it });
    } catch {
        return '';
    }
};

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
    turnoId?: string | null;
    secondoTurnoId?: string | null;
    stato: 'IN_ATTESA' | 'ASSEGNATO' | 'RISERVA' | 'RITIRATO';
    note?: string | null;
    createdAt: string;
    giocatore: GiocatoreDisponibile;
    turno?: {
        id: string;
        giorno: string;
        orarioInizio: string;
        sede?: { nome: string } | null;
    } | null;
    secondoTurno?: {
        id: string;
        giorno: string;
        orarioInizio: string;
        sede?: { nome: string } | null;
    } | null;
}

interface SquadraFormata {
    id: string;
    nomeSquadra: string;
    tipoFormazione?: 'QUALIFICATA' | 'DISPONIBILE';
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
    sede?: string;
    tipologia: 'SINGOLO' | 'DOPPIO' | 'TRIS' | 'SQUADRA_4';
    costoIscrizione: number;
    dataInizio: string;
    completato: boolean;
    turni: any[];
    torneoOrigineId?: string | null;
    torneoOrigine?: { id: string; nome: string } | null;
    isFinaleItaliana?: boolean;
    torneiOrigineIds?: string[];
    formazioniQualificate?: number | null;
    formazioniDisponibili?: number | null;
    coachTerminato?: boolean;
}

interface BozzaSquadra {
    tempId: string;
    nomeSquadra: string;
    tipoFormazione: 'QUALIFICATA' | 'DISPONIBILE';
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
    const [filtroTurno, setFiltroTurno] = useState<string>('TUTTI');
    const [filtroPreferenzaTurno, setFiltroPreferenzaTurno] = useState<'ENTRAMBE' | 'PRIMA' | 'SECONDA'>('ENTRAMBE');
    const [cercaAtleta, setCercaAtleta] = useState<string>('');

    const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
    const [messaggioFeedback, setMessaggioFeedback] = useState<{ tipo: 'success' | 'error'; testo: string } | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailOggetto, setEmailOggetto] = useState('');
    const [emailCorpo, setEmailCorpo] = useState('');
    const [copiedField, setCopiedField] = useState<'oggetto' | 'corpo' | null>(null);
    const [terminando, setTerminando] = useState(false);

    // 1. Carica lista tornei a squadre che richiedono la composizione del Coach (esclude le 2^ prove/fasi successive)
    useEffect(() => {
        const fetchTornei = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/tornei/public`);
                const isSecondaFase = (t: TorneoCoach) => {
                    if (t.torneoOrigineId || t.torneoOrigine) return true;
                    const nome = (t.nome || '').toLowerCase();
                    return (
                        nome.includes('2° fase') ||
                        nome.includes('2^ fase') ||
                        nome.includes('2^fase') ||
                        nome.includes('2a fase') ||
                        nome.includes('fase 2') ||
                        nome.includes('2° prova') ||
                        nome.includes('2^ prova') ||
                        nome.includes('2^prova') ||
                        nome.includes('2a prova') ||
                        nome.includes('prova 2')
                    );
                };

                const torneiDaComporre = (res.data || []).filter(
                    (t: TorneoCoach) =>
                        (t.tipologia !== 'SINGOLO' || t.isFinaleItaliana) &&
                        !t.completato &&
                        (!isSecondaFase(t) || t.isFinaleItaliana)
                );
                setTornei(torneiDaComporre);
                if (torneiDaComporre.length > 0) {
                    setSelectedTorneoId(torneiDaComporre[0].id);
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
        if (torneoCorrente.tipologia === 'SINGOLO') return 1;
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

    const getTurnoTime = (orario?: string) => (orario ? new Date(orario).getTime() : Number.MAX_SAFE_INTEGER);

    const atletiFiltrati = atletiLiberi
        .filter(d => {
            const matchCat = filtroCategoria === 'TUTTE' || d.giocatore.categoria === filtroCategoria;
            const matchSearch =
                d.giocatore.nome.toLowerCase().includes(cercaAtleta.toLowerCase()) ||
                d.giocatore.cognome.toLowerCase().includes(cercaAtleta.toLowerCase());

            let matchTurno = true;
            if (filtroTurno === 'TUTTI') {
                if (filtroPreferenzaTurno === 'PRIMA') {
                    matchTurno = !!d.turnoId;
                } else if (filtroPreferenzaTurno === 'SECONDA') {
                    matchTurno = !!d.secondoTurnoId;
                }
            } else {
                if (filtroPreferenzaTurno === 'PRIMA') {
                    matchTurno = d.turnoId === filtroTurno;
                } else if (filtroPreferenzaTurno === 'SECONDA') {
                    matchTurno = d.secondoTurnoId === filtroTurno;
                } else {
                    matchTurno = d.turnoId === filtroTurno || d.secondoTurnoId === filtroTurno;
                }
            }

            return matchCat && matchSearch && matchTurno;
        })
        .sort((a, b) => {
            if (filtroTurno !== 'TUTTI') {
                // Con un turno specifico selezionato, mostra prima chi lo ha come 1ª scelta e poi come 2ª scelta
                const aIsPrima = a.turnoId === filtroTurno ? 0 : 1;
                const bIsPrima = b.turnoId === filtroTurno ? 0 : 1;
                if (aIsPrima !== bIsPrima) return aIsPrima - bIsPrima;
            }

            if (filtroPreferenzaTurno === 'SECONDA') {
                const diffSeconda = getTurnoTime(a.secondoTurno?.orarioInizio) - getTurnoTime(b.secondoTurno?.orarioInizio);
                if (diffSeconda !== 0) return diffSeconda;
                return getTurnoTime(a.turno?.orarioInizio) - getTurnoTime(b.turno?.orarioInizio);
            }

            const diffPrima = getTurnoTime(a.turno?.orarioInizio) - getTurnoTime(b.turno?.orarioInizio);
            if (diffPrima !== 0) return diffPrima;
            return getTurnoTime(a.secondoTurno?.orarioInizio) - getTurnoTime(b.secondoTurno?.orarioInizio);
        });

    // Funzione: Crea nuova bozza squadra
    const handleCreaNuovaBozza = (tipoDefault: 'QUALIFICATA' | 'DISPONIBILE' = 'QUALIFICATA') => {
        const numeroProssima = squadrePubblicate.length + bozzaSquadre.length + 1;
        const prefisso =
            torneoCorrente?.tipologia === 'SINGOLO' ? 'Singolo' :
            torneoCorrente?.tipologia === 'DOPPIO' ? 'Doppio' :
            torneoCorrente?.tipologia === 'TRIS' ? 'Tris' : 'Squadra';
        const nuovaBozza: BozzaSquadra = {
            tempId: `temp_${Date.now()}`,
            nomeSquadra: `All Star ${prefisso} ${numeroProssima}`,
            tipoFormazione: tipoDefault,
            giocatoreIds: []
        };
        setBozzaSquadre([...bozzaSquadre, nuovaBozza]);
    };

    const handleModificaTipoFormazione = (tempId: string, tipoFormazione: 'QUALIFICATA' | 'DISPONIBILE') => {
        setBozzaSquadre(prev => prev.map(sq => sq.tempId === tempId ? { ...sq, tipoFormazione } : sq));
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
                    tipoFormazione: b.tipoFormazione,
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

    // Generazione testo Email di Conferma per Responsabile Regionale
    const formatAtletaRiga = (g: { categoria: string; cognome: string; nome: string }) =>
        `- ${g.categoria}, ${g.cognome} ${g.nome}, All Star Team`;

    const apriEmailConferma = () => {
        if (!torneoCorrente) return;
        const titolo = `Conferme per il torneo ${torneoCorrente.nome} dell'Associazione Sportiva All Star Team`;

        const qualificate = squadrePubblicate.filter(s => s.tipoFormazione !== 'DISPONIBILE');
        const disponibiliList = squadrePubblicate.filter(s => s.tipoFormazione === 'DISPONIBILE');
        const isSingolo = torneoCorrente.tipologia === 'SINGOLO';

        const formatGruppo = (lista: SquadraFormata[]) => {
            if (lista.length === 0) return 'Nessuna';
            return lista.map(sq => {
                const righeAtleti = sq.iscrizioni.map(isc => formatAtletaRiga(isc.giocatore)).join('\n');
                if (isSingolo) return righeAtleti;
                return `${sq.nomeSquadra}:\n${righeAtleti}`;
            }).join('\n\n');
        };

        const corpo = [
            titolo,
            '',
            isSingolo ? 'SINGOLI CONFERMATI:' : 'SQUADRE CONFERMATE:',
            formatGruppo(qualificate),
            '',
            isSingolo ? 'SINGOLI DISPONIBILI:' : 'SQUADRE DISPONIBILI:',
            formatGruppo(disponibiliList),
            '',
            'Il Presidente All Star Team',
            'Nedo Daniele Splendiani'
        ].join('\n');

        setEmailOggetto(titolo);
        setEmailCorpo(corpo);
        setCopiedField(null);
        setShowEmailModal(true);
    };

    const handleTerminaComposizione = async () => {
        if (!torneoCorrente) return;
        setTerminando(true);
        try {
            await axios.post(
                `${API_BASE_URL}/api/coach/tornei/${torneoCorrente.id}/termina`,
                { terminato: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTorneoCorrente(prev => prev ? { ...prev, coachTerminato: true } : prev);
            setMessaggioFeedback({
                tipo: 'success',
                testo: 'Composizione contrassegnata come terminata! Ora puoi copiare la mail di conferma.'
            });
            apriEmailConferma();
        } catch (err: any) {
            setMessaggioFeedback({
                tipo: 'error',
                testo: err.response?.data?.message || 'Errore durante il completamento della composizione.'
            });
        } finally {
            setTerminando(false);
        }
    };

    const handleCopyText = async (text: string, field: 'oggetto' | 'corpo') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch {
            // Fallback silenzioso
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
                    {/* Banner Riepilogo Finale Italiana */}
                    {torneoCorrente.isFinaleItaliana && (
                        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-amber-800 text-xs font-black uppercase tracking-widest">
                                    <Flag className="w-4 h-4" />
                                    <span>Finale Italiana</span>
                                    {torneoCorrente.coachTerminato && (
                                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                                            Terminata dal Coach
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-amber-900">
                                    Sede: {torneoCorrente.sede || '-'} — Data: {safeFormatDate(torneoCorrente.dataInizio, 'dd/MM/yyyy')}
                                </p>
                                <div className="flex flex-wrap gap-3 pt-1 text-xs font-black uppercase">
                                    <span className="bg-white border border-emerald-200 text-emerald-700 px-3 py-1 rounded-xl">
                                        Qualificate: {squadrePubblicate.filter(s => s.tipoFormazione !== 'DISPONIBILE').length}
                                        {torneoCorrente.formazioniQualificate !== null && torneoCorrente.formazioniQualificate !== undefined
                                            ? ` / ${torneoCorrente.formazioniQualificate}`
                                            : ''}
                                    </span>
                                    <span className="bg-white border border-amber-200 text-amber-700 px-3 py-1 rounded-xl">
                                        Disponibili (Ripescaggio): {squadrePubblicate.filter(s => s.tipoFormazione === 'DISPONIBILE').length}
                                        {torneoCorrente.formazioniDisponibili !== null && torneoCorrente.formazioniDisponibili !== undefined
                                            ? ` / ${torneoCorrente.formazioniDisponibili}`
                                            : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {squadrePubblicate.length > 0 && (
                                    <button
                                        onClick={apriEmailConferma}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                                    >
                                        <Mail className="w-4 h-4" />
                                        <span>Prepara / Copia Mail</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleTerminaComposizione}
                                    disabled={terminando || squadrePubblicate.length === 0}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-colors disabled:opacity-50"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{terminando ? 'Salvataggio...' : torneoCorrente.coachTerminato ? 'Terminato (Riapri Mail)' : 'Terminato'}</span>
                                </button>
                            </div>
                        </div>
                    )}

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

                                    {torneoCorrente?.turni && torneoCorrente.turni.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                <select
                                                    value={filtroTurno}
                                                    onChange={(e) => setFiltroTurno(e.target.value)}
                                                    className="w-full bg-amber-50/60 border border-amber-200/80 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-gray-700 outline-none uppercase cursor-pointer"
                                                >
                                                    <option value="TUTTI">Tutti i turni preferiti</option>
                                                    {(torneoCorrente.turni || []).map((t: any) => (
                                                        <option key={t.id} value={t.id}>
                                                            {safeFormatDate(t.giorno, 'EEE dd/MM')} ore {safeFormatDate(t.orarioInizio, 'HH:mm')}{t.sede ? ` - ${t.sede.nome}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {[
                                                    { value: 'ENTRAMBE', label: '1ª + 2ª Scelta' },
                                                    { value: 'PRIMA', label: 'Solo 1ª Scelta' },
                                                    { value: 'SECONDA', label: 'Solo 2ª Scelta' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setFiltroPreferenzaTurno(opt.value as 'ENTRAMBE' | 'PRIMA' | 'SECONDA')}
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                            filtroPreferenzaTurno === opt.value
                                                                ? 'bg-amber-500 text-white shadow-xs'
                                                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
                                                    key={g?.id || d.id}
                                                    className="bg-gray-50/70 hover:bg-gray-100/70 p-3 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 transition-colors"
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-black text-xs uppercase text-dark">
                                                                {g?.cognome || ''} {g?.nome || ''}
                                                            </span>
                                                            <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.2 rounded">
                                                                Cat. {g?.categoria || '-'}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-gray-400">
                                                                {g?.sesso || ''}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
                                                            <span>Media: <strong>{g?.mediaAttuale ? g.mediaAttuale.toFixed(1) : '-'}</strong></span>
                                                        </div>
                                                        {(d.turno || d.secondoTurno) && (
                                                            <div className="flex items-center gap-1.5 text-[9px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/70 mt-1">
                                                                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                                                {d.turno && (
                                                                    <span className="font-bold">
                                                                        1ª: {safeFormatDate(d.turno.orarioInizio, 'EEE dd/MM HH:mm')}
                                                                    </span>
                                                                )}
                                                                {d.secondoTurno && (
                                                                    <span className="text-gray-500 font-normal">
                                                                        (2ª: {safeFormatDate(d.secondoTurno.orarioInizio, 'EEE dd/MM HH:mm')})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
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
                                        onClick={() => handleCreaNuovaBozza('QUALIFICATA')}
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
                                                            {torneoCorrente.isFinaleItaliana && (
                                                                <select
                                                                    value={b.tipoFormazione}
                                                                    onChange={(e) => handleModificaTipoFormazione(b.tempId, e.target.value as 'QUALIFICATA' | 'DISPONIBILE')}
                                                                    className={`text-[10px] font-black uppercase rounded-lg px-2 py-1 border outline-none cursor-pointer ${
                                                                        b.tipoFormazione === 'DISPONIBILE'
                                                                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                                                                            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                                                    }`}
                                                                >
                                                                    <option value="QUALIFICATA">Qualificata</option>
                                                                    <option value="DISPONIBILE">Disponibile (Ripescaggio)</option>
                                                                </select>
                                                            )}
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
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="font-black text-base uppercase text-primary tracking-tight">
                                                                {sq.nomeSquadra}
                                                            </h3>
                                                            {torneoCorrente.isFinaleItaliana && (
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                    sq.tipoFormazione === 'DISPONIBILE'
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : 'bg-emerald-100 text-emerald-800'
                                                                }`}>
                                                                    {sq.tipoFormazione === 'DISPONIBILE' ? 'Disponibile' : 'Qualificata'}
                                                                </span>
                                                            )}
                                                        </div>
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

            {/* Modal Generazione / Copia Email Responsabile Regionale */}
            {showEmailModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-gray-100">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-2 text-primary">
                                <Mail className="w-5 h-5" />
                                <h3 className="text-lg font-black uppercase tracking-tight">
                                    Mail di Conferma Responsabile Regionale
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowEmailModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Oggetto Email
                                    </label>
                                    <button
                                        onClick={() => handleCopyText(emailOggetto, 'oggetto')}
                                        className="flex items-center gap-1 text-[10px] font-black uppercase text-primary hover:underline"
                                    >
                                        {copiedField === 'oggetto' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedField === 'oggetto' ? 'Oggetto Copiato!' : 'Copia Oggetto'}</span>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={emailOggetto}
                                    onChange={(e) => setEmailOggetto(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Testo Email (pronto da incollare nel browser)
                                    </label>
                                    <button
                                        onClick={() => handleCopyText(emailCorpo, 'corpo')}
                                        className="flex items-center gap-1 text-[10px] font-black uppercase text-primary hover:underline"
                                    >
                                        {copiedField === 'corpo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedField === 'corpo' ? 'Testo Copiato!' : 'Copia Testo'}</span>
                                    </button>
                                </div>
                                <textarea
                                    rows={12}
                                    value={emailCorpo}
                                    onChange={(e) => setEmailCorpo(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-100">
                            <a
                                href={`mailto:?subject=${encodeURIComponent(emailOggetto)}&body=${encodeURIComponent(emailCorpo)}`}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                <span>Apri in Mail</span>
                            </a>
                            <button
                                onClick={() => handleCopyText(emailCorpo, 'corpo')}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-colors"
                            >
                                {copiedField === 'corpo' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{copiedField === 'corpo' ? 'Copiato negli appunti!' : 'Copia Corpo Mail'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AreaCoach;
