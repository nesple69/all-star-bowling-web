import React, { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import {
    Trophy,
    Link as LinkIcon,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Save,
    UserCheck,
    AlertTriangle
} from 'lucide-react';

interface Giocatore {
    id: string;
    nome: string;
    cognome: string;
}

interface Torneo {
    id: string;
    nome: string;
    dataInizio: string;
}

interface ScrapedResult {
    posizione: number;
    atleta: string;
    partite: number;
    birilli: number;
    media: number;
    match: {
        giocatoreId: string;
        score: number;
    } | null;
}

interface ImportPreview {
    torneo: string;
    dataInizio: string;
    classifica: ScrapedResult[];
}

const ImportDati: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [url, setUrl] = useState('');
    const [selectedTorneoId, setSelectedTorneoId] = useState('');
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
    const [manualRiporti, setManualRiporti] = useState<Record<string, number[]>>({});
    const [importResult, setImportResult] = useState<{ salvati: number; nonMatchati: string[] } | null>(null);
    const fetchImportData = async () => {
        const token = sessionStorage.getItem('token');
        const [torneiRes, giocatoriRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/tornei`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            axios.get(`${API_BASE_URL}/api/giocatori?attivo=true`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);
        return { tornei: torneiRes.data as Torneo[], giocatori: giocatoriRes.data as Giocatore[] };
    };

    const { data: importData } = useQuery({
        queryKey: ['importData'],
        queryFn: fetchImportData,
    });

    const tornei = importData?.tornei || [];
    const giocatori = importData?.giocatori || [];

    const fetchPreview = async () => {
        if (!url) return;
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/import/preview?url=${encodeURIComponent(url)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPreview(res.data);
            setCurrentStep(2);
        } catch (error) {
            console.error('Errore anteprima:', error);
            alert('Impossibile recuperare l\'anteprima. Verifica l\'URL.');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!selectedTorneoId) return;
        setImporting(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/import/torneo`, {
                url,
                torneoId: selectedTorneoId,
                matchesOverride: manualMatches,
                riportiOverride: manualRiporti
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setImportResult(res.data);
            setCurrentStep(4);
        } catch (error: any) {
            console.error('Errore importazione:', error);
            const msg = error.response?.data?.error || 'Errore durante l\'importazione dei dati.';
            alert(msg);
        } finally {
            setImporting(false);
        }
    };

    const nextStep = () => setCurrentStep(prev => prev + 1);
    const prevStep = () => setCurrentStep(prev => prev - 1);

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-black text-dark uppercase tracking-tighter">Importazione Dati FISB</h1>
                <p className="text-gray-500 font-medium">Procedura guidata per l'importazione dei risultati federali</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Custom Nav */}
                <div className="flex justify-between items-center bg-gray-50 px-8 py-4 border-b border-gray-100">
                    {['URL', 'Torneo', 'Preview', 'Fine'].map((label, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${currentStep > idx + 1 ? 'bg-green-500 text-white' :
                                currentStep === idx + 1 ? 'bg-primary text-white shadow-lg' : 'bg-gray-200 text-gray-400'
                                }`}>
                                {currentStep > idx + 1 ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep === idx + 1 ? 'text-primary' : 'text-gray-400'
                                }`}>{label}</span>
                            {idx < 3 && <ChevronRight className="w-4 h-4 text-gray-300 mx-2" />}
                        </div>
                    ))}
                </div>

                {/* Wizard Steps */}
                <div className="p-8">
                    {currentStep === 1 && (
                        <div className="p-4 space-y-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <LinkIcon className="w-3 h-3" /> URL FISB Risultati
                                </label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://www.fisb.it/..."
                                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl outline-none transition-all font-medium text-dark"
                                />
                                <p className="text-[10px] text-gray-400 font-medium italic">Copia l'URL della pagina contenente la classifica del torneo.</p>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={fetchPreview}
                                    disabled={!url || loading}
                                    className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Carica Anteprima'}
                                    {!loading && <ChevronRight className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="p-4 space-y-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Trophy className="w-3 h-3" /> Seleziona Torneo Destinazione
                                </label>
                                <select
                                    value={selectedTorneoId}
                                    onChange={(e) => setSelectedTorneoId(e.target.value)}
                                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl outline-none transition-all font-medium text-dark"
                                >
                                    <option value="">-- Seleziona un torneo della stagione in corso --</option>
                                    {tornei.map((t: Torneo) => (
                                        <option key={t.id} value={t.id}>{t.nome} ({new Date(t.dataInizio).toLocaleDateString()})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-between pt-4">
                                <button onClick={prevStep} className="flex items-center gap-2 text-gray-400 font-black uppercase tracking-widest hover:text-dark transition-all">
                                    <ChevronLeft className="w-5 h-5" /> Indietro
                                </button>
                                <button
                                    onClick={nextStep}
                                    disabled={!selectedTorneoId}
                                    className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    Prossimo <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && preview && (
                        <div className="p-4 space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-black uppercase text-dark">Anteprima: {preview.torneo}</h3>
                                <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase">
                                    {preview.classifica.length} Posizioni trovate
                                </span>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto border border-gray-100 rounded-2xl shadow-inner bg-gray-50/30">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white shadow-sm">
                                        <tr>
                                            <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest w-12 text-center">Pos</th>
                                            <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Atleta (FISB)</th>
                                            <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Punteggi</th>
                                            <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Abbinamento locale</th>
                                            <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Birilli</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.classifica.map((item: any, idx: number) => {
                                            const match = item.match;
                                            const isMatched = match && match.score < 0.3;
                                            const manualId = manualMatches[item.atleta];
                                            const athleteRiporti = manualRiporti[item.atleta] || [];

                                            return (
                                                <tr key={idx} className={`border-b border-gray-100 hover:bg-white transition-colors ${!isMatched && !manualId ? 'bg-amber-50/50' : ''}`}>
                                                    <td className="px-5 py-4 text-center font-black text-dark text-xs">{item.posizione}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-dark text-xs uppercase">{item.atleta}</span>
                                                            <span className="text-[10px] text-gray-400">Media FISB: {item.media}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.punteggiPartite?.map((p: number, pIdx: number) => {
                                                                const isAutoRiporto = !manualRiporti[item.atleta] && p > 300 && pIdx === 0;
                                                                const isManualRiporto = athleteRiporti.includes(pIdx);
                                                                const activeRiporto = isManualRiporto || isAutoRiporto;

                                                                return (
                                                                    <button
                                                                        key={pIdx}
                                                                        onClick={() => {
                                                                            const current = manualRiporti[item.atleta] || (isAutoRiporto ? [0] : []);
                                                                            const next = current.includes(pIdx)
                                                                                ? current.filter(i => i !== pIdx)
                                                                                : [...current, pIdx];
                                                                            setManualRiporti(prev => ({ ...prev, [item.atleta]: next }));
                                                                        }}
                                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-black border transition-all ${activeRiporto
                                                                                ? 'bg-red-500 text-white border-red-600 shadow-sm'
                                                                                : 'bg-gray-50 text-dark border-gray-200 hover:border-primary/50'
                                                                            }`}
                                                                        title={activeRiporto ? "Marcato come riporto" : "Clicca per marcare come riporto"}
                                                                    >
                                                                        {p}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {isMatched ? (
                                                            <div className="flex items-center gap-2 text-green-600 font-bold text-xs bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200 w-fit">
                                                                <UserCheck className="w-4 h-4" />
                                                                Tesserato All Star Team
                                                            </div>
                                                        ) : manualId ? (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs">
                                                                    <UserCheck className="w-4 h-4" />
                                                                    Abbinato manualmente
                                                                </div>
                                                                <select
                                                                    value={manualId}
                                                                    onChange={(e) => setManualMatches(prev => ({ ...prev, [item.atleta]: e.target.value }))}
                                                                    className="w-full p-1.5 bg-amber-100/60 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-300 outline-none"
                                                                >
                                                                    <option value="">-- Rimuovi abbinamento --</option>
                                                                    {giocatori.map((g: Giocatore) => (
                                                                        <option key={g.id} value={g.id}>{g.cognome} {g.nome}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1.5">
                                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md w-fit">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                                                    Esterno (Non verrà importato)
                                                                </span>
                                                                <select
                                                                    value=""
                                                                    onChange={(e) => setManualMatches(prev => ({ ...prev, [item.atleta]: e.target.value }))}
                                                                    className="w-full p-1.5 bg-gray-50 text-gray-500 text-[11px] font-medium rounded-lg border border-gray-200 outline-none hover:border-primary/40 transition-colors"
                                                                >
                                                                    <option value="">-- Abbina solo se socio attivo --</option>
                                                                    {giocatori.map((g: Giocatore) => (
                                                                        <option key={g.id} value={g.id}>{g.cognome} {g.nome}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {(() => {
                                                            const allScores = item.punteggiPartite || [];
                                                            const ripIndices = manualRiporti[item.atleta] || (allScores[0] > 300 ? [0] : []);
                                                            const netScores = allScores.filter((_: number, idx: number) => !ripIndices.includes(idx));
                                                            const ripScores = allScores.filter((_: number, idx: number) => ripIndices.includes(idx));
                                                            const netTotal = netScores.reduce((a: number, b: number) => a + b, 0);
                                                            const ripTotal = ripScores.reduce((a: number, b: number) => a + b, 0);
                                                            const netPartite = netScores.length;
                                                            const netMedia = netPartite > 0 ? (netTotal / netPartite).toFixed(2) : '0.00';

                                                            return (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="font-black text-primary text-xs">{netTotal}</span>
                                                                    {ripTotal > 0 && (
                                                                        <span className="text-[8px] text-red-500 font-bold">+{ripTotal} RIP</span>
                                                                    )}
                                                                    <span className="text-[10px] text-gray-400 font-medium mt-1">Media: {netMedia}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between pt-4">
                                <button onClick={prevStep} className="flex items-center gap-2 text-gray-400 font-black uppercase tracking-widest hover:text-dark transition-all">
                                    <ChevronLeft className="w-5 h-5" /> Indietro
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:shadow-lg transition-all"
                                >
                                    {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Conferma Import
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && importResult && (
                        <div className="p-8 text-center space-y-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                                    <CheckCircle2 className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl font-black text-dark uppercase tracking-tighter">Importazione Completata!</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                <div className="bg-white border-2 border-gray-100 p-6 rounded-2xl shadow-sm">
                                    <p className="text-4xl font-black text-primary">{importResult.salvati}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">Giocatori Importati</p>
                                </div>
                                <div className="bg-white border-2 border-gray-100 p-6 rounded-2xl shadow-sm">
                                    <p className="text-4xl font-black text-amber-500">{importResult.nonMatchati.length}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">Senza Match</p>
                                </div>
                            </div>

                            {importResult.nonMatchati.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl max-w-lg mx-auto text-left">
                                    <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase mb-3">
                                        <AlertTriangle className="w-4 h-4" /> Atleti non abbinati
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {importResult.nonMatchati.map((name, i) => (
                                            <span key={i} className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-amber-800 shadow-sm">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-6">
                                <a href="/admin/tornei" className="inline-flex items-center shadow-lg gap-2 bg-dark text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all">
                                    Torna a Gestione
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportDati;
