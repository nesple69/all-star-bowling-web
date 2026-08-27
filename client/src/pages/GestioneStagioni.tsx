import React, { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { Calendar, Plus, Trash2, CheckCircle2, AlertCircle, Save, ArrowLeft, Download, UserCheck, X, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface Stagione {
    id: string;
    nome: string;
    dataInizio: string;
    dataFine: string;
    attiva: boolean;
}

interface GiocatoreRinnovo {
    id: string;
    nome: string;
    cognome: string;
    numeroTessera?: string;
    categoria: string;
    attivo?: boolean;
}

const GestioneStagioni: React.FC = () => {
    const fetchStagioniData = async () => {
        const response = await axios.get(`${API_BASE_URL}/api/stagioni`);
        return response.data as Stagione[];
    };

    const { data: stagioni = [], isLoading, refetch: fetchStagioni } = useQuery({
        queryKey: ['stagioni'],
        queryFn: fetchStagioniData,
    });

    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    // Form per nuova stagione
    const [showForm, setShowForm] = useState(false);
    const [newStagione, setNewStagione] = useState({
        nome: '',
        dataInizio: format(new Date(), 'yyyy-MM-dd'),
        dataFine: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
        attiva: false
    });

    // Modale Rinnovi Squadra
    const [showRinnoviModal, setShowRinnoviModal] = useState(false);
    const [giocatoriRinnovo, setGiocatoriRinnovo] = useState<GiocatoreRinnovo[]>([]);
    const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
    const [searchRinnovi, setSearchRinnovi] = useState('');
    const [isLoadingRinnovi, setIsLoadingRinnovi] = useState(false);
    const [isSavingRinnovi, setIsSavingRinnovi] = useState(false);

    const handleOpenRinnoviModal = async () => {
        setIsLoadingRinnovi(true);
        setShowRinnoviModal(true);
        const token = sessionStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASE_URL}/api/giocatori`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const list: GiocatoreRinnovo[] = res.data;
            setGiocatoriRinnovo(list);
            const map: Record<string, boolean> = {};
            list.forEach(g => {
                map[g.id] = g.attivo !== false;
            });
            setSelectedMap(map);
        } catch (err: any) {
            setStatus({ type: 'error', message: 'Errore nel caricamento dei giocatori per il rinnovo.' });
        } finally {
            setIsLoadingRinnovi(false);
        }
    };

    const handleSaveRinnovi = async () => {
        setIsSavingRinnovi(true);
        const token = sessionStorage.getItem('token');
        try {
            const rinnovatiIds: string[] = [];
            const nonRinnovatiIds: string[] = [];

            giocatoriRinnovo.forEach(g => {
                if (selectedMap[g.id]) {
                    rinnovatiIds.push(g.id);
                } else {
                    nonRinnovatiIds.push(g.id);
                }
            });

            await axios.post(`${API_BASE_URL}/api/stagioni/rinnovi-bulk`, {
                rinnovatiIds,
                nonRinnovatiIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setStatus({
                type: 'success',
                message: `Rinnovi salvati! ${rinnovatiIds.length} atleti attivi in rosa, ${nonRinnovatiIds.length} conservati nello storico.`
            });
            setShowRinnoviModal(false);
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Errore nel salvataggio rinnovi.' });
        } finally {
            setIsSavingRinnovi(false);
        }
    };

    const handleSelectAll = (value: boolean) => {
        const newMap = { ...selectedMap };
        giocatoriRinnovo.forEach(g => {
            newMap[g.id] = value;
        });
        setSelectedMap(newMap);
    };

    const filteredGiocatoriRinnovo = giocatoriRinnovo.filter(g => {
        const text = `${g.nome} ${g.cognome} ${g.numeroTessera || ''}`.toLowerCase();
        return text.includes(searchRinnovi.toLowerCase());
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = sessionStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/api/stagioni`, newStagione, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus({ type: 'success', message: 'Stagione creata con successo!' });
            setShowForm(false);
            setNewStagione({
                nome: '',
                dataInizio: format(new Date(), 'yyyy-MM-dd'),
                dataFine: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
                attiva: false
            });
            fetchStagioni();
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Errore nella creazione.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Eliminare questa stagione?')) return;
        const token = sessionStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/api/stagioni/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus({ type: 'success', message: 'Stagione eliminata.' });
            fetchStagioni();
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Errore nell\'eliminazione.' });
        }
    };

    const handleSetAttiva = async (id: string) => {
        const token = sessionStorage.getItem('token');
        const stagione = stagioni.find(s => s.id === id);
        if (!stagione) return;

        try {
            await axios.put(`${API_BASE_URL}/api/stagioni/${id}`, { ...stagione, attiva: true }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus({ type: 'success', message: 'Stagione attiva aggiornata.' });
            fetchStagioni();
        } catch (err: any) {
            setStatus({ type: 'error', message: 'Errore nell\'attivazione.' });
        }
    };

    const handleDownloadBackup = async (stagioneId: string, stagioneName: string) => {
        const token = sessionStorage.getItem('token');
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/backup/genera/${stagioneId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );

            // Crea un link temporaneo e triggera il download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `backup-${stagioneName}-${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setStatus({ type: 'success', message: 'Backup PDF scaricato!' });
        } catch (err: any) {
            setStatus({ type: 'error', message: 'Errore nel download del backup.' });
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 text-dark">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/admin/tornei" className="p-2.5 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-primary transition-all shadow-sm">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Calendar className="text-secondary w-7 h-7" />
                            Gestione Stagioni
                        </h1>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 italic">Definisci i periodi agonistici (es. 2025/2026)</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenRinnoviModal}
                        className="bg-green-600 hover:bg-green-700 text-white font-black px-5 py-3 rounded-2xl flex items-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-green-600/20 hover:scale-105 transition-all"
                    >
                        <UserCheck className="w-4 h-4" />
                        Rinnovi Squadra
                    </button>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-primary text-white font-black px-6 py-3 rounded-2xl flex items-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Nuova Stagione
                        </button>
                    )}
                </div>
            </div>

            {status.type && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-slide-up ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <p className="text-sm font-black uppercase tracking-tight">{status.message}</p>
            </div>
            )}

            {showForm && (
                <form onSubmit={handleCreate} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm animate-slide-up space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome (es. 2025/2026)</label>
                            <input
                                required
                                value={newStagione.nome}
                                onChange={e => setNewStagione({ ...newStagione, nome: e.target.value })}
                                placeholder="2025/2026"
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Data Inizio</label>
                            <input
                                required
                                type="date"
                                value={newStagione.dataInizio}
                                onChange={e => setNewStagione({ ...newStagione, dataInizio: e.target.value })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Data Fine</label>
                            <input
                                required
                                type="date"
                                value={newStagione.dataFine}
                                onChange={e => setNewStagione({ ...newStagione, dataFine: e.target.value })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={newStagione.attiva}
                                onChange={e => setNewStagione({ ...newStagione, attiva: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-[10px] font-black uppercase text-gray-500">Imposta come stagione attiva</span>
                        </label>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 font-black uppercase text-[10px] text-gray-400 hover:text-dark transition-colors tracking-widest">Annulla</button>
                            <button type="submit" className="bg-primary text-white font-black px-8 py-3 rounded-2xl flex items-center gap-2 uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                                <Save className="w-4 h-4" />
                                Salva Stagione
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <th className="px-8 py-5">Nome</th>
                            <th className="px-8 py-5">Periodo</th>
                            <th className="px-8 py-5 text-center">Stato</th>
                            <th className="px-8 py-5 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {stagioni.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50/30 transition-colors group">
                                <td className="px-8 py-5">
                                    <span className="font-black text-dark uppercase tracking-tight">{s.nome}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <span className="text-xs font-bold text-gray-500 uppercase">
                                        {format(new Date(s.dataInizio), 'dd/MM/yy')} - {format(new Date(s.dataFine), 'dd/MM/yy')}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    {s.attiva ? (
                                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-green-200">Attiva</span>
                                    ) : (
                                        <button
                                            onClick={() => handleSetAttiva(s.id)}
                                            className="text-[10px] font-black uppercase text-gray-300 hover:text-primary transition-colors tracking-widest"
                                        >
                                            Rendi Attiva
                                        </button>
                                    )}
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleDownloadBackup(s.id, s.nome)}
                                            className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all"
                                            title="Scarica Backup PDF"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(s.id)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Elimina Stagione"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {stagioni.length === 0 && (
                    <div className="p-20 text-center space-y-4">
                        <Calendar className="w-16 h-16 text-gray-100 mx-auto" />
                        <p className="text-sm font-black text-gray-300 uppercase">Nessuna stagione configurata</p>
                    </div>
                )}
            </div>

            {/* Modal Rinnovi Tesserati */}
            {showRinnoviModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-gray-100 relative p-8 space-y-6 animate-slide-up">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <UserCheck className="w-7 h-7 text-green-600" />
                                <div>
                                    <h2 className="text-xl font-black uppercase text-dark">Rinnovi Squadra & Passaggio Stagione</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                        Spunta gli atleti che proseguono l'attività nella nuova stagione.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowRinnoviModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-bold text-amber-800 space-y-1">
                            <p>💡 <strong>Come funziona la conservazione dello storico:</strong></p>
                            <p>Gli atleti deselezionati vengono impostati come <em>"Non Rinnovati / Storico"</em>: non compariranno nelle selezioni dei nuovi tornei, ma tutto il loro storico (gare, scorecard passate e cassa) rimarrà memorizzato e consultabile.</p>
                        </div>

                        {/* Search and Quick Filters */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca atleta..."
                                    value={searchRinnovi}
                                    onChange={e => setSearchRinnovi(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleSelectAll(true)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-xl transition-colors"
                                >
                                    Seleziona Tutti
                                </button>
                                <button
                                    onClick={() => handleSelectAll(false)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-xl transition-colors"
                                >
                                    Deseleziona Tutti
                                </button>
                            </div>
                        </div>

                        {/* Lista Checklist Atleti */}
                        <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-2xl divide-y divide-gray-100">
                            {isLoadingRinnovi ? (
                                <div className="p-12 text-center text-gray-400 text-xs font-bold uppercase animate-pulse">
                                    Caricamento atleti...
                                </div>
                            ) : filteredGiocatoriRinnovo.map(g => {
                                const isChecked = !!selectedMap[g.id];
                                return (
                                    <div
                                        key={g.id}
                                        onClick={() => setSelectedMap({ ...selectedMap, [g.id]: !isChecked })}
                                        className={`flex items-center justify-between p-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors ${
                                            isChecked ? 'bg-green-50/40' : 'bg-gray-50/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}}
                                                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-black text-dark uppercase">{g.cognome} {g.nome}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">
                                                    Cat. {g.categoria} • Tessera: {g.numeroTessera || 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            isChecked ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {isChecked ? 'Rinnova' : 'Non Rinnova'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-500">
                                Atleti selezionati: <strong className="text-green-600">{Object.values(selectedMap).filter(Boolean).length}</strong> su {giocatoriRinnovo.length}
                            </p>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowRinnoviModal(false)}
                                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-gray-400 hover:text-dark transition-colors tracking-wider"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={handleSaveRinnovi}
                                    disabled={isSavingRinnovi}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-green-600/20 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSavingRinnovi ? 'Salvataggio...' : 'Conferma Rinnovi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestioneStagioni;
