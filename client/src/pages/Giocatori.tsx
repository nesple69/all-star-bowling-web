import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Plus, User as UserIcon, Star, Loader2, Users } from 'lucide-react';
import SchedaGiocatore from '../components/SchedaGiocatore';
import FormGiocatore from '../components/FormGiocatore';
import { API_BASE_URL } from '../config';

interface Giocatore {
    id: string;
    nome: string;
    cognome: string;
    sesso: 'M' | 'F';
    categoria: string;
    isSenior: boolean;
    fasciaSenior: string;
    mediaAttuale: number;
    numeroTessera: string;
    migliorPartita: number;
    totaleBirilli: number;
    dataNascita: string;
    telefono?: string;
    certificatoMedicoScadenza?: string;
    aziendaAffiliata?: string;
    isAziendale?: boolean;
    attivo?: boolean;
    torneiGiocati?: number;
    partiteGiocate?: number;
    user?: {
        email: string;
    };
}

const CATEGORIES = ['ALL', 'A', 'B', 'C', 'D', 'ES', 'DS'];

const CATEGORY_LABELS: Record<string, string> = {
    'ALL': 'Tutte le categorie',
    'A': 'A - Eccellenza',
    'B': 'B - Eccellenza',
    'C': 'C - Cadetti',
    'D': 'D - Cadetti',
    'ES': 'ES - Esordienti',
    'DS': 'DS - Dirigenti'
};

const CATEGORY_COLORS: Record<string, string> = {
    'A': 'text-amber-600 border-amber-600 bg-amber-50/50',
    'B': 'text-amber-500 border-amber-500 bg-amber-50/30',
    'C': 'text-purple-600 border-purple-600 bg-purple-50/50',
    'D': 'text-purple-500 border-purple-500 bg-purple-50/30',
    'ES': 'text-green-600 border-green-600 bg-green-50/50',
    'DS': 'text-slate-600 border-slate-600 bg-slate-50/50',
};

const Giocatori: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedSettore, setSelectedSettore] = useState('ALL'); // 'ALL', 'SENIOR', 'AZIENDALE'
    const [selectedStato, setSelectedStato] = useState<'ALL' | 'ATTIVI' | 'INATTIVI'>('ATTIVI'); // Default: solo attivi della stagione corrente

    // Modals state
    const [selectedGiocatore, setSelectedGiocatore] = useState<Giocatore | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingGiocatore, setEditingGiocatore] = useState<Giocatore | null>(null);

    const { token, isAdmin } = useAuth();

    const fetchGiocatoriData = async () => {
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await axios.get(`${API_BASE_URL}/api/giocatori`, {
            params: { categoria: selectedCategory !== 'ALL' ? selectedCategory : undefined },
            ...config
        });
        return res.data;
    };

    const { data: giocatori = [], isLoading, refetch } = useQuery({
        queryKey: ['giocatori', selectedCategory, token],
        queryFn: fetchGiocatoriData,
    });

    const handleSavePlayer = async (formData: any) => {
        try {
            if (editingGiocatore) {
                await axios.put(`${API_BASE_URL}/api/giocatori/${editingGiocatore.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_BASE_URL}/api/giocatori`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            await refetch();
            setIsFormOpen(false);
            setEditingGiocatore(null);
        } catch (error) {
            throw error;
        }
    };

    const handleEditClick = () => {
        setEditingGiocatore(selectedGiocatore);
        setIsFormOpen(true);
        setSelectedGiocatore(null);
    };

    const handleDeleteGiocatore = async () => {
        if (!selectedGiocatore) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/giocatori/${selectedGiocatore.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refetch();
            setSelectedGiocatore(null);
        } catch (error) {
            console.error('Errore durante l\'eliminazione del giocatore', error);
            alert('Errore durante l\'eliminazione del giocatore.');
        }
    };

    const handleToggleAttivo = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await axios.patch(`${API_BASE_URL}/api/giocatori/${id}/toggle-attivo`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refetch();
        } catch (error) {
            console.error('Errore durante la modifica dello stato tesserato', error);
            alert('Errore durante la modifica dello stato.');
        }
    };

    const countAttivi = useMemo(() => giocatori.filter((g: Giocatore) => g.attivo !== false).length, [giocatori]);
    const countInattivi = useMemo(() => giocatori.filter((g: Giocatore) => g.attivo === false).length, [giocatori]);

    const filteredGiocatori = useMemo(() => {
        return giocatori
            .filter((g: Giocatore) => {
                const fullName = `${g.nome} ${g.cognome}`.toLowerCase();
                const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                    g.numeroTessera?.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategory === 'ALL' || g.categoria === selectedCategory;
                const matchesSettore = selectedSettore === 'ALL' ||
                    (selectedSettore === 'SENIOR' && g.isSenior) ||
                    (selectedSettore === 'AZIENDALE' && g.isAziendale);
                
                const matchesStato = selectedStato === 'ALL' ||
                    (selectedStato === 'ATTIVI' && g.attivo !== false) ||
                    (selectedStato === 'INATTIVI' && g.attivo === false);

                return matchesSearch && matchesCategory && matchesSettore && matchesStato;
            })
            .sort((a: Giocatore, b: Giocatore) => (b.mediaAttuale || 0) - (a.mediaAttuale || 0) || a.cognome.localeCompare(b.cognome));
    }, [giocatori, searchTerm, selectedCategory, selectedSettore, selectedStato]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
                <p className="text-gray-500 animate-pulse font-heading uppercase text-sm tracking-widest">Caricamento Giocatori...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold text-dark font-heading">LISTA GIOCATORI</h1>
                        <p className="text-gray-500 text-xs uppercase tracking-widest font-bold mt-1">
                            {filteredGiocatori.length} Atleti Visualizzati • {countAttivi} Attivi in Rosa • {countInattivi} Storico/Non Rinnovati
                        </p>
                    </div>
                </div>

                {isAdmin() && (
                    <button
                        onClick={() => {
                            setSelectedGiocatore(null);
                            setIsFormOpen(true);
                        }}
                        className="bg-secondary hover:bg-secondary/90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 uppercase text-xs tracking-widest"
                    >
                        <Plus className="w-4 h-4" />
                        Aggiungi Giocatore
                    </button>
                )}
            </div>

            {/* Stato Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                <button
                    onClick={() => setSelectedStato('ATTIVI')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                        selectedStato === 'ATTIVI'
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-green-300"></span>
                    Attivi Stagione ({countAttivi})
                </button>

                <button
                    onClick={() => setSelectedStato('ALL')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                        selectedStato === 'ALL'
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Tutti ({giocatori.length})
                </button>

                <button
                    onClick={() => setSelectedStato('INATTIVI')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                        selectedStato === 'INATTIVI'
                            ? 'bg-gray-700 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    Non Rinnovati / Storico ({countInattivi})
                </button>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cerca per nome o tessera..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary focus:ring-0 transition-colors outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <select
                            className="bg-gray-50 border-2 border-gray-200 rounded-md px-4 py-2 font-semibold text-sm focus:border-primary focus:ring-0 outline-none"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-500" />
                        <select
                            className="bg-gray-50 border-2 border-gray-200 rounded-md px-4 py-2 font-semibold text-sm focus:border-primary focus:ring-0 outline-none"
                            value={selectedSettore}
                            onChange={(e) => setSelectedSettore(e.target.value)}
                        >
                            <option value="ALL">Tutti i Settori</option>
                            <option value="SENIOR">Solo Senior</option>
                            <option value="AZIENDALE">Solo Aziendale</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Player Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center w-8">St</th>
                                <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider">Atleta</th>
                                <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Stato</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Cat</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Sen</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Az</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Trn</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Prt</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Med</th>
                                <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider">Tessera</th>
                                {isAdmin() && (
                                    <>
                                        <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Telefono</th>
                                        <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Certificato</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredGiocatori.map((g: Giocatore) => {
                                const isCertificatoScaduto = g.certificatoMedicoScadenza
                                    ? new Date(g.certificatoMedicoScadenza) < new Date()
                                    : true;
                                const isAttivo = g.attivo !== false;

                                return (
                                    <tr
                                        key={g.id}
                                        onClick={() => setSelectedGiocatore(g)}
                                        className={`hover:bg-primary/5 transition-colors cursor-pointer group ${!isAttivo ? 'bg-gray-50/50 opacity-75' : ''}`}
                                    >
                                        <td className="px-2 py-2 text-center">
                                            <div className="flex justify-center">
                                                {g.mediaAttuale >= 200 && (
                                                    <div className="p-1 bg-secondary/10 text-secondary rounded-lg" title="Top Player">
                                                        <Star className="w-3 h-3 fill-current" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <p className="text-sm font-bold text-dark group-hover:text-primary transition-colors whitespace-nowrap">{g.cognome} {g.nome}</p>
                                        </td>
                                        <td className="px-2 py-2 text-center" onClick={(e) => { if (isAdmin()) handleToggleAttivo(e, g.id); }}>
                                            <span
                                                title={isAdmin() ? 'Clicca per attivare/disattivare stato' : undefined}
                                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 transition-all ${
                                                    isAttivo
                                                        ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                                                        : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'
                                                }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isAttivo ? 'bg-green-600' : 'bg-gray-500'}`}></span>
                                                {isAttivo ? 'Attivo' : 'Non Rinnovato'}
                                            </span>
                                        </td>
                                        <td className="px-1 py-2 text-center">
                                            <span className={`px-1 py-0.5 border rounded text-[9px] font-black uppercase tracking-tight ${CATEGORY_COLORS[g.categoria] || 'text-gray-500 border-gray-400'}`}>
                                                {g.sesso}/{g.categoria}
                                            </span>
                                        </td>
                                        <td className="px-1 py-2 text-center">
                                            {g.isSenior ? (
                                                <span className="px-1 py-0.5 border border-secondary bg-secondary text-white rounded text-[9px] font-black uppercase tracking-tight shadow-sm">
                                                    {g.fasciaSenior}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-gray-300 uppercase">NO</span>
                                            )}
                                        </td>
                                        <td className="px-1 py-2 text-center text-[10px]">
                                            {g.isAziendale ? (
                                                <span className="font-bold text-gray-600 truncate max-w-[60px] inline-block" title={g.aziendaAffiliata}>
                                                    {g.aziendaAffiliata || 'Sì'}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-gray-300 uppercase">NO</span>
                                            )}
                                        </td>
                                        <td className="px-1 py-2 text-center">
                                            <p className="text-xs font-bold text-gray-600">{g.torneiGiocati || 0}</p>
                                        </td>
                                        <td className="px-1 py-2 text-center">
                                            <p className="text-xs font-bold text-gray-600">{g.partiteGiocate || 0}</p>
                                        </td>
                                        <td className="px-1 py-2 text-center">
                                            <p className="text-xs font-bold text-primary">{g.mediaAttuale?.toFixed(1) || '0.0'}</p>
                                        </td>
                                        <td className="px-2 py-2">
                                            <p className="text-xs font-bold text-dark font-mono">{g.numeroTessera || '-'}</p>
                                        </td>
                                        {isAdmin() && (
                                            <>
                                                <td className="px-2 py-2 text-xs font-semibold text-dark text-center whitespace-nowrap">{g.telefono || '-'}</td>
                                                <td className="px-2 py-2 text-center">
                                                    <div className={`text-xs font-bold ${isCertificatoScaduto ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                                        {g.certificatoMedicoScadenza ? new Date(g.certificatoMedicoScadenza).toLocaleDateString('it-IT') : 'NO'}
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredGiocatori.length === 0 && (
                <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-200">
                    <UserIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-500 uppercase">Nessun giocatore trovato</h3>
                    <p className="text-gray-400 text-sm">Prova a cambiare i filtri o la ricerca.</p>
                </div>
            )}

            {/* Modals */}
            {selectedGiocatore && (
                <SchedaGiocatore
                    giocatore={selectedGiocatore}
                    onClose={() => setSelectedGiocatore(null)}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteGiocatore}
                    isAdmin={isAdmin()}
                />
            )}

            {isFormOpen && (
                <FormGiocatore
                    giocatore={editingGiocatore}
                    onClose={() => { setIsFormOpen(false); setEditingGiocatore(null); }}
                    onSave={handleSavePlayer}
                />
            )}
        </div>
    );
};

export default Giocatori;
