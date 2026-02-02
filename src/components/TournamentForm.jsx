import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trophy, Calendar, MapPin, Hash, Upload, Save, X, FileText } from 'lucide-react';

const TournamentForm = ({ tournament, onSave, onCancel }) => {
    const [formData, setFormData] = useState(tournament || {
        nome: '',
        data_inizio: '',
        data_fine: '',
        sede: '',
        numero_partite: 6,
        locandina_url: ''
    });

    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (event) => {
        try {
            setUploading(true);
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `posters/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('tornei')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('tornei')
                .getPublicUrl(filePath);

            setFormData({ ...formData, locandina_url: publicUrl });
        } catch (error) {
            alert('Errore nel caricamento della locandina: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="p-8 rounded-3xl neumorphic-out max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8 flex items-center justify-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                {tournament ? 'Modifica Torneo' : 'Nuovo Torneo'}
            </h2>

            {/* Nome Torneo */}
            <div className="space-y-2">
                <label className="text-sm font-medium ml-4 text-gray-400">Nome Torneo</label>
                <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                    placeholder="Esempio: Campionato Regionale 2024"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data Inizio */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Data Inizio</label>
                    <input
                        type="date"
                        required
                        value={formData.data_inizio}
                        onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none invert brightness-90 grayscale"
                    />
                </div>

                {/* Data Fine */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Data Fine (Opzionale)</label>
                    <input
                        type="date"
                        value={formData.data_fine}
                        onChange={(e) => setFormData({ ...formData, data_fine: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none invert brightness-90 grayscale"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sede */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Sede di Gioco</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            required
                            value={formData.sede}
                            onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                            placeholder="Bowling Valdera"
                        />
                    </div>
                </div>

                {/* Numero Partite */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Numero Partite</label>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="number"
                            required
                            min="1"
                            value={formData.numero_partite}
                            onChange={(e) => setFormData({ ...formData, numero_partite: parseInt(e.target.value) })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Locandina */}
            <div className="p-6 rounded-2xl neumorphic-out border border-white/5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <span className="font-bold">Locandina Torneo</span>
                </div>

                <div className="relative">
                    <label className="w-full flex flex-col items-center px-4 py-6 rounded-xl neumorphic-in cursor-pointer hover:bg-white/5 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-400 text-center">
                            {uploading ? 'Caricamento...' : formData.locandina_url ? 'Locandina Caricata (Sostituisci)' : 'Carica Locandina (PDF)'}
                        </span>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf" disabled={uploading} />
                    </label>
                </div>
                {formData.locandina_url && (
                    <div className="text-xs text-center text-blue-400 underline pt-2">
                        <a href={formData.locandina_url} target="_blank" rel="noreferrer">Visualizza PDF attuale</a>
                    </div>
                )}
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
                    <Save className="w-5 h-5" /> Salva Torneo
                </button>
            </div>
        </form>
    );
};

export default TournamentForm;
