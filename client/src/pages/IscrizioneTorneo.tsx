import React, { useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
    Trophy, Calendar, MapPin, ArrowLeft, Clock,
    CheckCircle2, AlertCircle, CreditCard, Search, Loader2, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Torneo {
    id: string;
    nome: string;
    tipologia: string;
    sede: string;
    dataInizio: string;
    dataFine: string | null;
    costoIscrizione: number;
    stagione: { nome: string };
    categorie?: string[];
    sedi: { id: string, nome: string, categorie: string[] }[];
}

interface Disponibilita {
    id: string;
    giorno: string;
    orarioInizio: string;
    postiTotali: number;
    postiOccupati: number;
    postiRimanenti: number;
    sede?: { id: string, nome: string } | null;
}

interface GiocatoreLookup {
    id: string;
    nome: string;
    cognome: string;
    categoria: string;
    sesso: 'M' | 'F';
    telefono: string | null;
    certificatoMedicoScadenza: string | null;
    saldo: { saldoAttuale: number } | null;
    iscrizioni: { torneoId: string; turnoId: string; stato: string }[];
}

const IscrizioneTorneo: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { search } = useLocation();
    const queryClient = useQueryClient();
    const { isAdmin, token } = useAuth();
    const isAdministrator = isAdmin();

    const queryParams = new URLSearchParams(search);
    const preselectedTurnoId = queryParams.get('turnoId');

    const fetchTorneoDati = async () => {
        const [resTorneo, resDisp] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/tornei/public/${id}`),
            axios.get(`${API_BASE_URL}/api/tornei/public/${id}/disponibilita`)
        ]);
        return { torneo: resTorneo.data as Torneo, disponibilita: resDisp.data as Disponibilita[] };
    };

    const { data: torneoDati, isLoading: loading } = useQuery({
        queryKey: ['iscrizione', id],
        queryFn: fetchTorneoDati,
    });

    const torneo = torneoDati?.torneo || null;
    const disponibilita = torneoDati?.disponibilita || [];

    // Step 1: Tessera
    const [tessera, setTessera] = useState('');
    const [giocatore, setGiocatore] = useState<GiocatoreLookup | null>(null);
    const [tesseraError, setTesseraError] = useState('');
    const [lookupLoading, setLookupLoading] = useState(false);

    // Step 2: Turno
    const [selectedTurno, setSelectedTurno] = useState(preselectedTurnoId || '');
    const [selectedSecondTurno, setSelectedSecondTurno] = useState('');
    const [selectedSede, setSelectedSede] = useState('');

    // Submit
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Lookup tessera
    const handleLookupTessera = async () => {
        if (!tessera.trim()) return;
        setLookupLoading(true);
        setTesseraError('');
        setGiocatore(null);
        setSelectedTurno('');
        setSubmitResult(null);

        try {
            const res = await axios.get(`${API_BASE_URL}/api/tornei/lookup-tessera/${tessera.trim()}`);
            const player = res.data;
            setGiocatore(player);

            // Auto-assegna la sede in base alla categoria del giocatore
            if (torneo && torneo.sedi && torneo.sedi.length > 0) {
                const cat = (player.categoria || '').toUpperCase().trim();
                const sesso = (player.sesso || '').toUpperCase().trim();
                const matchSede = torneo.sedi.find(s =>
                    (s.categorie || []).some(c => {
                        const cu = c.toUpperCase().trim();
                        return cu === cat || cu === `${sesso}/${cat}` || cat.includes(cu) || cu.includes(cat);
                    })
                );
                setSelectedSede(matchSede ? matchSede.id : 'main');
            }
        } catch (err: any) {
            setTesseraError(err.response?.data?.message || 'Errore nella ricerca. Riprova.');
        } finally {
            setLookupLoading(false);
        }
    };

    // È già iscritto?
    const giaIscritto = giocatore?.iscrizioni.some(i => i.torneoId === id && i.stato !== 'RIFIUTATA');

    // Saldo
    const costo = Number(torneo?.costoIscrizione || 0);
    const saldo = Number(giocatore?.saldo?.saldoAttuale || 0);
    const saldoSufficiente = costo === 0 || saldo >= costo;
    const canOverrideBalance = isAdministrator;

    // È multi-turno?
    const isMultiTurno = disponibilita.length > 1;

    // Validazione Certificato Medico
    const oggi = new Date();
    const scadenzaMedica = giocatore?.certificatoMedicoScadenza ? new Date(giocatore.certificatoMedicoScadenza) : null;
    const isCertificatoScaduto = scadenzaMedica ? scadenzaMedica < oggi : false;
    const isCertificatoInScadenza = scadenzaMedica ? (
        !isCertificatoScaduto &&
        (scadenzaMedica.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24) <= 20
    ) : false;

    // Can submit
    const canSubmit = giocatore &&
        selectedTurno &&
        (!isMultiTurno || selectedSecondTurno) &&
        (!torneo?.sedi || torneo.sedi.length === 0 || selectedSede) &&
        !giaIscritto &&
        (saldoSufficiente || canOverrideBalance) &&
        !isCertificatoScaduto &&
        !isSubmitting;

    // Submit iscrizione
    const handleSubmit = async () => {
        if (!canSubmit || !giocatore) return;
        setIsSubmitting(true);
        setSubmitResult(null);

        try {
            await axios.post(`${API_BASE_URL}/api/tornei/iscriviti`, {
                torneoId: id,
                turnoId: selectedTurno,
                secondoTurnoId: selectedSecondTurno || null,
                giocatoreId: giocatore.id,
                sedeId: (selectedSede && selectedSede !== 'main') ? selectedSede : null
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            setSubmitResult({ type: 'success', message: 'Iscrizione inviata con successo! In attesa di conferma.' });

            // Aggiorna disponibilità invalidando la query
            await queryClient.invalidateQueries({ queryKey: ['iscrizione', id] });

            // Redirect dopo 3 secondi
            setTimeout(() => navigate(`/tornei/${id}`), 3000);
        } catch (err: any) {
            setSubmitResult({ type: 'error', message: err.response?.data?.message || 'Errore durante l\'iscrizione. Riprova.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!torneo) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase text-gray-400">Torneo non trovato</h2>
                <Link to="/tornei" className="mt-4 inline-block text-primary font-bold hover:underline">
                    ← Torna ai Tornei
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
            {/* Header Torneo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                <Link to={`/tornei/${id}`} className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-primary uppercase tracking-widest mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Dettaglio Torneo
                </Link>
                <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{torneo.stagione.nome}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary rounded">{torneo.tipologia}</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Trophy className="w-7 h-7 text-primary" />
                            {torneo.nome}
                        </h1>
                        <div className="flex items-center gap-6 text-xs text-gray-400 font-bold uppercase mt-2">
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{format(new Date(torneo.dataInizio), 'dd MMM yyyy', { locale: it })}{torneo.dataFine ? ` - ${format(new Date(torneo.dataFine), 'dd MMM yyyy', { locale: it })}` : ''}</span>
                            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{torneo.sede}</span>
                        </div>
                    </div>
                    {costo > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-3 text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quota</p>
                            <p className="text-2xl font-black text-primary">€ {costo.toFixed(2)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* STEP 1: Inserisci Tessera */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 mb-4">
                    <CreditCard className="w-5 h-5 text-primary" />
                    1. Inserisci il Numero Tessera
                </h2>
                <p className="text-sm text-gray-500 mb-4">Inserisci il tuo numero di tessera FISB per identificarti.</p>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={tessera}
                        onChange={(e) => { setTessera(e.target.value); setTesseraError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleLookupTessera()}
                        placeholder="Es: 12345"
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-lg tracking-wider outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                        disabled={!!giocatore}
                    />
                    {!giocatore ? (
                        <button
                            onClick={handleLookupTessera}
                            disabled={!tessera.trim() || lookupLoading}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Cerca
                        </button>
                    ) : (
                        <button
                            onClick={() => { setGiocatore(null); setTessera(''); setSelectedTurno(''); setSubmitResult(null); setTesseraError(''); }}
                            className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
                        >
                            Cambia
                        </button>
                    )}
                </div>

                {tesseraError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {tesseraError}
                    </div>
                )}

                {/* Dati Giocatore Trovato */}
                {giocatore && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-black text-sm">
                                {giocatore.nome[0]}{giocatore.cognome[0]}
                            </div>
                            <div>
                                <p className="font-black uppercase text-lg">{giocatore.cognome} {giocatore.nome}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 font-bold">
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">{giocatore.categoria}</span>
                                    <span>Tessera: {tessera}</span>
                                    {giocatore.saldo && <span>Saldo: € {Number(giocatore.saldo.saldoAttuale).toFixed(2)}</span>}
                                </div>
                            </div>
                            <CheckCircle2 className="w-6 h-6 text-green-500 ml-auto" />
                        </div>

                        {/* Avvisi Certificato Medico */}
                        {isCertificatoScaduto && (
                            <div className="mt-4 bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 animate-shake">
                                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-black uppercase text-sm">Certificato Medico Scaduto</p>
                                    <p className="text-xs font-bold mt-1">aggiorna il tuo certificato medico prima di partecipare a gare agonistiche, grazie</p>
                                </div>
                            </div>
                        )}

                        {isCertificatoInScadenza && (
                            <div className="mt-4 bg-amber-100 border border-amber-200 text-amber-700 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-black uppercase text-sm">Certificato in Scadenza</p>
                                    <p className="text-xs font-bold mt-1">
                                        Il tuo certificato medico scadrà il {format(scadenzaMedica!, 'dd/MM/yyyy')}.
                                        Ricordati di rinnovarlo al più presto!
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {giaIscritto && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl flex items-center gap-2 text-sm font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" /> Sei già iscritto a questo torneo.
                    </div>
                )}
            </div>

            {/* STEP 1.5: Scegli Sede (solo se ci sono più sedi) */}
            {giocatore && !giaIscritto && torneo.sedi && torneo.sedi.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 animate-fade-in">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 mb-4">
                        <MapPin className="w-5 h-5 text-primary" />
                        1.5 Scegli la Sede di Gara
                    </h2>
                    <p className="text-sm text-gray-500 mb-6 font-bold italic">Seleziona in quale bowling center giocherai le tue partite (filtrate per la categoria {giocatore.categoria}).</p>
                    
                    {/* Sede auto-assegnata — read only */}
                    {(() => {
                        const sedeNome = torneo.sedi?.find(s => s.id === selectedSede)?.nome
                            ?? (selectedSede === 'main' ? torneo.sede : torneo.sede);
                        return (
                            <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                                <div className="p-3 rounded-2xl bg-primary text-white">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sede assegnata alla tua categoria</p>
                                    <p className="font-black uppercase text-lg text-dark">{sedeNome}</p>
                                </div>
                                <CheckCircle2 className="w-6 h-6 text-primary ml-auto" />
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* STEP 2: Scegli Turno (solo se giocatore identificato, non già iscritto e sede selezionata se necessaria) */}
            {giocatore && !giaIscritto && (torneo.sedi.length === 0 || selectedSede) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 animate-fade-in">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 mb-4">
                        <Clock className="w-5 h-5 text-primary" />
                        2. Scegli il Turno
                    </h2>

                    {(() => {
                        const filteredTurni = disponibilita.filter(t => 
                            torneo.sedi.length === 0 || 
                            (selectedSede && (
                                t.sede?.id === selectedSede || 
                                (!t.sede && (selectedSede === 'main' || selectedSede === 'principale'))
                            ))
                        );

                        if (filteredTurni.length === 0) {
                            return (
                                <div className="text-center py-8 text-gray-400">
                                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm font-bold uppercase">Nessun turno disponibile per la sede selezionata</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-6">
                                {/* Prima Scelta */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Turno Preferito</label>
                                    {filteredTurni.map((slot) => {
                                        const esaurito = slot.postiRimanenti <= 0;
                                        const isSelected = selectedTurno === slot.id;

                                        return (
                                            <label
                                                key={slot.id}
                                                className={`block p-4 rounded-xl border-2 transition-all cursor-pointer ${esaurito ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' :
                                                    isSelected ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' :
                                                        'border-gray-100 hover:border-primary/30 bg-white'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="radio"
                                                        name="turno"
                                                        value={slot.id}
                                                        checked={isSelected}
                                                        disabled={esaurito}
                                                        onChange={() => {
                                                            setSelectedTurno(slot.id);
                                                            if (selectedSecondTurno === slot.id) setSelectedSecondTurno('');
                                                        }}
                                                        className="w-5 h-5 text-primary border-gray-300 focus:ring-primary/50 shrink-0"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div>
                                                                <p className="font-black uppercase text-sm">
                                                                    {format(new Date(slot.giorno), 'EEEE dd MMMM yyyy', { locale: it })}
                                                                </p>
                                                                <p className="text-xs text-gray-400 font-bold">
                                                                    {format(new Date(slot.orarioInizio), 'HH:mm')}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-xs font-black px-2 py-0.5 rounded uppercase ${esaurito ? 'bg-red-100 text-red-600' :
                                                                    slot.postiRimanenti <= 3 ? 'bg-amber-100 text-amber-600' :
                                                                        'bg-green-100 text-green-600'
                                                                    }`}>
                                                                    {esaurito ? 'Esaurito' : `${slot.postiRimanenti} posti`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                {/* Seconda Scelta (Riserva) */}
                                {filteredTurni.length > 1 && selectedTurno && (
                                    <div className="pt-6 border-t border-gray-100 space-y-3 animate-fade-in">
                                        <div className="flex flex-col gap-1 mb-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-primary block">Turno di Riserva (Emergenza)</label>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase italic shadow-sm">Scegli anche una turno di riserva nel caso la tua prima scelta non fosse disponibile</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {filteredTurni.filter(s => s.id !== selectedTurno).map((slot) => {
                                                const isSelected = selectedSecondTurno === slot.id;
                                                return (
                                                    <button
                                                        key={slot.id}
                                                        onClick={() => setSelectedSecondTurno(slot.id)}
                                                        className={`p-3 rounded-xl border-2 text-left transition-all ${isSelected
                                                            ? 'border-secondary bg-secondary/5 shadow-md shadow-secondary/10'
                                                            : 'border-gray-100 hover:border-secondary/30 bg-white'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-secondary' : 'border-gray-200'}`}>
                                                                {isSelected && <div className="w-2 h-2 bg-secondary rounded-full" />}
                                                            </div>
                                                            <div>
                                                                <p className="font-black uppercase text-[10px]">
                                                                    {format(new Date(slot.giorno), 'dd MMM')} ore {format(new Date(slot.orarioInizio), 'HH:mm')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {!selectedSecondTurno && (
                                            <div className="bg-amber-50 border border-amber-100 text-amber-600 p-3 rounded-xl flex items-center gap-2 text-[11px] font-black uppercase tracking-tight animate-pulse">
                                                <AlertCircle className="w-4 h-4" />
                                                Scegli anche una turno di riserva nel caso la tua prima scelta non fosse disponibile
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* STEP 3: Riepilogo e Conferma */}
            {giocatore && selectedTurno && !giaIscritto && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 animate-fade-in">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        3. Conferma Iscrizione
                    </h2>

                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500 font-bold uppercase">Atleta</span>
                            <span className="font-black uppercase">{giocatore.cognome} {giocatore.nome}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500 font-bold uppercase">Sede di Gara</span>
                            <span className="font-black uppercase text-amber-600">
                                {torneo.sedi?.find(s => s.id === selectedSede)?.nome || torneo.sede}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500 font-bold uppercase">Turno Preferito</span>
                            <span className="font-black text-base">
                                {(() => {
                                    const slot = disponibilita.find(s => s.id === selectedTurno);
                                    if (!slot) return '-';
                                    return `${format(new Date(slot.giorno), 'EEE dd/MM', { locale: it })} ore ${format(new Date(slot.orarioInizio), 'HH:mm')}`;
                                })()}
                            </span>
                        </div>
                        {isMultiTurno && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-sm text-gray-500 font-bold uppercase">Turno di Riserva</span>
                                <span className="font-black text-base text-secondary">
                                    {(() => {
                                        const slot = disponibilita.find(s => s.id === selectedSecondTurno);
                                        if (!slot) return 'Non selezionato';
                                        return `${format(new Date(slot.giorno), 'EEE dd/MM', { locale: it })} ore ${format(new Date(slot.orarioInizio), 'HH:mm')}`;
                                    })()}
                                </span>
                            </div>
                        )}
                        {costo > 0 && (
                            <>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-500 font-bold uppercase">Quota Iscrizione</span>
                                    <span className="font-black text-primary">€ {costo.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-500 font-bold uppercase">Saldo Borsellino</span>
                                    <span className={`font-black ${saldoSufficiente ? 'text-green-600' : 'text-red-500'}`}>€ {saldo.toFixed(2)}</span>
                                </div>
                                {!saldoSufficiente && (
                                    <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-bold ${isAdministrator ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                                        <AlertCircle className="w-4 h-4 shrink-0" /> 
                                        {isAdministrator 
                                            ? "ATTENZIONE: Saldo insufficiente. Procedi solo se autorizzato (override amministratore)." 
                                            : "Saldo insufficiente. Ricarica il tuo borsellino in segreteria."
                                        }
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3 ${canSubmit
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Invio in corso...</>
                        ) : (
                            <>
                                {isAdministrator && !saldoSufficiente ? <ShieldCheck className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                {isAdministrator && !saldoSufficiente ? 'Forza Iscrizione (Admin)' : 'Conferma Iscrizione'}
                            </>
                        )}
                    </button>

                    {submitResult && (
                        <div className={`mt-4 p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${submitResult.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-600'
                            }`}>
                            {submitResult.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                            {submitResult.message}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IscrizioneTorneo;
