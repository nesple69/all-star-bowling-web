import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
    Trophy, Calendar, MapPin, ArrowLeft, Clock,
    CheckCircle2, AlertCircle, Search, Loader2, ShieldCheck, Users, X
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
    sedi: { id: string; nome: string; categorie: string[] }[];
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

interface AtletaSlot {
    tessera: string;
    giocatore: GiocatoreLookup | null;
    error: string;
    loading: boolean;
    isRiserva: boolean;
    label: string;
    required: boolean;
}

const getInitialSlots = (tipologia: string): AtletaSlot[] => {
    switch (tipologia) {
        case 'SINGOLO':
            return [
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta', required: true }
            ];
        case 'DOPPIO':
            return [
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 1', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 2', required: true }
            ];
        case 'TRIS':
            return [
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 1', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 2', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 3', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: true, label: 'Riserva (Opzionale)', required: false }
            ];
        case 'SQUADRA_4':
            return [
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 1', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 2', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 3', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta 4', required: true },
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: true, label: 'Riserva (Opzionale)', required: false }
            ];
        default:
            return [
                { tessera: '', giocatore: null, error: '', loading: false, isRiserva: false, label: 'Atleta', required: true }
            ];
    }
};

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

    // Step 1: Formazione Atleti
    const [slots, setSlots] = useState<AtletaSlot[]>([]);
    const [nomeSquadra, setNomeSquadra] = useState('');

    useEffect(() => {
        if (torneo) {
            setSlots(getInitialSlots(torneo.tipologia));
        }
    }, [torneo?.id, torneo?.tipologia]);

    // Step 2: Turno e Sede
    const [selectedTurno, setSelectedTurno] = useState(preselectedTurnoId || '');
    const [selectedSecondTurno, setSelectedSecondTurno] = useState('');
    const [selectedSede, setSelectedSede] = useState('');

    // Submit & Feedback
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [formValidationWarning, setFormValidationWarning] = useState('');

    // Handle lookup atleta for specific slot
    const handleLookupSlot = async (index: number) => {
        const slot = slots[index];
        const tesseraClean = slot.tessera.trim();
        if (!tesseraClean) return;

        setSlots(prev => prev.map((s, idx) => idx === index ? { ...s, loading: true, error: '' } : s));
        setSubmitResult(null);
        setFormValidationWarning('');

        try {
            const res = await axios.get(`${API_BASE_URL}/api/tornei/lookup-tessera/${tesseraClean}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const player: GiocatoreLookup = res.data;

            // Controlla se il giocatore è già inserito in un altro slot
            const alreadyInAnotherSlot = slots.some((s, idx) => idx !== index && s.giocatore?.id === player.id);
            if (alreadyInAnotherSlot) {
                setSlots(prev => prev.map((s, idx) => idx === index ? {
                    ...s,
                    loading: false,
                    error: 'Questo atleta è già stato inserito in questa formazione.',
                    giocatore: null
                } : s));
                return;
            }

            // Controlla se è già iscritto a questo torneo
            const isAlreadyRegistered = player.iscrizioni?.some(i => i.torneoId === id && i.stato !== 'RIFIUTATA');
            if (isAlreadyRegistered) {
                setSlots(prev => prev.map((s, idx) => idx === index ? {
                    ...s,
                    loading: false,
                    error: `${player.cognome} ${player.nome} risulta già iscritto a questo torneo.`,
                    giocatore: null
                } : s));
                return;
            }

            setSlots(prev => prev.map((s, idx) => idx === index ? {
                ...s,
                loading: false,
                error: '',
                giocatore: player
            } : s));

            // Auto-assegna la sede in base al primo atleta
            if (index === 0 && torneo && torneo.sedi && torneo.sedi.length > 0) {
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
            setSlots(prev => prev.map((s, idx) => idx === index ? {
                ...s,
                loading: false,
                error: err.response?.data?.message || 'Tessera non trovata. Verifica e riprova.',
                giocatore: null
            } : s));
        }
    };

    const handleClearSlot = (index: number) => {
        setSlots(prev => prev.map((s, idx) => idx === index ? {
            ...s,
            tessera: '',
            giocatore: null,
            error: '',
            loading: false
        } : s));
        setSubmitResult(null);
        setFormValidationWarning('');
    };

    // Validazioni complessive formazione
    const requiredSlots = slots.filter(s => s.required);
    const filledRequiredSlots = requiredSlots.filter(s => s.giocatore !== null);
    const allRequiredFilled = requiredSlots.length > 0 && filledRequiredSlots.length === requiredSlots.length;

    const titolariTrovati = slots.filter(s => !s.isRiserva && s.giocatore !== null).map(s => s.giocatore!);
    const riserveTrovate = slots.filter(s => s.isRiserva && s.giocatore !== null).map(s => s.giocatore!);
    const tuttiGiocatoriTrovati = [...titolariTrovati, ...riserveTrovate];

    const costo = Number(torneo?.costoIscrizione || 0);
    const isMultiTurno = disponibilita.length > 1;

    // Controllo saldi borsellini per titolari
    const saldiInsufficienti = titolariTrovati.filter(g => {
        const saldoVal = Number(g.saldo?.saldoAttuale || 0);
        return costo > 0 && saldoVal < costo;
    });

    const isSaldoOk = saldiInsufficienti.length === 0 || isAdministrator;

    // Controllo certificati medici
    const oggi = new Date();
    const certificatiScaduti = tuttiGiocatoriTrovati.filter(g => {
        if (!g.certificatoMedicoScadenza) return false;
        return new Date(g.certificatoMedicoScadenza) < oggi;
    });
    const isCertificatiOk = certificatiScaduti.length === 0 || isAdministrator;

    const canSubmit = allRequiredFilled &&
        selectedTurno &&
        (!isMultiTurno || selectedSecondTurno) &&
        (!torneo?.sedi || torneo.sedi.length === 0 || selectedSede) &&
        isSaldoOk &&
        isCertificatiOk &&
        !isSubmitting;

    // Submit iscrizione
    const handleSubmit = async () => {
        if (!allRequiredFilled) {
            setFormValidationWarning('inserisci tutti i dati necessari');
            return;
        }

        if (!selectedTurno) {
            setFormValidationWarning('Seleziona il turno di gara preferito.');
            return;
        }

        if (isMultiTurno && !selectedSecondTurno) {
            setFormValidationWarning('Seleziona anche il turno di riserva.');
            return;
        }

        setIsSubmitting(true);
        setSubmitResult(null);
        setFormValidationWarning('');

        const atletiPayload = slots
            .filter(s => s.giocatore !== null)
            .map(s => ({
                giocatoreId: s.giocatore!.id,
                isRiserva: s.isRiserva
            }));

        try {
            await axios.post(`${API_BASE_URL}/api/tornei/iscriviti`, {
                torneoId: id,
                turnoId: selectedTurno,
                secondoTurnoId: selectedSecondTurno || null,
                sedeId: (selectedSede && selectedSede !== 'main') ? selectedSede : null,
                nomeSquadra: nomeSquadra.trim() || undefined,
                atleti: atletiPayload
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            setSubmitResult({ type: 'success', message: 'Iscrizione inviata con successo! In attesa di conferma.' });

            await queryClient.invalidateQueries({ queryKey: ['iscrizione', id] });

            setTimeout(() => navigate(`/tornei/${id}`), 2500);
        } catch (err: any) {
            setSubmitResult({
                type: 'error',
                message: err.response?.data?.message || 'Errore durante l\'iscrizione. Riprova.'
            });
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
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
            {/* Header Torneo */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                <Link to={`/tornei/${id}`} className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-primary uppercase tracking-widest mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Dettaglio Torneo
                </Link>
                <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{torneo.stagione.nome}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold">{torneo.tipologia.replace('_', ' ')}</span>
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
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-6 py-3 text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quota Atleta</p>
                            <p className="text-2xl font-black text-primary">€ {costo.toFixed(2)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* STEP 1: Inserisci Formazione Atleti */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
                <div>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                            <Users className="w-5 h-5 text-primary" />
                            1. Formazione Atleti ({torneo.tipologia.replace('_', ' ')})
                        </h2>
                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${allRequiredFilled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {filledRequiredSlots.length} / {requiredSlots.length} Atleti Obbligatori
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                        Inserisci i numeri di tessera FISB per ciascun componente richiesto dalla tipologia del torneo.
                    </p>
                </div>

                {/* Nome Squadra opzionale per Doppio, Tris e Squadra */}
                {torneo.tipologia !== 'SINGOLO' && (
                    <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nome Coppia / Squadra (Opzionale)</label>
                        <input
                            type="text"
                            placeholder="Es: Gli Strike Boys, Le Tigri, ecc..."
                            value={nomeSquadra}
                            onChange={(e) => setNomeSquadra(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-black uppercase text-sm outline-none focus:border-primary transition-all"
                        />
                    </div>
                )}

                {/* Griglia Slot Atleti */}
                <div className="space-y-4">
                    {slots.map((slot, index) => {
                        const isScaduto = slot.giocatore?.certificatoMedicoScadenza
                            ? new Date(slot.giocatore.certificatoMedicoScadenza) < oggi
                            : false;
                        const saldoVal = Number(slot.giocatore?.saldo?.saldoAttuale || 0);
                        const hasSaldoSufficiente = costo === 0 || saldoVal >= costo;

                        return (
                            <div key={index} className={`p-5 rounded-2xl border-2 transition-all ${slot.giocatore ? 'border-green-200 bg-green-50/30' : slot.error ? 'border-red-200 bg-red-50/20' : 'border-gray-100 bg-gray-50/50'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <h3 className="font-black uppercase text-sm tracking-tight text-dark">
                                            {slot.label}
                                        </h3>
                                        {slot.required ? (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-600 rounded">Obbligatorio</span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-gray-200 text-gray-600 rounded">Facoltativo</span>
                                        )}
                                    </div>
                                    {slot.giocatore && (
                                        <button
                                            onClick={() => handleClearSlot(index)}
                                            className="text-xs font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 uppercase tracking-wider transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" /> Rimuovi
                                        </button>
                                    )}
                                </div>

                                {!slot.giocatore ? (
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                placeholder="NUMERO TESSERA..."
                                                value={slot.tessera}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSlots(prev => prev.map((s, idx) => idx === index ? { ...s, tessera: val, error: '' } : s));
                                                }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleLookupSlot(index)}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold uppercase text-sm tracking-wider outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleLookupSlot(index)}
                                            disabled={!slot.tessera.trim() || slot.loading}
                                            className="px-5 py-3 bg-primary text-white rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
                                        >
                                            {slot.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            Cerca
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-green-200 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-sm uppercase">
                                                {slot.giocatore.nome[0]}{slot.giocatore.cognome[0]}
                                            </div>
                                            <div>
                                                <p className="font-black uppercase text-base text-dark leading-tight">{slot.giocatore.cognome} {slot.giocatore.nome}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 font-bold mt-0.5">
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] uppercase">{slot.giocatore.sesso}/{slot.giocatore.categoria}</span>
                                                    <span>Tessera: {slot.tessera}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-right">
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Borsellino</p>
                                                <p className={`text-sm font-black ${hasSaldoSufficiente ? 'text-green-600' : 'text-red-500'}`}>
                                                    € {saldoVal.toFixed(2)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Certificato</p>
                                                <p className={`text-xs font-black uppercase ${isScaduto ? 'text-red-500' : 'text-green-600'}`}>
                                                    {isScaduto ? 'Scaduto' : 'In Regola'}
                                                </p>
                                            </div>

                                            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                                        </div>
                                    </div>
                                )}

                                {slot.error && (
                                    <div className="mt-2.5 bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl flex items-center gap-2 text-xs font-bold">
                                        <AlertCircle className="w-4 h-4 shrink-0" /> {slot.error}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* STEP 1.5: Sede Assegnata */}
            {allRequiredFilled && torneo.sedi && torneo.sedi.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 animate-fade-in">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 mb-4">
                        <MapPin className="w-5 h-5 text-primary" />
                        1.5 Sede di Gara
                    </h2>
                    {(() => {
                        const sedeNome = torneo.sedi?.find(s => s.id === selectedSede)?.nome
                            ?? (selectedSede === 'main' ? torneo.sede : torneo.sede);
                        return (
                            <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                                <div className="p-3 rounded-2xl bg-primary text-white">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sede assegnata per questa categoria</p>
                                    <p className="font-black uppercase text-lg text-dark">{sedeNome}</p>
                                </div>
                                <CheckCircle2 className="w-6 h-6 text-primary ml-auto" />
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* STEP 2: Scegli Turno */}
            {allRequiredFilled && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 animate-fade-in space-y-6">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
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
                                    <p className="text-sm font-bold uppercase">Nessun turno disponibile</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-6">
                                {/* Prima Scelta */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Turno Preferito</label>
                                    {filteredTurni.map((slot) => {
                                        const postiNecessari = titolariTrovati.length || 1;
                                        const esaurito = slot.postiRimanenti < postiNecessari;
                                        const isSelected = selectedTurno === slot.id;

                                        return (
                                            <label
                                                key={slot.id}
                                                className={`block p-4 rounded-2xl border-2 transition-all cursor-pointer ${esaurito ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' :
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
                                                                    {format(new Date(slot.giorno.replace('Z', '')), 'EEEE dd MMMM yyyy', { locale: it })}
                                                                </p>
                                                                <p className="text-xs text-gray-400 font-bold">
                                                                    {format(new Date(slot.orarioInizio.replace('Z', '')), 'HH:mm')}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${esaurito ? 'bg-red-100 text-red-600' :
                                                                    slot.postiRimanenti <= 3 ? 'bg-amber-100 text-amber-600' :
                                                                        'bg-green-100 text-green-600'
                                                                    }`}>
                                                                    {esaurito ? 'Esaurito' : `${slot.postiRimanenti} posti liberi`}
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
                                        <div className="flex flex-col gap-1 mb-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-primary block">Turno di Riserva (Emergenza)</label>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase italic">Scegli anche un turno di riserva nel caso la prima scelta non fosse disponibile</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {filteredTurni.filter(s => s.id !== selectedTurno).map((slot) => {
                                                const isSelected = selectedSecondTurno === slot.id;
                                                return (
                                                    <button
                                                        key={slot.id}
                                                        type="button"
                                                        onClick={() => setSelectedSecondTurno(slot.id)}
                                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all ${isSelected
                                                            ? 'border-secondary bg-secondary/5 shadow-md shadow-secondary/10'
                                                            : 'border-gray-100 hover:border-secondary/30 bg-white'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-secondary' : 'border-gray-200'}`}>
                                                                {isSelected && <div className="w-2 h-2 bg-secondary rounded-full" />}
                                                            </div>
                                                            <div>
                                                                <p className="font-black uppercase text-xs">
                                                                    {format(new Date(slot.giorno.replace('Z', '')), 'dd MMM', { locale: it })} ore {format(new Date(slot.orarioInizio.replace('Z', '')), 'HH:mm')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* STEP 3: Riepilogo e Conferma */}
            {allRequiredFilled && selectedTurno && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 animate-fade-in space-y-6">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        3. Riepilogo e Conferma Iscrizione
                    </h2>

                    <div className="space-y-3">
                        {nomeSquadra.trim() && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-xs text-gray-500 font-bold uppercase">Formazione</span>
                                <span className="font-black uppercase text-primary">{nomeSquadra}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500 font-bold uppercase">Atleti Iscritti</span>
                            <span className="font-black uppercase text-right">
                                {tuttiGiocatoriTrovati.map(g => `${g.cognome} ${g.nome}`).join(' • ')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500 font-bold uppercase">Sede di Gara</span>
                            <span className="font-black uppercase text-amber-600">
                                {torneo.sedi?.find(s => s.id === selectedSede)?.nome || torneo.sede}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500 font-bold uppercase">Turno Selezionato</span>
                            <span className="font-black text-sm">
                                {(() => {
                                    const slot = disponibilita.find(s => s.id === selectedTurno);
                                    if (!slot) return '-';
                                    return `${format(new Date(slot.giorno.replace('Z', '')), 'EEE dd/MM', { locale: it })} ore ${format(new Date(slot.orarioInizio.replace('Z', '')), 'HH:mm')}`;
                                })()}
                            </span>
                        </div>
                        {isMultiTurno && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-xs text-gray-500 font-bold uppercase">Turno di Riserva</span>
                                <span className="font-black text-sm text-secondary">
                                    {(() => {
                                        const slot = disponibilita.find(s => s.id === selectedSecondTurno);
                                        if (!slot) return 'Non selezionato';
                                        return `${format(new Date(slot.giorno.replace('Z', '')), 'EEE dd/MM', { locale: it })} ore ${format(new Date(slot.orarioInizio.replace('Z', '')), 'HH:mm')}`;
                                    })()}
                                </span>
                            </div>
                        )}
                        {costo > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-xs text-gray-500 font-bold uppercase">Quota Totale ({titolariTrovati.length} Atleti)</span>
                                <span className="font-black text-primary text-base">€ {(costo * titolariTrovati.length).toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* Alert saldi o certificati */}
                    {saldiInsufficienti.length > 0 && (
                        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${isAdministrator ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-black uppercase">Saldo insufficiente per: {saldiInsufficienti.map(g => `${g.cognome} ${g.nome} (€${Number(g.saldo?.saldoAttuale || 0).toFixed(2)})`).join(', ')}</p>
                                <p className="mt-0.5">{isAdministrator ? 'In quanto amministratore puoi forzare l\'iscrizione portando il saldo in negativo.' : 'Ricarica i borsellini prima di procedere con l\'iscrizione.'}</p>
                            </div>
                        </div>
                    )}

                    {certificatiScaduti.length > 0 && (
                        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${isAdministrator ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-black uppercase">Certificato medico scaduto per: {certificatiScaduti.map(g => `${g.cognome} ${g.nome}`).join(', ')}</p>
                                <p className="mt-0.5">{isAdministrator ? 'Procedi con attenzione (override amministratore).' : 'Aggiorna i certificati medici prima di partecipare a gare agonistiche.'}</p>
                            </div>
                        </div>
                    )}

                    {formValidationWarning && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-tight">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {formValidationWarning}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3 ${canSubmit
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95'
                            : 'bg-primary/80 text-white hover:bg-primary'
                            }`}
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Invio in corso...</>
                        ) : (
                            <>
                                {isAdministrator && (!isSaldoOk || !isCertificatiOk) ? <ShieldCheck className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                {isAdministrator && (!isSaldoOk || !isCertificatiOk) ? 'Forza Iscrizione Formazione (Admin)' : 'Conferma Iscrizione'}
                            </>
                        )}
                    </button>

                    {submitResult && (
                        <div className={`mt-4 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${submitResult.type === 'success'
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

