import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import {
    Trophy, Calendar, MapPin, Download,
    ChevronLeft, Users, CheckCircle2, AlertCircle, 
    FileText, UserPlus, Search, X, Loader2
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

interface Risultato {
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
        numeroPartita: number;
        birilli: number;
    }[];
}

interface Torneo {
    id: string;
    nome: string;
    tipologia: string;
    sede: string;
    dataInizio: string;
    dataFine: string;
    completato: boolean;
    locandina?: string;
    linkIscrizione?: string;
    stagione: { nome: string };
    risultati: Risultato[];
    turni: any[];
    mostraBottoneIscrizione: boolean;
    costoIscrizione: number;
    sedi: { id: string, nome: string, categorie: string[], locandina?: string | null }[];
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

interface GiocatoreFound {
    id: string;
    nome: string;
    cognome: string;
    categoria: string;
    sesso: string;
    certificatoMedicoScadenza: string | null;
    saldo: { saldoAttuale: number };
}

const DettaglioTorneo: React.FC = () => {
    const { id } = useParams();
    const { isAdmin, token } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
    
    // Nuovi stati per iscrizione senza login
    const [showModal, setShowModal] = useState(false);
    const [selectedTurnoId, setSelectedTurnoId] = useState<string | null>(null);
    const [tesseraInput, setTesseraInput] = useState('');
    const [giocatoreFound, setGiocatoreFound] = useState<GiocatoreFound | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [disponibilita, setDisponibilita] = useState<any[]>([]);
    const [iscritti, setIscritti] = useState<any[]>([]);
    const [showIscritti, setShowIscritti] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchError, setSearchError] = useState('');

    const fetchTorneoData = async () => {
        const resTorneo = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}`);
        const resDisp = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/disponibilita`);
        setDisponibilita(resDisp.data);
        try {
            const resIscr = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/iscritti`);
            setIscritti(resIscr.data);
        } catch (err) {
            console.error('Errore caricamento iscritti:', err);
        }
        setIsLoading(false);
        return {
            torneo: resTorneo.data as Torneo,
            disponibilita: resDisp.data as Disponibilita[]
        };
    };

    const { data, refetch } = useQuery({
        queryKey: ['torneoDetail', id],
        queryFn: fetchTorneoData,
        enabled: !!id
    });

    const torneo = data?.torneo;

    // Ricerca giocatore per tessera
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (tesseraInput.length >= 3) {
                setIsSearching(true);
                setSearchError('');
                try {
                    const res = await axios.get(`${API_BASE_URL}/api/tornei/lookup-tessera/${tesseraInput}`);
                    setGiocatoreFound(res.data);
                } catch (err: any) {
                    setGiocatoreFound(null);
                    setSearchError(err.response?.data?.message || 'Giocatore non trovato');
                } finally {
                    setIsSearching(false);
                }
            } else {
                setGiocatoreFound(null);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [tesseraInput]);

    const handleOpenIscrizione = (turnoId: string) => {
        setSelectedTurnoId(turnoId);
        setShowModal(true);
        setTesseraInput('');
        setGiocatoreFound(null);
        setSearchError('');
        setStatus({ type: null, message: '' });
    };

    const handleConfirmRegistration = async () => {
        if (!giocatoreFound || !selectedTurnoId || !torneo) return;

        const costo = Number(torneo.costoIscrizione || 0);
        const saldo = Number(giocatoreFound.saldo?.saldoAttuale || 0);

        if (costo > 0 && saldo < costo) {
            if (isAdmin()) {
                if (!window.confirm(`Il giocatore ha un saldo insufficiente (€${saldo.toFixed(2)}). Vuoi procedere ugualmente come amministratore? Il saldo andrà in negativo.`)) {
                    return;
                }
            } else {
                alert("Saldo insufficiente nel borsellino. Ricarica il tuo borsellino o contatta l'amministratore.");
                return;
            }
        }

        // Controllo certificato medico
        if (giocatoreFound.certificatoMedicoScadenza) {
            const scadenza = new Date(giocatoreFound.certificatoMedicoScadenza);
            if (scadenza < new Date()) {
                if (isAdmin()) {
                    if (!window.confirm(`Il certificato medico di questo atleta è scaduto (${format(scadenza, 'dd/MM/yyyy')}). Vuoi procedere ugualmente?`)) {
                        return;
                    }
                } else {
                    alert('Aggiorna il tuo certificato medico prima di partecipare a gare agonistiche, grazie.');
                    return;
                }
            }
        }

        if (!window.confirm(`Confermi l'iscrizione per ${giocatoreFound.nome} ${giocatoreFound.cognome}?`)) return;

        setIsRegistering(true);
        try {
            await axios.post(`${API_BASE_URL}/api/tornei/iscriviti`, {
                torneoId: id,
                turnoId: selectedTurnoId,
                giocatoreId: giocatoreFound.id
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setStatus({ type: 'success', message: 'Iscrizione effettuata con successo!' });
            setTimeout(() => {
                setShowModal(false);
                setTesseraInput('');
                setGiocatoreFound(null);
                setStatus({ type: null, message: '' });
                refetch();
            }, 1000);
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Errore durante l\'iscrizione.' });
        } finally {
            setIsRegistering(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!torneo) return <div className="text-center py-20 font-black uppercase text-gray-300">Torneo non trovato</div>;

    const isScaduto2Giorni = differenceInDays(new Date(torneo.dataInizio), new Date()) <= -2;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 text-dark">
            {/* Modal Iscrizione */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative">
                        <button 
                            onClick={() => setShowModal(false)}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-dark"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-8 space-y-6">
                            <div className="text-center space-y-2">
                                <div className="inline-flex p-4 bg-primary/10 text-primary rounded-3xl mb-2">
                                    <UserPlus className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Iscrizione Rapida</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inserisci la tua tessera FISB</p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                                    <input 
                                        type="text"
                                        placeholder="NUMERO TESSERA..."
                                        value={tesseraInput}
                                        onChange={(e) => setTesseraInput(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl font-black uppercase text-sm transition-all outline-none"
                                        autoFocus
                                    />
                                    {isSearching && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {searchError && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                                        <AlertCircle className="w-4 h-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">{searchError}</p>
                                    </div>
                                )}

                                {giocatoreFound && (
                                    <div className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4 animate-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-dark text-white flex items-center justify-center rounded-xl font-black">
                                                    {giocatoreFound.nome[0]}{giocatoreFound.cognome[0]}
                                                </div>
                                                <div>
                                                    <p className="font-black uppercase text-sm leading-none">{giocatoreFound.cognome} {giocatoreFound.nome}</p>
                                                    <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-widest">{giocatoreFound.sesso}/{giocatoreFound.categoria}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                                            <div className="text-left">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Costo Iscrizione</p>
                                                <p className="text-lg font-black text-dark">€ {Number(torneo.costoIscrizione || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tuo Borsellino</p>
                                                <p className={`text-lg font-black ${Number(giocatoreFound.saldo?.saldoAttuale || 0) < Number(torneo.costoIscrizione || 0) ? 'text-red-500' : 'text-green-600'}`}>
                                                    € {Number(giocatoreFound.saldo?.saldoAttuale || 0).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleConfirmRegistration}
                                            disabled={isRegistering}
                                            className="w-full py-4 bg-secondary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isRegistering ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Conferma Iscrizione
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {status.message && (
                                    <div className={`p-4 rounded-2xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        <p className="text-[10px] font-black uppercase tracking-widest">{status.message}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav & Action */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <Link to="/tornei" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-black uppercase text-xs tracking-widest group">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Tutti i tornei
                </Link>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {torneo.locandina && !isScaduto2Giorni && (
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
                    {torneo.mostraBottoneIscrizione && !torneo.completato && !isScaduto2Giorni && (
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

            {/* Risultati o Turni */}
            {torneo.completato ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pos</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Atleta</th>
                                    <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest text-primary">Media</th>
                                    <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest text-dark">Birilli Tot.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {torneo.risultati.map((r, idx) => (
                                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-center font-black text-gray-400">{r.posizione}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm uppercase">{r.giocatore.cognome} {r.giocatore.nome}</span>
                                                <span className="text-[10px] font-black text-primary uppercase">{r.giocatore.sesso}/{r.giocatore.categoria}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-black text-primary">{(r.totaleBirilli / r.partiteGiocate).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center font-black">{r.totaleBirilli}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Pulsanti Toggle Vista */}
                    <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-100 self-start w-fit shadow-sm">
                        <button
                            onClick={() => setShowIscritti(false)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showIscritti ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Turni e Disponibilità
                        </button>
                        <button
                            onClick={() => setShowIscritti(true)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showIscritti ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Iscritti ({iscritti.length})
                        </button>
                    </div>

                    {showIscritti ? (
                        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm animate-fade-in">
                             <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                                <Users className="text-primary w-6 h-6" />
                                Atleti Iscritti
                            </h2>
                            {iscritti.length > 0 ? (
                                <div className="space-y-8">
                                    {(() => {
                                        const grouped = iscritti.reduce((acc: Record<string, any[]>, isc) => {
                                            const venueName = (isc.sede?.nome || 'Da assegnare').trim().toUpperCase();
                                            if (!acc[venueName]) acc[venueName] = [];
                                            acc[venueName].push(isc);
                                            return acc;
                                        }, {});

                                        return Object.entries(grouped).map(([venue, members], vIdx) => (
                                            <div key={vIdx} className="space-y-4">
                                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                                    <MapPin className="w-4 h-4 text-primary/50" />
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                                        {venue} ({members.length})
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {members.map((isc, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black uppercase text-dark">
                                                                    {isc.giocatore.cognome} {isc.giocatore.nome}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                                    {isc.giocatore.sesso}/{isc.giocatore.categoria}
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                                                    {format(new Date(isc.turno?.orarioInizio || 0), 'dd/MM HH:mm')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400 italic uppercase text-xs font-bold tracking-widest">
                                    Ancora nessun iscritto per questo torneo
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                                <Users className="text-secondary w-6 h-6" />
                                Turni e Disponibilità
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {disponibilita.map((t) => {
                                    const isEsaurito = t.postiRimanenti <= 0;
                                    return (
                                        <div key={t.id} className="p-6 rounded-3xl border border-gray-100 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(t.giorno.replace('Z', '')), 'EEEE dd MMMM', { locale: it })}</p>
                                                    <p className="font-black text-lg">{format(new Date(t.orarioInizio.replace('Z', '')), 'HH:mm')}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponibili</p>
                                                    <p className={`font-black ${isEsaurito ? 'text-red-500' : 'text-secondary'}`}>{t.postiRimanenti} / {t.postiTotali}</p>
                                                </div>
                                            </div>
                                            <button
                                                disabled={isEsaurito || isRegistering}
                                                onClick={() => handleOpenIscrizione(t.id)}
                                                className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isEsaurito ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105'}`}
                                            >
                                                {isEsaurito ? 'Esaurito' : 'Iscriviti a questo turno'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary text-white rounded-2xl">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quota Gara</p>
                                    <p className="text-2xl font-black text-primary">€ {Number(torneo.costoIscrizione || 0).toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="space-y-4 border-t border-primary/10 pt-6">
                                <div className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                                    <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase">Iscrizione istantanea con numero di tessera FISB.</p>
                                </div>
                                <div className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                                    <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase">Addebito automatico sul borsellino elettronico.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )}
</div>
);
};

export default DettaglioTorneo;
