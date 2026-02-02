import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, Building2, Award, Calendar, FileText, Upload, Save, X } from 'lucide-react';

const CATEGORIES = ['M/A', 'M/B', 'M/C', 'M/D', 'F/A', 'F/B', 'F/C', 'F/D', 'M/ES', 'F/ES', 'M/DS', 'F/DS'];
const SENIOR_BRACKETS = [
    'MASCHILE FASCIA A', 'MASCHILE FASCIA B', 'MASCHILE FASCIA C',
    'FEMMINILE FASCIA A', 'FEMMINILE FASCIA B', 'FEMMINILE FASCIA C'
];

const PlayerForm = ({ player, onSave, onCancel }) => {
    const [formData, setFormData] = useState(player || {
        nome: '',
        cognome: '',
        categoria: 'M/A',
        settore_aziendale: false,
        nome_azienda: '',
        settore_seniores: false,
        fascia_seniores: '',
        data_scadenza_medica: '',
        certificato_url: ''
    });

    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (event) => {
        try {
            setUploading(true);
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `certificates/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('medica')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('medica')
                .getPublicUrl(filePath);

            setFormData({ ...formData, certificato_url: publicUrl });
        } catch (error) {
            alert('Errore nel caricamento del file: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.settore_aziendale && !formData.nome_azienda) {
            alert('Il nome azienda è obbligatorio per il settore aziendale');
            return;
        }
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="p-8 rounded-3xl neumorphic-out max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8 flex items-center justify-center gap-2">
                <User className="w-6 h-6 text-blue-400" />
                {player ? 'Modifica Giocatore' : 'Nuovo Giocatore'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Nome</label>
                    <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Esempio: Mario"
                    />
                </div>

                {/* Cognome */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Cognome</label>
                    <input
                        type="text"
                        required
                        value={formData.cognome}
                        onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Esempio: Rossi"
                    />
                </div>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
                <label className="text-sm font-medium ml-4 text-gray-400">Categoria</label>
                <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none appearance-none"
                >
                    {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#1a1a1a]">{cat}</option>)}
                </select>
            </div>

            {/* Settore Aziendale Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl neumorphic-out">
                <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <span className="font-medium">Settore Aziendale</span>
                </div>
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, settore_aziendale: !formData.settore_aziendale })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.settore_aziendale ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${formData.settore_aziendale ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {formData.settore_aziendale && (
                <div className="space-y-2 animate-fadeIn">
                    <label className="text-sm font-medium ml-4 text-gray-400">Nome Azienda *</label>
                    <input
                        type="text"
                        required
                        value={formData.nome_azienda}
                        onChange={(e) => setFormData({ ...formData, nome_azienda: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                        placeholder="Inserisci il nome dell'azienda"
                    />
                </div>
            )}

            {/* Settore Seniores Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl neumorphic-out">
                <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium">Settore Seniores</span>
                </div>
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, settore_seniores: !formData.settore_seniores })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.settore_seniores ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${formData.settore_seniores ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {formData.settore_seniores && (
                <div className="space-y-2 animate-fadeIn">
                    <label className="text-sm font-medium ml-4 text-gray-400">Fascia Seniores</label>
                    <select
                        value={formData.fascia_seniores}
                        onChange={(e) => setFormData({ ...formData, fascia_seniores: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none appearance-none"
                    >
                        <option value="" className="bg-[#1a1a1a]">Seleziona una fascia...</option>
                        {SENIOR_BRACKETS.map(b => <option key={b} value={b} className="bg-[#1a1a1a]">{b}</option>)}
                    </select>
                </div>
            )}

            {/* Certificato Medico */}
            <div className="p-6 rounded-2xl neumorphic-out border border-white/5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-red-400" />
                    <span className="font-bold">Certificato Medico</span>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-gray-500 ml-4">Data Scadenza</label>
                    <input
                        type="date"
                        value={formData.data_scadenza_medica}
                        onChange={(e) => setFormData({ ...formData, data_scadenza_medica: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none invert brightness-90 grayscale"
                    />
                </div>

                <div className="relative">
                    <label className="w-full flex flex-col items-center px-4 py-6 rounded-xl neumorphic-in cursor-pointer hover:bg-white/5 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-400">
                            {uploading ? 'Caricamento...' : formData.certificato_url ? 'Certificato Caricato' : 'Carica Certificato (PDF/JPG)'}
                        </span>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} />
                    </label>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-4 rounded-xl neumorphic-btn font-bold flex items-center justify-center gap-2"
                >
                    <X className="w-5 h-5" /> Annulla
                </button>
                <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-4 rounded-xl neumorphic-btn bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" /> Salva
                </button>
            </div>
        </form>
    );
};

export default PlayerForm;
