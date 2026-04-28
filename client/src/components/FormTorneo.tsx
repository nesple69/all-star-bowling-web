import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import {
    Save, ArrowLeft, Plus, Clock, Edit2,
    Trash2, MapPin, Link as LinkIcon, FileText,
    CheckCircle2, AlertCircle, Info, Upload
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';

const FormTorneo: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [stagioni, setStagioni] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        nome: '',
        tipologia: 'SINGOLO',
        sede: '',
        stagioneId: '',
        dataInizio: '',
        dataFine: '',
        linkIscrizione: '',
        costoIscrizione: '0',
        completato: false,
        mostraBottoneIscrizione: true,
        categorie: [] as string[]
    });

    const [turni, setTurni] = useState<any[]>([]);
    const [editingTurno, setEditingTurno] = useState<any | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [locandinaMode, setLocandinaMode] = useState<'upload' | 'url'>('upload');
    const [locandinaUrl, setLocandinaUrl] = useState('');
    const [sedi, setSedi] = useState<any[]>([]); // { nome: string, categorie: string[], locandina?: string, file?: File | null, previewUrl?: string | null }

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    // Fetch Stagioni e Torneo (se edit)
    useEffect(() => {
        const fetchData = async () => {
            const token = sessionStorage.getItem('token');
            try {
                // Fetch Stagioni Reali
                const resStagioni = await axios.get(`${API_BASE_URL}/api/stagioni`);
                setStagioni(resStagioni.data);

                if (isEdit) {
                    const resTorneo = await axios.get(`${API_BASE_URL}/api/tornei/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const t = resTorneo.data;
                    setFormData({
                        nome: t.nome,
                        tipologia: t.tipologia,
                        sede: t.sede,
                        stagioneId: t.stagioneId,
                        dataInizio: t.dataInizio ? String(t.dataInizio).substring(0, 10) : '',
                        dataFine: t.dataFine ? String(t.dataFine).substring(0, 10) : '',
                        linkIscrizione: t.linkIscrizione || '',
                        costoIscrizione: t.costoIscrizione?.toString() || '0',
                        completato: t.completato,
                        mostraBottoneIscrizione: t.mostraBottoneIscrizione !== false,
                        categorie: t.categorie || []
                    });
                    setTurni(t.turni || []);
                    setSedi(t.sedi?.map((s: any) => ({
                        ...s,
                        previewUrl: s.locandina ? (s.locandina.startsWith('http') ? s.locandina : `${API_BASE_URL}${s.locandina}`) : null
                    })) || []);
                    if (t.locandina) {
                        const fullUrl = t.locandina.startsWith('http') ? t.locandina : `${API_BASE_URL}${t.locandina}`;
                        // Se la locandina è un URL esterno (http/https)
                        if (t.locandina.startsWith('http')) {
                            setLocandinaMode('url');
                            setLocandinaUrl(t.locandina);
                        } else {
                            setPreviewUrl(fullUrl);
                        }
                        // Imposta sempre l'anteprima se presente, per vederla nel dropzone se si torna in upload mode
                        setPreviewUrl(fullUrl);
                    }
                }
            } catch (err) {
                console.error('Errore nel caricamento dati:', err);
            }
        };
        fetchData();
    }, [id, isEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleAddTurno = async () => {
        if (!isEdit) {
            alert('Salva prima il torneo per gestire i turni.');
            return;
        }

        const nuovoTurno = {
            giorno: formData.dataInizio,
            orarioInizio: `${formData.dataInizio}T09:00:00`,
            postiDisponibili: 10
        };

        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/tornei/${id}/giorni`, nuovoTurno, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTurni([...turni, res.data]);
        } catch (err) {
            alert('Errore nell\'aggiunta del turno.');
        }
    };

    const handleDeleteTurno = async (turnoId: string) => {
        if (!window.confirm('Eliminare questo turno?')) return;
        try {
            const token = sessionStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/tornei/${id}/giorni/${turnoId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTurni(turni.filter(t => t.id !== turnoId));
        } catch (err) {
            alert('Errore nell\'eliminazione del turno.');
        }
    };

    const handleUpdateTurno = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTurno) return;

        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.put(`${API_BASE_URL}/api/tornei/${id}/giorni/${editingTurno.id}`, editingTurno, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTurni(turni.map(t => t.id === editingTurno.id ? res.data : t));
            setEditingTurno(null);
        } catch (err) {
            alert('Errore nell\'aggiornamento del turno.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: null, message: '' });

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                if (key === 'categorie') {
                    data.append(key, JSON.stringify(value));
                } else {
                    data.append(key, value.toString());
                }
            }
        });
        if (selectedFile) {
            console.log(`[CLIENT] Allegatando file: ${selectedFile.name} (${selectedFile.size} bytes)`);
            data.append('locandina', selectedFile);
            data.append('locandina_main', selectedFile);
        } else if (locandinaMode === 'url' && locandinaUrl.trim()) {
            console.log(`[CLIENT] Utilizzando URL locandina: ${locandinaUrl}`);
            data.append('locandinaUrl', locandinaUrl.trim());
        }

        // Aggiungi sedi come stringa JSON (escludendo file e previewUrl)
        const sediProcessed = sedi.map(({ file, previewUrl, ...rest }) => rest);
        data.append('sedi', JSON.stringify(sediProcessed));

        // Aggiungi files delle sedi
        sedi.forEach((s, idx) => {
            if (s.file) {
                data.append(`sede_locandina_${idx}`, s.file);
            }
        });

        try {
            console.log('Inviando dati torneo (FormData keys):', Array.from(data.keys()));
            const token = sessionStorage.getItem('token');
            if (isEdit) {
                await axios.put(`${API_BASE_URL}/api/tornei/${id}`, data, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
                setStatus({ type: 'success', message: 'Torneo aggiornato con successo!' });
            } else {
                const res = await axios.post(`${API_BASE_URL}/api/tornei`, data, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
                setStatus({ type: 'success', message: 'Torneo creato! Ora puoi aggiungere i turni.' });
                setTimeout(() => navigate(`/admin/tornei/modifica/${res.data.id}`), 1500);
            }
        } catch (err: any) {
            console.error('Errore invio torneo:', err);
            const detailedError = err.response?.data?.error ? `: ${err.response.data.error}` : '';
            const message = (err.response?.data?.message || 'Errore durante il salvataggio') + detailedError;
            setStatus({ type: 'error', message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12 text-dark">
            <div className="flex items-center justify-between">
                <Link to="/admin/tornei" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-bold uppercase text-xs tracking-widest group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Torna alla lista
                </Link>
                <h1 className="text-2xl font-black uppercase tracking-tight">
                    {isEdit ? 'Modifica Torneo' : 'Nuovo Torneo'}
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 space-y-6">
                            {status.type && (
                                <div className={`p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    <p className="text-sm font-bold uppercase">{status.message}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome Torneo</label>
                                    <input
                                        required
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        placeholder="Esempio: Trofeo Città di..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Tipologia Torneo</label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { id: 'SINGOLO', label: 'Singolo' },
                                            { id: 'DOPPIO', label: 'Doppio' },
                                            { id: 'TRIS', label: 'Tris' },
                                            { id: 'SQUADRA_4', label: 'Squadra (4)' }
                                        ].map((t) => (
                                            <label key={t.id} className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:border-primary/50 transition-all has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                                                <input
                                                    type="radio"
                                                    className="hidden"
                                                    name="tipologia"
                                                    value={t.id}
                                                    checked={formData.tipologia === t.id}
                                                    onChange={e => setFormData({ ...formData, tipologia: e.target.value })}
                                                />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${formData.tipologia === t.id ? 'text-primary' : 'text-gray-400'
                                                    }`}>
                                                    {t.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2 ml-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Stagione</label>
                                        <Link to="/admin/stagioni" className="text-[10px] font-black text-primary hover:text-secondary uppercase tracking-widest transition-colors flex items-center gap-1">
                                            <Plus className="w-3 h-3" />
                                            Crea Nuova
                                        </Link>
                                    </div>
                                    <select
                                        required
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                        value={formData.stagioneId}
                                        onChange={e => setFormData({ ...formData, stagioneId: e.target.value })}
                                    >
                                        <option value="">Seleziona Stagione...</option>
                                        {stagioni.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Sede di Gara (Principale)</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                                        <input
                                            required
                                            className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                            value={formData.sede}
                                            onChange={e => setFormData({ ...formData, sede: e.target.value })}
                                            placeholder="Indirizzo o Bowling Center principale"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="w-5 h-5 text-primary" />
                                        <label className="block text-xs font-black text-primary uppercase tracking-widest">Configurazione Categorie Torneo</label>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-3">Seleziona tutte le categorie ammesse a questo torneo (verranno mostrate nelle classifiche e nei filtri)</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['M/A', 'M/B', 'M/C', 'M/D', 'F/A', 'F/B', 'F/C', 'F/D'].map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    const currentCats = formData.categorie || [];
                                                    if (currentCats.includes(cat)) {
                                                        setFormData({ ...formData, categorie: currentCats.filter(c => c !== cat) });
                                                    } else {
                                                        setFormData({ ...formData, categorie: [...currentCats, cat] });
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                                    formData.categorie?.includes(cat)
                                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105'
                                                        : 'bg-white border-gray-100 text-gray-400 hover:border-primary/30'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* --- Sezione Sedi Multiple --- */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Sedi di Gara Multiple (Opzionale)</label>
                                        <button
                                            type="button"
                                            onClick={() => setSedi([...sedi, { nome: '', categorie: [] }])}
                                            className="text-[10px] font-black text-primary hover:text-secondary uppercase tracking-widest flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Aggiungi Sede
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {sedi.map((s, idx) => (
                                            <div key={idx} className="p-5 bg-gray-50/50 border border-gray-100 rounded-3xl space-y-4 animate-fade-in relative group/sede">
                                                <div className="flex gap-4">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="relative">
                                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                                            <input
                                                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                                placeholder="Nome Sede (es. Bowling di Roma)"
                                                                value={s.nome}
                                                                onChange={e => {
                                                                    const newSedi = [...sedi];
                                                                    newSedi[idx].nome = e.target.value;
                                                                    setSedi(newSedi);
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Categorie assegnate a questa sede</label>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {['M/A', 'M/B', 'M/C', 'M/D', 'F/A', 'F/B', 'F/C', 'F/D'].map(cat => (
                                                                    <button
                                                                        key={cat}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newSedi = [...sedi];
                                                                            const currentCats = newSedi[idx].categorie || [];
                                                                            if (currentCats.includes(cat)) {
                                                                                newSedi[idx].categorie = currentCats.filter((c: string) => c !== cat);
                                                                            } else {
                                                                                newSedi[idx].categorie = [...currentCats, cat];
                                                                            }
                                                                            setSedi(newSedi);
                                                                        }}
                                                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${
                                                                            s.categorie?.includes(cat)
                                                                                ? 'bg-primary border-primary text-white shadow-sm'
                                                                                : 'bg-white border-gray-100 text-gray-400 hover:border-primary/30'
                                                                        }`}
                                                                    >
                                                                        {cat}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const input = document.createElement('input');
                                                                input.type = 'file';
                                                                input.accept = 'image/*,application/pdf';
                                                                input.onchange = (e: any) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const newSedi = [...sedi];
                                                                        newSedi[idx].file = file;
                                                                        newSedi[idx].previewUrl = URL.createObjectURL(file);
                                                                        setSedi(newSedi);
                                                                    }
                                                                };
                                                                input.click();
                                                            }}
                                                            className={`w-32 h-32 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden relative group shadow-sm ${
                                                                s.previewUrl ? 'border-primary/50 bg-white ring-4 ring-primary/5' : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {s.previewUrl ? (
                                                                (s.file?.type === 'application/pdf' || s.locandina?.toLowerCase().endsWith('.pdf') || (typeof s.previewUrl === 'string' && s.previewUrl.toLowerCase().endsWith('.pdf'))) ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                       <FileText className="w-10 h-10 text-red-500" />
                                                                       <span className="text-[8px] font-black uppercase text-gray-400">PDF PRONTO</span>
                                                                       {s.previewUrl && <a href={s.previewUrl} target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-primary underline" onClick={e => e.stopPropagation()}>Apri PDF</a>}
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                       <img src={s.previewUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Sede" />
                                                                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                           <Upload className="w-6 h-6 text-white" />
                                                                       </div>
                                                                    </>
                                                                )
                                                            ) : (
                                                                <>
                                                                    <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-primary/10 transition-colors">
                                                                       <Plus className="w-6 h-6 text-gray-300 group-hover:text-primary" />
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase text-center px-1 tracking-widest">Carica Locandina</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        
                                                        {s.previewUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newSedi = [...sedi];
                                                                    newSedi[idx].file = null;
                                                                    newSedi[idx].previewUrl = null;
                                                                    newSedi[idx].locandina = null;
                                                                    setSedi(newSedi);
                                                                }}
                                                                className="text-[8px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                Rimuovi
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => setSedi(sedi.filter((_, i) => i !== idx))}
                                                            className="mt-auto p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                            title="Elimina Sede"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {sedi.length === 0 && (
                                            <p className="text-[10px] text-gray-400 italic font-bold text-center py-2">Nessuna sede multipla configurata (verrà usata la sede principale).</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Data Inizio</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                        value={formData.dataInizio}
                                        onChange={e => setFormData({ ...formData, dataInizio: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Data Fine (Opzionale)</label>
                                    <input
                                        type="date"
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                        value={formData.dataFine}
                                        onChange={e => setFormData({ ...formData, dataFine: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Quota Iscrizione (€)</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 font-bold">€</span>
                                        <input
                                            type="number"
                                            step="0.50"
                                            className="w-full pl-10 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                            value={formData.costoIscrizione}
                                            onChange={e => setFormData({ ...formData, costoIscrizione: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Link Iscrizione Esterno (Opzionale)</label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                                        <input
                                            className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                            value={formData.linkIscrizione}
                                            onChange={e => setFormData({ ...formData, linkIscrizione: e.target.value })}
                                            placeholder="https://cms.fisb.it/..."
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 ml-1 font-bold italic uppercase">
                                        Lascia vuoto per usare il sistema interno. Inserisci un URL solo se l'iscrizione avviene esternamente.
                                    </p>
                                </div>

                                {isEdit && (
                                    <div className="md:col-span-2 flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <input
                                            type="checkbox"
                                            id="completato"
                                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={formData.completato}
                                            onChange={e => setFormData({ ...formData, completato: e.target.checked })}
                                        />
                                        <label htmlFor="completato" className="text-xs font-black uppercase cursor-pointer">Segna come completato (Abilita classifiche)</label>
                                    </div>
                                )}

                                <div className="md:col-span-2 flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <input
                                        type="checkbox"
                                        id="mostraBottoneIscrizione"
                                        className="w-5 h-5 rounded border-amber-300 text-amber-500 focus:ring-amber-400"
                                        checked={formData.mostraBottoneIscrizione}
                                        onChange={e => setFormData({ ...formData, mostraBottoneIscrizione: e.target.checked })}
                                    />
                                    <label htmlFor="mostraBottoneIscrizione" className="text-xs font-black uppercase cursor-pointer text-amber-700">
                                        Mostra pulsante "Iscriviti" nel calendario tornei
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-8 flex justify-end">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="bg-primary hover:bg-primary/90 text-white font-black px-10 py-4 rounded-2xl shadow-xl hover:shadow-primary/20 transition-all flex items-center gap-3 uppercase text-sm tracking-widest disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {isLoading ? 'Salvataggio...' : 'Salva Torneo'}
                            </button>
                        </div>
                    </form>

                    {/* Turn Management Section - Visible only in Edit */}
                    {isEdit && (
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                    <Clock className="text-secondary w-6 h-6" />
                                    Pianificazione Turni
                                </h2>
                                <button
                                    onClick={handleAddTurno}
                                    className="bg-secondary/10 text-secondary hover:bg-secondary hover:text-white font-black px-4 py-2 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest"
                                >
                                    <Plus className="w-4 h-4" />
                                    Aggiungi Turno
                                </button>
                            </div>

                            <div className="space-y-3">
                                {turni.length > 0 ? turni.map((turno) => {
                                    const isEditing = editingTurno?.id === turno.id;

                                    if (isEditing) {
                                        return (
                                            <form key={turno.id} onSubmit={handleUpdateTurno} className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/20 space-y-4 animate-fade-in shadow-inner">
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Giorno</label>
                                                        <input
                                                            type="date"
                                                            required
                                                            className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                            value={format(new Date(editingTurno.giorno), 'yyyy-MM-dd')}
                                                            onChange={e => setEditingTurno({ ...editingTurno, giorno: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Orario</label>
                                                        <input
                                                            type="time"
                                                            required
                                                            className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                            value={editingTurno?.orarioInizio?.substring(11, 16) || ""}
                                                            onChange={e => {
                                                                const time = e.target.value;
                                                                const datePart = editingTurno?.giorno?.substring(0, 10) || editingTurno?.orarioInizio?.substring(0, 10) || "";
                                                                const fullDate = `${datePart}T${time}:00`;
                                                                setEditingTurno({ ...editingTurno, orarioInizio: fullDate });
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Posti</label>
                                                        <input
                                                            type="number"
                                                            required
                                                            className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                            value={editingTurno.postiDisponibili}
                                                            onChange={e => setEditingTurno({ ...editingTurno, postiDisponibili: e.target.value })}
                                                        />
                                                    </div>
                                                    {sedi.length > 0 && (
                                                        <div className="md:col-span-2 lg:col-span-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Sede di Gara</label>
                                                            <select
                                                                className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                                value={editingTurno.sedeId || ""}
                                                                onChange={e => setEditingTurno({ ...editingTurno, sedeId: e.target.value })}
                                                            >
                                                                <option value="">Sede Principale ({formData.sede})</option>
                                                                {sedi.map(s => (
                                                                    <option key={s.id} value={s.id}>{s.nome}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end gap-2 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingTurno(null)}
                                                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        Annulla
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="px-6 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:scale-105 transition-all"
                                                    >
                                                        Salva Turno
                                                    </button>
                                                </div>
                                            </form>
                                        );
                                    }

                                    return (
                                        <div key={turno.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group transition-all hover:bg-white hover:shadow-md hover:border-gray-200">
                                            <div className="flex items-center gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Giorno</span>
                                                    <span className="font-bold text-sm">{new Date((turno?.giorno?.substring(0, 10) || "2000-01-01") + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Orario</span>
                                                    <span className="font-bold text-sm">
                                                        {(turno?.orarioInizio?.substring(11, 16) || "")}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Posti</span>
                                                    <span className="font-bold text-sm px-2.5 py-0.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                                                        {turno.postiDisponibili}
                                                    </span>
                                                </div>
                                                {turno.sede && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sede</span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full uppercase tracking-widest">
                                                            {turno.sede.nome}
                                                        </span>
                                                    </div>
                                                )}
                                                {!turno.sede && sedi.length > 0 && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sede</span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-full uppercase tracking-widest">
                                                            Principale
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditingTurno(turno)}
                                                    className="p-2.5 text-gray-300 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                    title="Modifica Orario"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTurno(turno.id)}
                                                    className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Elimina"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-center py-8 text-gray-300 text-sm font-bold uppercase tracking-widest">Nessun turno configurato</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar - Locandina */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-3">
                            <FileText className="text-amber-400 w-5 h-5" />
                            Locandina
                        </h2>

                        {/* Toggle Upload / URL */}
                        <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100 mb-5">
                            <button
                                type="button"
                                onClick={() => { setLocandinaMode('upload'); setLocandinaUrl(''); }}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${locandinaMode === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <Upload className="w-3 h-3" />
                                Carica File
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLocandinaMode('url'); setSelectedFile(null); setPreviewUrl(null); }}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${locandinaMode === 'url' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <LinkIcon className="w-3 h-3" />
                                Inserisci Link
                            </button>
                        </div>

                        {locandinaMode === 'upload' ? (
                            <>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 flex flex-col items-center justify-center text-center p-6 cursor-pointer hover:border-primary/50 transition-all relative overflow-hidden group"
                                >
                                    {previewUrl ? (
                                        (selectedFile?.type === 'application/pdf' || (typeof previewUrl === 'string' && previewUrl.toLowerCase().endsWith('.pdf'))) ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <FileText className="w-16 h-16 text-red-500" />
                                                <span className="text-xs font-black uppercase tracking-widest">Anteprima PDF Caricato</span>
                                                {selectedFile && <span className="text-[10px] text-gray-400">{selectedFile.name}</span>}
                                            </div>
                                        ) : (
                                            <img src={previewUrl} alt="Locandina" className="absolute inset-0 w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <>
                                            <Plus className="w-12 h-12 text-gray-200 mb-4 group-hover:scale-110 transition-transform" />
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Carica Locandina</p>
                                            <p className="text-[10px] text-gray-300 mt-1 uppercase font-bold">PDF o Immagine (Max 5MB)</p>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="application/pdf,image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>

                                {previewUrl && (
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                        className="w-full mt-4 text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center justify-center gap-2 py-2"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Rimuovi Locandina
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">URL Locandina</label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                        <input
                                            type="url"
                                            className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm"
                                            value={locandinaUrl}
                                            onChange={e => setLocandinaUrl(e.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                {/* Anteprima inline per immagini */}
                                {locandinaUrl && !locandinaUrl.toLowerCase().includes('.pdf') && (
                                    <div className="aspect-[3/4] rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden relative">
                                        <img
                                            src={locandinaUrl}
                                            alt="Anteprima locandina"
                                            className="absolute inset-0 w-full h-full object-cover"
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                )}
                                {locandinaUrl && locandinaUrl.toLowerCase().includes('.pdf') && (
                                    <div className="flex flex-col items-center gap-2 py-6 bg-red-50 rounded-2xl border border-red-100">
                                        <FileText className="w-10 h-10 text-red-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Link PDF inserito</span>
                                        <a href={locandinaUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary underline">Apri PDF</a>
                                    </div>
                                )}

                                {locandinaUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setLocandinaUrl('')}
                                        className="w-full text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center justify-center gap-2 py-2"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Rimuovi Link
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                        <div className="flex gap-4">
                            <Info className="text-primary w-6 h-6 shrink-0" />
                            <div className="space-y-2">
                                <h4 className="text-sm font-black text-primary uppercase tracking-widest">Suggerimenti</h4>
                                <ul className="text-xs text-primary/70 space-y-2 font-bold leading-relaxed">
                                    <li className="flex gap-2">• Una volta creato il torneo, potrai pianificare i turni di gioco orari.</li>
                                    <li className="flex gap-2">• La locandina è fondamentale per permettere agli atleti di conoscere i dettagli tecnici.</li>
                                    <li className="flex gap-2">• Assicurati che le date comprendano tutti i turni pianificati.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FormTorneo;
