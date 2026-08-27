import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Calendar, Phone, CreditCard, Building, Mail, Lock, ShieldAlert } from 'lucide-react';

interface Props {
    giocatore?: any;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

const CATEGORIES = ['A', 'B', 'C', 'D', 'ES', 'DS'];

const CATEGORY_LABELS: Record<string, string> = {
    'A': 'A - Eccellenza',
    'B': 'B - Eccellenza',
    'C': 'C - Cadetti',
    'D': 'D - Cadetti',
    'ES': 'ES - Esordienti',
    'DS': 'DS - Dirigenti'
};

const FASCIE_SENIOR = ['A', 'B', 'C'];


const FormGiocatore: React.FC<Props> = ({ giocatore, onClose, onSave }) => {
    const isEditing = !!giocatore;
    const [formData, setFormData] = useState({
        nome: '',
        cognome: '',
        email: '',
        password: '',
        dataNascita: '',
        telefono: '',
        numeroTessera: '',
        sesso: 'M',
        categoria: 'D',
        isSenior: false,
        fasciaSenior: 'NONE',
        certificatoMedicoScadenza: '',
        aziendaAffiliata: '',
        isAziendale: false,
        attivo: true,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (giocatore) {
            setFormData({
                nome: giocatore.nome || '',
                cognome: giocatore.cognome || '',
                email: giocatore.user?.email || '',
                password: '', // Non pre-popoliamo la password in modifica
                dataNascita: giocatore.dataNascita ? giocatore.dataNascita.split('T')[0] : '',
                telefono: giocatore.telefono || '',
                numeroTessera: giocatore.numeroTessera || '',
                sesso: giocatore.sesso || 'M',
                categoria: giocatore.categoria || 'D',
                isSenior: giocatore.isSenior || false,
                fasciaSenior: giocatore.fasciaSenior || 'NONE',
                certificatoMedicoScadenza: giocatore.certificatoMedicoScadenza ? giocatore.certificatoMedicoScadenza.split('T')[0] : '',
                aziendaAffiliata: giocatore.aziendaAffiliata || '',
                isAziendale: giocatore.isAziendale || false,
                attivo: giocatore.attivo !== undefined ? giocatore.attivo : true,
            });
        }
    }, [giocatore]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await onSave(formData);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Errore durante il salvataggio. Riprova.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border-2 border-secondary relative animate-in slide-in-from-bottom-4 duration-300">

                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-light-blue p-6 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold font-heading uppercase tracking-wide">
                        {isEditing ? 'Modifica Giocatore ⭐' : 'Nuovo Giocatore ⭐'}
                    </h2>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sezione Anagrafica */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">Dati Personali</h3>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Nome *</label>
                                <input
                                    required
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-md px-4 py-2.5 focus:border-primary outline-none transition-all"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Cognome *</label>
                                <input
                                    required
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-md px-4 py-2.5 focus:border-primary outline-none transition-all"
                                    value={formData.cognome}
                                    onChange={e => setFormData({ ...formData, cognome: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Data di Nascita *</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary outline-none"
                                        value={formData.dataNascita}
                                        onChange={e => setFormData({ ...formData, dataNascita: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Sesso *</label>
                                <div className="flex gap-4">
                                    <label className="flex-1 flex items-center justify-center gap-2 p-2.5 bg-gray-50 border-2 border-gray-200 rounded-md cursor-pointer hover:border-primary transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="radio"
                                            name="sesso"
                                            className="accent-primary"
                                            checked={formData.sesso === 'M'}
                                            onChange={() => setFormData({ ...formData, sesso: 'M' })}
                                        />
                                        <span className="text-sm font-bold text-dark uppercase">Maschile</span>
                                    </label>
                                    <label className="flex-1 flex items-center justify-center gap-2 p-2.5 bg-gray-50 border-2 border-gray-200 rounded-md cursor-pointer hover:border-primary transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="radio"
                                            name="sesso"
                                            className="accent-primary"
                                            checked={formData.sesso === 'F'}
                                            onChange={() => setFormData({ ...formData, sesso: 'F' })}
                                        />
                                        <span className="text-sm font-bold text-dark uppercase">Femminile</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Sezione Accesso / Tecnico */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">Dati Club & Accesso</h3>
                            {!isEditing && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Email (Accesso App) *</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="email"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary outline-none"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Password Iniziale</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="password"
                                                placeholder="Bowling2026! (Default)"
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary outline-none"
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Categoria FISB *</label>
                                <select
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-md px-4 py-2.5 focus:border-primary outline-none font-semibold text-sm"
                                    value={formData.categoria}
                                    onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Numero Tessera</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary outline-none"
                                        value={formData.numeroTessera}
                                        onChange={e => setFormData({ ...formData, numeroTessera: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Telefono</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary outline-none"
                                        value={formData.telefono}
                                        onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sezione Circuiti Speciali */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.isSenior}
                                            onChange={e => setFormData({ ...formData, isSenior: e.target.checked, fasciaSenior: e.target.checked ? 'A' : 'NONE' })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-secondary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                                    </div>
                                    <span className="text-xs font-bold text-dark uppercase tracking-wide">Partecipa al Circuito Senior</span>
                                </label>

                                {formData.isSenior && (
                                    <div className="animate-in fade-in slide-in-from-left-2 duration-200 pl-14">
                                        <label className="block text-[10px] font-black text-secondary uppercase mb-1 tracking-tighter">Fascia Senior *</label>
                                        <select
                                            className="w-full max-w-[150px] bg-secondary/5 border-2 border-secondary/20 rounded-md px-3 py-1.5 focus:border-secondary outline-none font-bold text-sm text-secondary"
                                            value={formData.fasciaSenior}
                                            onChange={e => setFormData({ ...formData, fasciaSenior: e.target.value })}
                                        >
                                            {FASCIE_SENIOR.map(f => (
                                                <option key={f} value={f}>Fascia {f}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.attivo}
                                            onChange={e => setFormData({ ...formData, attivo: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                    </div>
                                    <span className="text-xs font-bold text-dark uppercase tracking-wide">
                                        Tesserato Attivo (Stagione Corrente)
                                    </span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.isAziendale}
                                            onChange={e => setFormData({ ...formData, isAziendale: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-secondary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </div>
                                    <span className="text-xs font-bold text-dark uppercase tracking-wide">Partecipa al Circuito Aziendale</span>
                                </label>
                            </div>
                        </div>

                        {/* Sezione Altri Dati */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1 text-red-600 flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    Scadenza Certificato Medico
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-red-50 border-2 border-red-100 rounded-md focus:border-red-400 outline-none text-sm"
                                    value={formData.certificatoMedicoScadenza}
                                    onChange={e => setFormData({ ...formData, certificatoMedicoScadenza: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-dark uppercase mb-1.5 ml-1">Azienda Affiliata / Sponsor</label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-md focus:border-primary outline-none"
                                        value={formData.aziendaAffiliata}
                                        onChange={e => setFormData({ ...formData, aziendaAffiliata: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border-2 border-gray-200 rounded-md text-gray-500 font-bold uppercase text-xs hover:bg-gray-50 transition-all"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex items-center gap-2 bg-secondary text-white px-8 py-3 rounded-md font-bold uppercase text-xs shadow-md hover:bg-[#E5A600] transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <Save className="w-4 h-4" />
                            {isLoading ? 'Salvataggio...' : 'Salva Giocatore ⭐'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FormGiocatore;
