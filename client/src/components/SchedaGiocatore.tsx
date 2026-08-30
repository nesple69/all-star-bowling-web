import React, { useState, useEffect } from 'react';
import {
    X, TrendingUp, Award, Target, Calendar,
    CreditCard, Building, Phone, Mail, ShieldCheck, Edit, Trash2,
    Plus, Minus, Loader2, History, Trophy, MapPin, Users
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';

interface Props {
    giocatore: any;
    stagioneId?: string;
    stagioneNome?: string;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    isAdmin: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
    'A': 'A - Eccellenza',
    'B': 'B - Eccellenza',
    'C': 'C - Cadetti',
    'D': 'D - Cadetti',
    'ES': 'ES - Esordienti',
    'DS': 'DS - Dirigenti'
};

const SchedaGiocatore: React.FC<Props> = ({ giocatore, stagioneId, stagioneNome, onClose, onEdit, onDelete, isAdmin }) => {
    const { token } = useAuth();
    const [playerData, setPlayerData] = useState<any>(giocatore);
    const [saldo, setSaldo] = useState<number | null>(null);
    const [movimenti, setMovimenti] = useState<any[]>([]);
    const [isWalletLoading, setIsWalletLoading] = useState(false);
    const [isWalletActionLoading, setIsWalletActionLoading] = useState(false);
    const [walletAmount, setWalletAmount] = useState('');
    const [walletNote, setWalletNote] = useState('');
    const [showWalletHistory, setShowWalletHistory] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [isLoadingResults, setIsLoadingResults] = useState(false);

    const fetchWalletData = async () => {
        if (!isAdmin) return;
        setIsWalletLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/giocatori/${giocatore.id}/borsellino`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSaldo(Number(res.data.saldo));
            setMovimenti(res.data.movimenti);
        } catch (error) {
            console.error('Errore recupero borsellino:', error);
        } finally {
            setIsWalletLoading(false);
        }
    };

    const fetchPlayerResults = async () => {
        setIsLoadingResults(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/giocatori/${giocatore.id}`, {
                params: { stagioneId: stagioneId || undefined }
            });
            setResults(res.data.risultati || []);
            setPlayerData(res.data);
        } catch (err) {
            console.error('Errore caricamento risultati:', err);
        } finally {
            setIsLoadingResults(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
        fetchPlayerResults();
    }, [giocatore.id, stagioneId, isAdmin]);

    const handleWalletAction = async (type: 'ricarica' | 'addebito') => {
        if (!walletAmount || parseFloat(walletAmount) <= 0) {
            alert('Inserisci un importo valido.');
            return;
        }

        setIsWalletActionLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/api/contabilita/${type}`, {
                giocatoreId: giocatore.id,
                importo: walletAmount,
                descrizione: walletNote || (type === 'ricarica' ? 'Ricarica manuale' : 'Addebito manuale')
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setWalletAmount('');
            setWalletNote('');
            await fetchWalletData();
            alert('Operazione completata con successo!');
        } catch (error: any) {
            console.error(`Errore durante ${type}:`, error);
            alert(error.response?.data?.message || `Errore durante l'operazione di ${type}.`);
        } finally {
            setIsWalletActionLoading(false);
        }
    };

    // Calcola la miglior partita dai risultati (ESCLUDENDO i riporti)
    const migliorPartita = results.length > 0
        ? Math.max(...results.flatMap(r => r.partite?.filter((p: any) => !p.isRiporto).map((p: any) => p.birilli) || [0]))
        : (playerData?.migliorPartita || 0);

    // Data per il grafico basata sui risultati reali della stagione
    const chartData = results.length > 0
        ? results
            .filter(r => r.torneo?.dataInizio || r.createdAt)
            .slice(-6)
            .map(r => {
                const dateVal = r.torneo?.dataInizio || r.createdAt;
                return {
                    data: dateVal ? format(new Date(dateVal), 'MMM') : 'N/D',
                    media: r.partiteGiocate > 0 ? Math.round(r.totaleBirilli / r.partiteGiocate) : 0
                };
            })
        : [];

    const isCertificatoScaduto = giocatore.certificatoMedicoScadenza
        ? new Date(giocatore.certificatoMedicoScadenza) < new Date()
        : true;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border-2 border-secondary relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10 text-gray-400"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Header Profile */}
                <div className="bg-gradient-to-r from-primary/10 to-transparent p-8 border-b border-gray-100">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="w-48 h-48 flex items-center justify-center overflow-visible">
                            <img src="/logo All Star.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-xl" />
                        </div>
                        <div className="text-center md:text-left flex-1">
                            <div className="flex flex-col">
                                <div className="flex items-center justify-center md:justify-start gap-4">
                                    <h2 className="text-3xl font-bold font-heading uppercase tracking-tight">{giocatore.cognome} {giocatore.nome}</h2>
                                    <img src="/logo All Star.png" alt="Logo" className="w-10 h-10 object-contain brightness-0 invert opacity-20" />
                                </div>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                                    <div className="px-2.5 py-0.5 border-2 rounded-md text-[10px] font-black uppercase tracking-tight border-green-600/30 bg-green-50 text-green-700">
                                        ● Tesserato Attivo
                                    </div>
                                    <div className="px-2 py-0.5 border-2 border-primary/30 bg-primary/5 text-primary rounded-md text-[10px] font-black uppercase tracking-tight">
                                        {giocatore.sesso}/{giocatore.categoria} {CATEGORY_LABELS[giocatore.categoria]?.split('-')[1]?.trim()}
                                    </div>
                                    {stagioneNome && (
                                        <div className="px-2 py-0.5 border-2 border-amber-300/60 bg-amber-50 text-amber-800 rounded-md text-[10px] font-black uppercase tracking-tight">
                                            {stagioneNome}
                                        </div>
                                    )}
                                    {giocatore.isSenior && (
                                        <div className="px-2 py-0.5 border-2 border-secondary bg-secondary text-white rounded-md text-[10px] font-black uppercase tracking-tight shadow-sm">
                                            Circuito Senior • Fascia {giocatore.fasciaSenior}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                                <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md font-medium">
                                    <CreditCard className="w-4 h-4 text-primary" />
                                    Tessera: {giocatore.numeroTessera || 'N/A'}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md font-medium">
                                    <Building className="w-4 h-4 text-primary" />
                                    {giocatore.isAziendale ? `Aziendale: ${giocatore.aziendaAffiliata || 'Sì'}` : 'Circuito FISB Standard'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Stats Section */}
                        <div className="lg:col-span-1 space-y-6">
                            <h3 className="font-heading font-bold uppercase text-sm tracking-widest text-primary border-b-2 border-primary/20 pb-2">Riepilogo Statistiche</h3>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-gradient-to-br from-primary to-light-blue p-4 rounded-xl text-white shadow-md">
                                    <div className="flex items-center justify-between opacity-80 mb-1">
                                        <span className="text-[10px] font-bold uppercase">Media Totale</span>
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                    <p className="text-3xl font-bold">{playerData?.mediaAttuale != null ? Number(playerData.mediaAttuale).toFixed(2) : '0.00'}</p>
                                </div>

                                <div className="bg-white border-2 border-gray-100 p-4 rounded-xl shadow-sm hover:border-secondary/30 transition-colors">
                                    <div className="flex items-center justify-between text-gray-400 mb-1">
                                        <span className="text-[10px] font-bold uppercase">Miglior Partita</span>
                                        <Award className="w-4 h-4 text-secondary" />
                                    </div>
                                    <p className="text-3xl font-bold text-dark">{migliorPartita || '0'}</p>
                                </div>

                                <div className="bg-white border-2 border-gray-100 p-4 rounded-xl shadow-sm hover:border-secondary/30 transition-colors">
                                    <div className="flex items-center justify-between text-gray-400 mb-1">
                                        <span className="text-[10px] font-bold uppercase">Totale Birilli</span>
                                        <Target className="w-4 h-4 text-red-400" />
                                    </div>
                                    <p className="text-3xl font-bold text-dark">{playerData?.totaleBirilli?.toLocaleString() || '0'}</p>
                                </div>

                                {/* Borsellino Section (Solo Admin) */}
                                {isAdmin && (
                                    <div className="bg-white border-2 border-primary/20 p-4 rounded-xl shadow-md space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-primary/10 rounded-lg">
                                                    <CreditCard className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Borsellino</span>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xl font-black ${saldo !== null && saldo < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                    {isWalletLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (saldo !== null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(saldo) : '---')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Importo (es. 10.00)"
                                                    className="w-full text-xs font-bold p-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary outline-none"
                                                    value={walletAmount}
                                                    onChange={(e) => setWalletAmount(e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Note opzionali..."
                                                    className="w-full text-[10px] p-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary outline-none"
                                                    value={walletNote}
                                                    onChange={(e) => setWalletNote(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleWalletAction('ricarica')}
                                                    disabled={isWalletActionLoading}
                                                    className="flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Ricarica
                                                </button>
                                                <button
                                                    onClick={() => handleWalletAction('addebito')}
                                                    disabled={isWalletActionLoading}
                                                    className="flex items-center justify-center gap-1.5 py-2 bg-red-500 text-white text-[10px] font-black uppercase rounded-lg hover:bg-red-600 disabled:opacity-50 transition-all"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                    Addebito
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => setShowWalletHistory(!showWalletHistory)}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-gray-400 uppercase hover:text-primary transition-colors"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                                {showWalletHistory ? 'Nascondi Storico' : 'Vedi Storico Recente'}
                                            </button>
                                        </div>

                                        {showWalletHistory && movimenti.length > 0 && (
                                            <div className="pt-2 space-y-2 border-t border-gray-100 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                {movimenti.map((m) => (
                                                    <div key={m.id} className="flex justify-between items-start text-[10px] border-b border-gray-50 pb-2 mb-2 last:border-0">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-600">{m.descrizione}</span>
                                                            <span className="text-gray-400">{format(new Date(m.data), 'dd/MM/yy HH:mm')}</span>
                                                        </div>
                                                        <span className={`font-black ${m.tipo === 'RICARICA' ? 'text-green-600' : 'text-red-500'}`}>
                                                            {m.tipo === 'RICARICA' ? '+' : '-'}{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(m.importo))}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                {isAdmin && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-500">Nato il:</span>
                                        <span className="font-semibold">{giocatore.dataNascita ? format(new Date(giocatore.dataNascita), 'dd/MM/yyyy') : 'N/A'}</span>
                                    </div>
                                )}

                                {/* Info Personali (Solo Admin) */}
                                {isAdmin && (
                                    <div className="grid grid-cols-1 gap-3 pt-2">
                                        <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg">
                                            <Phone className="w-4 h-4 text-primary" />
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Telefono</p>
                                                <p className="text-sm font-medium">{giocatore.telefono || 'Non specificato'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg">
                                            <Mail className="h-4 w-4 text-primary" />
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                                                <p className="text-sm font-medium">{giocatore.user?.email || 'N/D'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Certificato Medico (Solo Admin) */}
                                {isAdmin && (
                                    <div className={`p-4 rounded-lg border-l-4 ${isCertificatoScaduto ? 'bg-red-50 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5" />
                                                <h4 className="font-bold text-xs uppercase tracking-widest">Certificato</h4>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase">
                                                {giocatore.certificatoMedicoScadenza ? (isCertificatoScaduto ? 'SCADUTO' : 'REGOLARE') : 'MANCANTE'}
                                            </span>
                                        </div>
                                        {giocatore.certificatoMedicoScadenza && (
                                            <p className="text-xs mt-2 opacity-80">Scade il {format(new Date(giocatore.certificatoMedicoScadenza), 'dd/MM/yyyy')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tornei Giocati Section */}
                        <div className="lg:col-span-2">
                            <h3 className="font-heading font-bold uppercase text-sm tracking-widest text-[#2C3E50] border-b-2 border-[#F8B500]/20 pb-2 mb-6 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-[#F8B500]" />
                                Tornei Giocati {stagioneNome ? `(${stagioneNome})` : ''}
                            </h3>

                            {isLoadingResults ? (
                                <div className="flex items-center justify-center py-10 opacity-50">
                                    <Loader2 className="w-8 h-8 text-[#5DADE2] animate-spin" />
                                </div>
                            ) : results.length > 0 ? (
                                <div className="space-y-4">
                                    {[...results]
                                        .sort((a, b) => new Date(b.torneo?.dataInizio || 0).getTime() - new Date(a.torneo?.dataInizio || 0).getTime())
                                        .map((res) => {
                                            const tournamentDate = res.torneo?.dataInizio ? new Date(res.torneo.dataInizio) : null;
                                            const mediaEsatta = res.partiteGiocate > 0 ? (res.totaleBirilli / res.partiteGiocate).toFixed(2) : '0.00';

                                            return (
                                                <div key={res.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-3 hover:border-primary/30 transition-colors">
                                                    <div className="p-3 flex flex-col md:flex-row items-start md:items-center gap-4">

                                                        {/* Info Principali */}
                                                        <div className="flex-1 min-w-0 w-full order-2 md:order-1">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h4 className="font-bold text-sm text-dark truncate pr-4 flex items-center gap-2">
                                                                    <span>{res.torneo?.nome || 'Torneo'}</span>
                                                                    {res.torneo?.stagione?.nome && (
                                                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold tracking-tight">
                                                                            {res.torneo.stagione.nome}
                                                                        </span>
                                                                    )}
                                                                </h4>
                                                            </div>

                                                            {/* Sottotitolo: Data, Luogo, Tipo */}
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 font-medium mb-3 uppercase tracking-tight">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3 opacity-50" />
                                                                    {tournamentDate ? format(tournamentDate, 'dd/MM/yyyy') : 'N/D'}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3 opacity-50" />
                                                                    {res.torneo?.sede}
                                                                </span>
                                                                <span className="flex items-center gap-1 font-bold text-secondary/70">
                                                                    <Users className="w-3 h-3 opacity-50" />
                                                                    {res.torneo?.tipologia}
                                                                </span>
                                                            </div>

                                                            {/* Partite e Statistiche */}
                                                            <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 p-2 rounded-lg border border-dashed border-gray-100">
                                                                {/* Lista Partite (Filtrata: solo partite reali) */}
                                                                <div className="flex gap-2 border-r border-gray-200 pr-3">
                                                                    {res.partite && res.partite.length > 0 ? (
                                                                        res.partite
                                                                            .filter((p: any) => !p.isRiporto)
                                                                            .map((p: any) => (
                                                                                <span key={p.id} className="text-xs font-bold text-dark w-7 text-center">{p.birilli}</span>
                                                                            ))
                                                                    ) : (
                                                                        <span className="text-[9px] text-gray-300 italic">No games</span>
                                                                    )}
                                                                </div>

                                                                {/* Media e Totale */}
                                                                <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-gray-400">Media</span>
                                                                        <span className="text-primary text-xs">{mediaEsatta}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-gray-400">Totale</span>
                                                                        <span className="text-primary text-xs">{res.totaleBirilli}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-secondary">
                                                                        <span>Pos.</span>
                                                                        <span className="text-xs">{res.posizione}°</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Data (Mobile) */}
                                                        <div className="md:hidden flex items-center justify-between w-full border-b border-gray-50 pb-2 mb-2 order-1">
                                                            <span className="text-[10px] font-bold text-primary uppercase">
                                                                {tournamentDate ? format(tournamentDate, 'dd MMMM yyyy', { locale: it }) : 'Data N/D'}
                                                            </span>
                                                        </div>

                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                    <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-300 font-bold uppercase text-[9px] tracking-widest">Nessun torneo disputato per questa stagione.</p>
                                </div>
                            )
                            }
                        </div>

                        {/* Chart Section */}
                        <div className="lg:col-span-3 flex flex-col">
                            <h3 className="font-heading font-bold uppercase text-sm tracking-widest text-primary border-b-2 border-primary/20 pb-2 mb-6">Andamento Media</h3>

                            {chartData.length > 0 ? (
                                <div className="flex-1 min-h-[300px] w-full bg-white p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorMedia" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#5DADE2" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#5DADE2" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEFF1" />
                                            <XAxis
                                                dataKey="data"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#90A4AE', fontSize: 12 }}
                                            />
                                            <YAxis
                                                domain={['dataMin - 10', 'dataMax + 10']}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#90A4AE', fontSize: 12 }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                    fontFamily: 'Montserrat'
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="media"
                                                stroke="#5DADE2"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorMedia)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[160px] bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100 p-8 text-center">
                                    <TrendingUp className="w-8 h-8 text-gray-300 mb-2" />
                                    <p className="text-xs font-black uppercase text-gray-400">Nessun andamento disponibile per questa stagione</p>
                                    <p className="text-[10px] text-gray-300 font-bold mt-1">I dati appariranno non appena l'atleta parteciperà a un torneo.</p>
                                </div>
                            )}

                            <div className="mt-8 p-4 bg-blue-50 border-l-4 border-primary rounded-r-lg text-xs text-blue-900 leading-relaxed italic">
                                "La costanza è la chiave per l'eccellenza. Il grafico mostra le prestazioni medie calcolate sugli ultimi tornei ufficiali."
                            </div>
                        </div>

                    </div>
                </div>

                {isAdmin && (
                    <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-4">
                        <button
                            onClick={() => {
                                if (window.confirm(`Sei sicuro di voler eliminare definitivamente il giocatore ${giocatore.nome} ${giocatore.cognome}? Questa operazione non è reversibile.`)) {
                                    onDelete();
                                }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 uppercase text-xs tracking-widest"
                        >
                            <Trash2 className="w-4 h-4" />
                            Elimina Giocatore
                        </button>

                        <button
                            onClick={onEdit}
                            className="bg-secondary hover:bg-secondary/90 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 uppercase text-xs tracking-widest"
                        >
                            <Edit className="w-4 h-4" />
                            Modifica Profilo
                        </button>
                    </div>
                )}
            </div>


        </div>
    );
};

export default SchedaGiocatore;
