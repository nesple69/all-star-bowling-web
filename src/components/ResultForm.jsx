import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Target, Hash, Save, X, Trophy, User } from 'lucide-react';

const ResultForm = ({ result, players, tournaments, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        id_giocatore: result?.id_giocatore || '',
        id_torneo: result?.id_torneo || '',
        birilli: result?.birilli || '',
        partite: result?.partite || '',
        posizione: result?.posizione || '',
        totale_squadra: result?.totale_squadra || 0,
        punteggi_partite: result?.punteggi_partite || []
    });

    // Automatically update the number of games when a tournament is selected (only for new results)
    useEffect(() => {
        if (formData.id_torneo && !result) {
            const tournament = tournaments.find(t => t.id === formData.id_torneo);
            if (tournament) {
                setFormData(prev => ({ ...prev, partite: tournament.numero_partite }));
            }
        }
    }, [formData.id_torneo, tournaments, result]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.id_giocatore || !formData.id_torneo || !formData.birilli || !formData.partite) {
            alert('Tutti i campi sono obbligatori');
            return;
        }

        // Clean up individual scores: convert to numbers and filter out empty ones
        const scores = formData.punteggi_partite
            .map(s => parseInt(s))
            .filter(s => !isNaN(s));

        onSave({
            ...formData,
            birilli: parseInt(formData.birilli),
            partite: parseInt(formData.partite),
            posizione: formData.posizione ? parseInt(formData.posizione) : null,
            totale_squadra: formData.totale_squadra ? parseInt(formData.totale_squadra) : 0,
            punteggi_partite: scores,
            data: result?.data || new Date().toISOString()
        });
    };

    return (
        <form onSubmit={handleSubmit} className="p-8 rounded-3xl neumorphic-out max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8 flex items-center justify-center gap-2">
                <Target className="w-6 h-6 text-purple-400" />
                {result ? 'Modifica Risultato' : 'Inserisci Risultato Torneo'}
            </h2>

            {/* Selezione Giocatore */}
            <div className="space-y-2">
                <label className="text-sm font-medium ml-4 text-gray-400">Atleta</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        required
                        value={formData.id_giocatore}
                        onChange={(e) => setFormData({ ...formData, id_giocatore: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none appearance-none"
                    >
                        <option value="" className="bg-[#1a1a1a]">Seleziona Atleta...</option>
                        {players.map(p => (
                            <option key={p.id} value={p.id} className="bg-[#1a1a1a]">{p.nome} {p.cognome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Selezione Torneo */}
            <div className="space-y-2">
                <label className="text-sm font-medium ml-4 text-gray-400">Torneo</label>
                <div className="relative">
                    <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        required
                        value={formData.id_torneo}
                        onChange={(e) => setFormData({ ...formData, id_torneo: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none appearance-none"
                    >
                        <option value="" className="bg-[#1a1a1a]">Seleziona Torneo...</option>
                        {tournaments.map(t => (
                            <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.nome} ({t.sede})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Numero Birilli */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Totale Birilli Atleta</label>
                    <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="number"
                            required
                            min="0"
                            value={formData.birilli}
                            onChange={(e) => setFormData({ ...formData, birilli: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                            placeholder="Esempio: 1250"
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
                            value={formData.partite}
                            onChange={(e) => setFormData({ ...formData, partite: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Posizione in Classifica */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Posizione in Classifica</label>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="number"
                            min="1"
                            value={formData.posizione}
                            onChange={(e) => setFormData({ ...formData, posizione: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                            placeholder="Es: 1"
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 ml-4 italic">* Usata per raggruppare le squadre</p>
                </div>

                {/* Totale Squadra */}
                <div className="space-y-2">
                    <label className="text-sm font-medium ml-4 text-gray-400">Totale Squadra (Birilli)</label>
                    <div className="relative">
                        <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="number"
                            min="0"
                            value={formData.totale_squadra}
                            onChange={(e) => setFormData({ ...formData, totale_squadra: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                            placeholder="Inserisci 0 se individuale"
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 ml-4 italic">* Lascia 0 per risultati fuori squadra (riserve fuori)</p>
                </div>
            </div>

            {/* Punteggi Individuali Partite */}
            {formData.partite > 0 && (
                <div className="space-y-4 p-6 rounded-2xl bg-blue-400/5 border border-blue-400/10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-blue-400">📊 Punteggi Singole Partite (Opzionale)</h3>
                        <button
                            type="button"
                            onClick={() => {
                                const numGames = parseInt(formData.partite);
                                const gameScores = Array(numGames).fill('');
                                setFormData({ ...formData, punteggi_partite: gameScores, birilli: '' });
                            }}
                            className="text-xs px-3 py-1 rounded-lg neumorphic-btn text-gray-400"
                        >
                            {formData.punteggi_partite.length > 0 ? 'Reset' : 'Abilita'}
                        </button>
                    </div>

                    {formData.punteggi_partite.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {formData.punteggi_partite.map((score, index) => (
                                    <div key={index} className="space-y-1">
                                        <label className="text-[10px] text-gray-500 ml-2">Partita {index + 1}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="300"
                                            value={score}
                                            onChange={(e) => {
                                                const newScores = [...formData.punteggi_partite];
                                                newScores[index] = e.target.value;
                                                const total = newScores.reduce((sum, s) => sum + (parseInt(s) || 0), 0);
                                                setFormData({
                                                    ...formData,
                                                    punteggi_partite: newScores,
                                                    birilli: total > 0 ? total : ''
                                                });
                                            }}
                                            className="w-full px-3 py-2 rounded-lg neumorphic-in text-center font-mono text-sm"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-400/10">
                                <span className="text-sm font-medium text-gray-400">Totale Calcolato:</span>
                                <span className="text-2xl font-black text-purple-400">{formData.birilli || 0}</span>
                            </div>
                        </>
                    )}
                </div>
            )}

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
                    className="flex-1 py-4 rounded-xl neumorphic-btn bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" /> Salva Risultato
                </button>
            </div>
        </form>
    );
};

export default ResultForm;
