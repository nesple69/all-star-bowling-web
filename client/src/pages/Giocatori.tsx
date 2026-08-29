import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Plus, User as UserIcon, Star, Loader2, Users, Calendar } from 'lucide-react';
import SchedaGiocatore from '../components/SchedaGiocatore';
import FormGiocatore from '../components/FormGiocatore';
import { API_BASE_URL } from '../config';

// Icona WhatsApp Custom SVG
const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.03 0C5.399 0 .007 5.391 0 12.026c0 2.119.554 4.188 1.606 6.01L0 24l6.117-1.605a11.803 11.803 0 005.917 1.6c6.625 0 12.014-5.391 12.018-12.027a11.82 11.82 0 00-3.518-8.508z" />
    </svg>
);

const buildWhatsAppCertificatoLink = (telefono: string | null | undefined, nome: string, scadenza: string | undefined) => {
    if (!telefono) return null;
    const cleaned = telefono.replace(/\D/g, '');
    const numero = cleaned.startsWith('39') ? cleaned : `39${cleaned}`;
    const dataFormatted = scadenza ? new Date(scadenza).toLocaleDateString('it-IT') : 'scaduto';
    const msg = `Ciao *${nome}*! 🎳 Ti ricordiamo che il tuo *certificato medico agonistico* per l'All Star Team è in scadenza (o scaduto) il *${dataFormatted}*. Ti chiediamo cortesemente di rinnovarlo e inviarci la copia aggiornata il prima possibile per consentire la partecipazione ai prossimi tornei. Grazie! ⭐`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
};

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
    const [selectedStagioneId, setSelectedStagioneId] = useState<string>(''); // Default: vuoto -> attiva

    // Modals state
    const [selectedGiocatore, setSelectedGiocatore] = useState<Giocatore | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingGiocatore, setEditingGiocatore] = useState<Giocatore | null>(null);

    const { token, isAdmin } = useAuth();

    // Fetch stagioni
    const { data: stagioni = [] } = useQuery({
        queryKey: ['stagioni'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/stagioni`);
            return res.data;
        }
    });

    const stagioneAttiva = useMemo(() => stagioni.find((s: any) => s.attiva), [stagioni]);
    // Solo l'admin può cambiare la stagione visualizzata; per gli utenti regolari è sempre la stagione attiva
    const effectiveStagioneId = (isAdmin() && selectedStagioneId)
        ? selectedStagioneId
        : (stagioneAttiva ? stagioneAttiva.id : '');

    const currentStagioneObj = useMemo(() => {
        if (effectiveStagioneId === 'ALL') return { nome: 'Tutte le stagioni (Storico Globale)' };
        return stagioni.find((s: any) => s.id === effectiveStagioneId) || stagioneAttiva;
    }, [stagioni, effectiveStagioneId, stagioneAttiva]);

    const fetchGiocatoriData = async () => {
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await axios.get(`${API_BASE_URL}/api/giocatori`, {
            params: {
                categoria: selectedCategory !== 'ALL' ? selectedCategory : undefined,
                stagioneId: effectiveStagioneId || undefined
            },
            ...config
        });
        return res.data;
    };

    const { data: giocatori = [], isLoading, refetch } = useQuery({
        queryKey: ['giocatori', selectedCategory, effectiveStagioneId, token],
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

                return matchesSearch && matchesCategory && matchesSettore;
            })
            .sort((a: Giocatore, b: Giocatore) => (b.mediaAttuale || 0) - (a.mediaAttuale || 0) || a.cognome.localeCompare(b.cognome));
    }, [giocatori, searchTerm, selectedCategory, selectedSettore]);

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
                            {filteredGiocatori.length} Atleti nella Stagione • <span className="text-primary">{currentStagioneObj?.nome}</span>
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

            {/* Indicatore Conteggio Atleti Stagione */}
            <div className="flex items-center gap-2">
                <div className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-green-600 text-white shadow-md shadow-green-600/20 flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-300"></span>
                    <span>Atleti Stagione Attiva ({filteredGiocatori.length})</span>
                </div>
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

                    {isAdmin() && (
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            <select
                                className="bg-gray-50 border-2 border-primary/40 rounded-md px-4 py-2 font-bold text-sm text-dark focus:border-primary focus:ring-0 outline-none cursor-pointer"
                                value={effectiveStagioneId}
                                onChange={(e) => setSelectedStagioneId(e.target.value)}
                            >
                                {stagioni.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                        {s.nome} {s.attiva ? '⭐ (Attiva)' : ''}
                                    </option>
                                ))}
                                <option value="ALL">Tutte le stagioni (Storico Globale)</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Banner info stagione */}
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-xs">
                <div className="flex items-center gap-2 text-primary font-bold">
                    <Calendar className="w-4 h-4" />
                    <span>Statistiche {isAdmin() ? 'visualizzate' : 'ufficiali'} (Tornei, Partite, Media): <strong className="uppercase">{currentStagioneObj?.nome || 'Stagione Attiva'}</strong></span>
                </div>
                {effectiveStagioneId !== 'ALL' && currentStagioneObj?.attiva && (
                    <span className="bg-green-100 text-green-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                        Stagione in corso
                    </span>
                )}
            </div>

            {/* Player Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center w-8">St</th>
                                <th className="px-2 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider">Atleta</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Cat</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Sen</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Az</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-primary tracking-wider text-center" title="Tornei giocati nella stagione">Trn</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-primary tracking-wider text-center" title="Partite giocate nella stagione">Prt</th>
                                <th className="px-1 py-3 text-[9px] font-black uppercase text-primary tracking-wider text-center" title="Media nella stagione">Med</th>
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

                                return (
                                    <tr
                                        key={g.id}
                                        onClick={() => setSelectedGiocatore(g)}
                                        className="hover:bg-primary/5 transition-colors cursor-pointer group"
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
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span className={`text-xs font-bold ${isCertificatoScaduto ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                                            {g.certificatoMedicoScadenza ? new Date(g.certificatoMedicoScadenza).toLocaleDateString('it-IT') : 'NO'}
                                                        </span>
                                                        {isCertificatoScaduto && (() => {
                                                            const waLink = buildWhatsAppCertificatoLink(g.telefono, g.nome, g.certificatoMedicoScadenza);
                                                            return waLink ? (
                                                                <a
                                                                    href={waLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    title="Invia promemoria WhatsApp"
                                                                    className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm"
                                                                >
                                                                    <WhatsAppIcon className="w-3.5 h-3.5" />
                                                                </a>
                                                            ) : null;
                                                        })()}
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
