import React, { useState } from 'react';
import { Upload, X, Trophy, Save, List, CheckCircle, AlertCircle, Trash2, Edit2 } from 'lucide-react';

const TournamentImportForm = ({ players, tournaments, onSave, onCancel }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [step, setStep] = useState(1); // 1: Incolla, 2: Anteprima
    const [parsedResults, setParsedResults] = useState([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [matchesOnly, setMatchesOnly] = useState(true);

    const parseFISB = () => {
        if (!htmlContent.trim()) return;

        const results = [];
        // Clean HTML: Remove tabs, newlines and excessive spaces
        const cleanHtml = htmlContent.replace(/[\t\n\r]/g, ' ').replace(/\s+/g, ' ');

        // Match table rows
        const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gi;
        let match;

        while ((match = rowRegex.exec(cleanHtml)) !== null) {
            const rowContent = match[1];
            const cellRegex = /<td[^>]*>(.*?)<\/td>/gi;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
                cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
            }

            if (cells.length >= 5) {
                const pos = parseInt(cells[0]);
                const player = cells[2].toUpperCase();
                const points = parseInt(cells[4]);

                if (!isNaN(pos)) {
                    results.push({
                        rank: pos,
                        player_name: player,
                        points: isNaN(points) ? 0 : points
                    });
                } else if (cells[0] === '' && player !== '' && !player.includes('GIOCATORE')) {
                    // Carry over rank for team/trio members
                    const lastResult = results[results.length - 1];
                    if (lastResult) {
                        results.push({
                            rank: lastResult.rank,
                            player_name: player,
                            points: lastResult.points
                        });
                    }
                }
            }
        }

        if (results.length === 0) {
            alert('Nessun dato trovato. Assicurati di aver incollato il codice HTML corretto.');
            return;
        }

        // Match with registered players
        const matched = results.map(res => {
            const matchedPlayer = players.find(p => {
                const fullName = `${p.nome} ${p.cognome}`.toUpperCase();
                const reversedName = `${p.cognome} ${p.nome}`.toUpperCase();
                return fullName === res.player_name || reversedName === res.player_name;
            });
            return {
                ...res,
                playerId: matchedPlayer?.id || null,
                playerName: matchedPlayer ? `${matchedPlayer.nome} ${matchedPlayer.cognome}` : res.player_name,
                isMatched: !!matchedPlayer
            };
        });

        setParsedResults(matched);
        setStep(2);
    };

    const handleConfirm = () => {
        if (!selectedTournamentId) {
            alert('Seleziona un torneo di destinazione');
            return;
        }

        const finalResults = parsedResults
            .filter(r => r.isMatched)
            .map(r => ({
                id_giocatore: r.playerId,
                id_torneo: selectedTournamentId,
                posizione: r.rank,
                birilli: r.points,
                partite: tournaments.find(t => t.id === selectedTournamentId)?.numero_partite || 6
            }));

        if (finalResults.length === 0) {
            alert('Nessun atleta corrispondente trovato nel sistema.');
            return;
        }

        onSave(finalResults);
    };

    return (
        <div className="p-8 rounded-3xl neumorphic-out max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8 flex items-center justify-center gap-2">
                <Upload className="w-6 h-6 text-blue-400" />
                Importa Risultati FISB
            </h2>

            {step === 1 ? (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-400/5 border border-blue-400/10">
                        <p className="text-sm text-gray-400 mb-2">
                            Incolla qui sotto il codice sorgente HTML della classifica FISB (o la tabella copiata).
                            Il sistema cercherà gli atleti registrati e le loro posizioni.
                        </p>
                    </div>
                    <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        className="w-full h-64 p-4 rounded-xl neumorphic-in focus:outline-none font-mono text-xs"
                        placeholder="Incolla l'HTML qui..."
                    />
                    <div className="flex gap-4">
                        <button onClick={onCancel} className="flex-1 py-4 rounded-xl neumorphic-btn font-bold">
                            Annulla
                        </button>
                        <button
                            onClick={parseFISB}
                            disabled={!htmlContent.trim()}
                            className="flex-1 py-4 rounded-xl neumorphic-btn bg-blue-600/20 text-blue-400 font-bold disabled:opacity-50"
                        >
                            Analizza Dati
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium ml-4 text-gray-400">Torneo di Destinazione</label>
                            <select
                                value={selectedTournamentId}
                                onChange={(e) => setSelectedTournamentId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none appearance-none"
                            >
                                <option value="">Seleziona Torneo...</option>
                                {tournaments.map(t => (
                                    <option key={t.id} value={t.id}>{t.nome}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => setMatchesOnly(!matchesOnly)}
                            className={`px-4 py-3 rounded-xl neumorphic-btn text-sm font-bold transition-colors ${matchesOnly ? 'text-green-400' : 'text-gray-400'}`}
                        >
                            {matchesOnly ? 'Mostra solo Corrispondenze' : 'Mostra Tutti'}
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto rounded-2xl border border-white/5 p-2 space-y-2">
                        {parsedResults
                            .filter(r => !matchesOnly || r.isMatched)
                            .map((res, idx) => (
                                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl ${res.isMatched ? 'bg-green-400/5' : 'bg-red-400/5 opacity-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-gray-500 w-6">#{res.rank}</span>
                                        <div>
                                            <p className="font-bold text-sm">{res.player_name}</p>
                                            {res.isMatched && <p className="text-[10px] text-green-400">Trovato: {res.playerName}</p>}
                                            {!res.isMatched && <p className="text-[10px] text-red-400">Non registrato</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-400">{res.points} <span className="text-[10px] font-normal text-gray-500">birilli</span></p>
                                    </div>
                                </div>
                            ))}
                    </div>

                    <div className="p-4 rounded-xl bg-blue-400/5 border border-blue-400/10 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                        <p className="text-xs text-gray-400">
                            Verranno importati solo gli atleti evidenziati in verde (quelli registrati nel sistema).
                            Eventuali risultati esistenti per questo torneo verranno sovrascritti.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl neumorphic-btn font-bold">
                            Indietro
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedTournamentId}
                            className="flex-1 py-4 rounded-xl neumorphic-btn bg-green-600/20 text-green-400 font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" /> Conferma Importazione ({parsedResults.filter(r => r.isMatched).length})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentImportForm;
