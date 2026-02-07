import React, { useState } from 'react';
import { Upload, X, Trophy, Save, List, CheckCircle, AlertCircle, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const TournamentImportForm = ({ players, tournaments, onSave, onCancel }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState(1);
    const [parsedResults, setParsedResults] = useState([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [matchesOnly, setMatchesOnly] = useState(false);

    console.log('TournamentImportForm rendered. Step:', step);

    const parseContent = (contentToParse = htmlContent) => {
        console.log('Parser: Starting analysis...');
        if (!contentToParse || !contentToParse.trim()) {
            console.warn('Parser: Content is empty');
            return;
        }

        let results = [];
        const cleanStr = (s) => {
            if (!s) return '';
            return s.toString()
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&[a-z]+;/g, '')
                .replace(/[\t\n\r]/g, ' ')
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, ' ')
                .trim();
        };

        let rows = [];
        // Supporta sia <tr che <TR
        if (contentToParse.toLowerCase().includes('<tr') || contentToParse.toLowerCase().includes('<td')) {
            console.log('Parser: HTML mode detected');
            const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let match;
            while ((match = rowRegex.exec(contentToParse)) !== null) {
                const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>|<th[^>]*>([\s\S]*?)<\/th>/gi;
                const cells = [];
                let cellMatch;
                while ((cellMatch = cellRegex.exec(match[1])) !== null) {
                    cells.push(cleanStr(cellMatch[1] || cellMatch[2]));
                }
                if (cells.length > 0) rows.push(cells);
            }
        }

        // Se non trova righe in HTML o non è HTML, prova Text Mode
        if (rows.length === 0) {
            console.log('Parser: Text mode or HTML regex fallback');
            rows = contentToParse.split('\n')
                .map(line => {
                    let parts = line.split(/\t|\s{2,}/).map(cleanStr).filter(c => c.length > 0);
                    if (parts.length < 2) {
                        parts = line.split(/\s+/).map(cleanStr).filter(c => c.length > 0);
                    }
                    return parts;
                })
                .filter(r => r.length > 1);
        }

        console.log('Parser: Rows found:', rows.length);

        if (rows.length === 0) {
            console.warn('Parser: No rows extracted');
            alert('Nessun dato trovato. Assicurati di aver copiato correttamente la tabella.');
            return;
        }

        let colMapping = { rank: -1, name: -1, scores: [], total: -1, media: -1, teamTotal: -1 };
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            let nameMatched = false;
            row.forEach((cell, idx) => {
                const c = cell.toUpperCase().trim();
                if (['POS', 'RANGO', 'POS.', '#', 'POSIZIONE', 'CL', 'POSIZ.'].includes(c)) colMapping.rank = idx;
                else if (['ATLETA', 'GIOCATORE', 'NOME', 'NOMINATIVO', 'ATLETA/SOCIETA', 'GIOCATORI'].includes(c)) {
                    colMapping.name = idx;
                    nameMatched = true;
                }
                else if (['TOT. SQ.', 'SQUADRA', 'TOT. SQUADRA', 'TEAM TOT.', 'TOT. TEAM', 'TOT. SQUADRE'].includes(c)) colMapping.teamTotal = idx;
                else if (['TOT', 'TOTALE', 'BIRILLI', 'TOT. GEN.', 'TOTAL', 'SCRATCH', 'BIRILLO'].includes(c)) {
                    if (colMapping.total === -1 || c.includes('TOTALE')) colMapping.total = idx;
                }
                else if (['MEDIA', 'MED', 'AVG', 'MEDIA PUNTI', 'MED. PUNTI'].includes(c)) colMapping.media = idx;
                else if (/^G\d+$/.test(c) || /^P\d+$/.test(c)) colMapping.scores.push(idx);
            });
            if (nameMatched && colMapping.rank !== -1) break;
        }

        if (colMapping.name === -1) {
            for (let cIdx = 0; cIdx < (rows[0]?.length || 0); cIdx++) {
                if (rows.slice(0, 5).some(r => r[cIdx] && r[cIdx].length > 5 && isNaN(parseFloat(r[cIdx])))) {
                    colMapping.name = cIdx;
                    break;
                }
            }
            if (colMapping.name === -1) colMapping.name = 1;
        }
        if (colMapping.rank === -1) colMapping.rank = colMapping.name === 0 ? -1 : 0;

        let lastRank = 1;
        let currentSection = null;

        rows.forEach((row) => {
            if (row.length < 1) return;
            const rowStr = row.join(' ').toUpperCase();
            const sectionKeywords = ['ECCELLENZA', 'CADETTI', 'FEMMINILE', 'GENTLEMAN', 'M/A', 'M/B', 'M/C', 'F/A'];
            const foundSection = sectionKeywords.find(k => rowStr.includes(k) && row.length < 3);

            if (foundSection) {
                currentSection = rowStr.replace(/PAGINA\s+\d+/g, '').trim();
                return;
            }

            if (row.length < 2) return;
            if (rowStr.includes('ATLETA') || rowStr.includes('POSIZIONE') || rowStr.includes('PAGINA')) return;
            if (rowStr.includes('FISB') || rowStr.includes('CLASSIFICA')) return;

            let rank = parseInt(row[colMapping.rank]);
            if (isNaN(rank)) rank = lastRank;
            else lastRank = rank;

            let name = row[colMapping.name];
            if (!name || name.length < 3 || !isNaN(parseFloat(name)) || /^\d+$/.test(name)) {
                name = row.find(c => c.length > 5 && /^[A-Z\s'.]+$/i.test(c) && isNaN(parseFloat(c)));
            }

            if (!name || /GIOCATORE|TEAM|SQUADRA|ATLETA|NOMINATIVO/i.test(name)) return;

            let scores = [];
            if (colMapping.scores.length > 0) {
                colMapping.scores.forEach(sIdx => {
                    const val = parseInt(row[sIdx]);
                    if (!isNaN(val) && val >= 50 && val <= 300) scores.push(val);
                });
            }
            if (scores.length === 0) {
                row.forEach(cell => {
                    const val = parseInt(cell);
                    if (!isNaN(val) && val >= 50 && val <= 300 && !cell.includes('.')) scores.push(val);
                });
            }

            let total = 0;
            let media = 0;
            if (colMapping.total !== -1) total = parseInt(row[colMapping.total]);
            if (colMapping.media !== -1) media = parseFloat(row[colMapping.media].toString().replace(',', '.'));

            const sumScores = scores.reduce((a, b) => a + b, 0);
            let teamTotal = 0;
            if (colMapping.teamTotal !== -1 && row[colMapping.teamTotal]) {
                teamTotal = parseInt(row[colMapping.teamTotal].replace(/\D/g, ''));
            } else {
                const numbers = row
                    .map(c => parseInt(c.toString().replace(/\D/g, '')))
                    .filter(n => !isNaN(n) && n > sumScores && n > 200);

                if (numbers.length > 0) {
                    const candidate = Math.max(...numbers);
                    if (candidate >= sumScores * 1.3) teamTotal = candidate;
                }
            }

            if (!total || total < sumScores) total = sumScores;
            if (!media && scores.length > 0) media = total / scores.length;

            results.push({
                rank,
                player_name: name.toUpperCase(),
                points: total,
                media: media,
                punteggi_partite: scores,
                totale_squadra: teamTotal,
                categoria_risultato: currentSection
            });
        });

        const matched = results.map(res => {
            const matchedPlayer = players.find(p => {
                const normName = (n) => n.toUpperCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^A-Z]/g, '');
                const target = normName(res.player_name);
                const pNombre = normName(p.nome);
                const pCognome = normName(p.cognome);
                const p1 = pNombre + pCognome;
                const p2 = pCognome + pNombre;
                if (target === p1 || target === p2) return true;
                if (target.includes(pNombre) && target.includes(pCognome)) return true;
                if (p1.includes(target) && target.length >= 6) return true;
                return false;
            });

            return {
                ...res,
                playerId: matchedPlayer?.id || null,
                playerName: matchedPlayer ? `${matchedPlayer.nome} ${matchedPlayer.cognome}` : res.player_name,
                isMatched: !!matchedPlayer
            };
        });

        console.log('Parser: Analysis complete.', matched.length, 'results found.');
        setParsedResults(matched);
        setStep(2);
    };

    const handleConfirm = async () => {
        if (!selectedTournamentId) {
            alert('Seleziona un torneo di destinazione.');
            return;
        }
        const filteredResults = parsedResults.filter(r => r.isMatched);
        if (filteredResults.length === 0) {
            alert('Nessun atleta abbinato trovato nel database.');
            return;
        }

        const finalResults = filteredResults.map(r => ({
            id_giocatore: r.playerId,
            id_torneo: selectedTournamentId,
            posizione: r.rank,
            birilli: r.points,
            media: r.media || 0,
            totale_squadra: r.totale_squadra || 0,
            categoria_risultato: r.categoria_risultato,
            punteggi_partite: r.punteggi_partite || [],
            partite: r.punteggi_partite?.length || (tournaments.find(t => t.id === selectedTournamentId)?.numero_partite || 6)
        }));

        setIsSaving(true);
        try {
            await onSave(finalResults);
        } catch (error) {
            alert('Errore durante il salvataggio: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 rounded-3xl neumorphic-out max-w-4xl mx-auto space-y-6">
            <div className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl text-center">
                <p className="text-red-400 font-black text-xs uppercase tracking-[0.3em] animate-pulse">
                    ⚠️ DEBUG: MODALITÀ MANUALE V2.2 ATTIVA ⚠️
                </p>
            </div>
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Upload className="w-6 h-6 text-blue-400" />
                    Importa Risultati FISB (v2.2)
                </h2>
                <button onClick={onCancel} className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {step === 1 ? (
                <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-blue-400/5 border border-blue-400/10">
                        <p className="text-xs text-blue-400 font-bold mb-2 uppercase tracking-tight">Istruzioni:</p>
                        <ol className="text-[11px] text-gray-400 leading-relaxed list-decimal ml-4 space-y-1">
                            <li>Copia la tabella dal sito FISB (anche tutto l'HTML se vuoi).</li>
                            <li>Incolla nel riquadro sotto.</li>
                            <li>Clicca su "Analizza Dati".</li>
                        </ol>
                    </div>

                    <div className="space-y-4">
                        <textarea
                            value={htmlContent}
                            onChange={(e) => setHtmlContent(e.target.value)}
                            className="w-full h-80 p-4 rounded-xl neumorphic-in focus:outline-none font-mono text-[10px] text-gray-300 custom-scrollbar"
                            placeholder="Incolla qui i dati..."
                        />
                        <div className="flex gap-4">
                            <button onClick={onCancel} className="flex-1 py-4 rounded-xl neumorphic-btn font-bold text-gray-400">
                                Annulla
                            </button>
                            <button
                                onClick={() => parseContent()}
                                disabled={!htmlContent || !htmlContent.trim()}
                                className="flex-1 py-4 rounded-xl neumorphic-btn bg-blue-600/20 text-blue-400 font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-all border border-blue-500/10"
                            >
                                <Trophy className="w-5 h-5" /> Analizza Dati
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs text-gray-500 ml-4 font-bold uppercase tracking-widest">Torneo di Destinazione</label>
                            <select
                                value={selectedTournamentId}
                                onChange={(e) => setSelectedTournamentId(e.target.value)}
                                className="w-full p-3 rounded-xl neumorphic-in focus:outline-none bg-transparent"
                            >
                                <option value="">Seleziona Torneo...</option>
                                {tournaments.map(t => (
                                    <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.nome}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => setMatchesOnly(!matchesOnly)}
                            className={`px-4 py-3 rounded-xl neumorphic-btn text-xs font-bold transition-all ${matchesOnly ? 'bg-green-600/20 text-green-400 border border-green-400/20' : 'text-gray-500 border border-transparent'}`}
                        >
                            {matchesOnly ? '✓ Solo abbinati' : 'Mostra tutti'}
                        </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto rounded-2xl border border-white/5 p-2 space-y-1 bg-black/20 custom-scrollbar">
                        {parsedResults.filter(r => !matchesOnly || r.isMatched).map((res, idx) => (
                            <div key={idx} className={`flex items-center p-3 rounded-xl gap-4 transition-colors ${res.isMatched ? 'bg-green-400/5 hover:bg-green-400/10 border border-green-400/10' : 'bg-red-400/5 opacity-50 border border-white/5'}`}>
                                <div className="font-bold text-xs w-8 text-center bg-white/5 rounded-lg py-1">{res.rank}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate uppercase tracking-tight">{res.player_name}</p>
                                    <p className={`text-[10px] font-bold ${res.isMatched ? 'text-green-400' : 'text-gray-500'}`}>
                                        {res.isMatched ? `✓ ${res.playerName}` : 'Atleta non trovato'}
                                    </p>
                                </div>
                                <div className="text-right w-20 border-l border-white/5 pl-4">
                                    <p className="font-black text-blue-400 text-lg leading-none">{res.points}</p>
                                    <p className="text-[9px] uppercase font-bold text-gray-500">birilli</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl neumorphic-btn font-bold text-gray-400">
                            Indietro
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="flex-1 py-4 rounded-xl neumorphic-btn bg-green-600/20 text-green-400 font-bold disabled:opacity-50 border border-green-400/20 shadow-lg shadow-green-400/5"
                        >
                            {isSaving ? 'Salvataggio...' : `Conferma Importazione (${parsedResults.filter(r => r.isMatched).length})`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentImportForm;
