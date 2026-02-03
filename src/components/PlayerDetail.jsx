import React from 'react';
import { X, Trophy, Hash, Target, TrendingUp, Calendar, MapPin, FileText, Pencil, ArrowLeft, ChevronDown, ChevronUp, Phone, Mail, CreditCard, User, AlertTriangle, Briefcase, Award } from 'lucide-react';

const PlayerDetail = ({ player, results, tournaments, onBack, isAdmin, onDeleteResult, onEditResult, onEditPlayer }) => {
    // Filter results for this player
    const playerResults = results.filter(r => r.id_giocatore === player.id);

    // Link results to tournament info
    const tournamentHistory = playerResults.map(r => {
        const tournament = tournaments.find(t => t.id === r.id_torneo);
        return {
            ...r,
            tournament_name: tournament?.nome || 'Torneo Sconosciuto',
            tournament_sede: tournament?.sede || '-',
            tournament_date: tournament?.data_inizio || r.data,
            tournament_locandina: tournament?.locandina_url,
            media: r.partite > 0 ? (r.birilli / r.partite).toFixed(2) : '0.00'
        };
    }).sort((a, b) => new Date(b.tournament_date) - new Date(a.tournament_date));

    const totalPins = playerResults.reduce((sum, r) => sum + r.birilli, 0);
    const totalGames = playerResults.reduce((sum, r) => sum + r.partite, 0);
    const overallMedia = totalGames > 0 ? (totalPins / totalGames).toFixed(2) : '0.00';

    const [expandedRows, setExpandedRows] = React.useState(new Set());

    const toggleRow = (id) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedRows(newExpanded);
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="flex items-center gap-2 p-3 rounded-xl neumorphic-btn text-gray-400">
                    <ArrowLeft className="w-5 h-5" /> Indietro
                </button>
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-blue-400">{player.nome} {player.cognome}</h2>
                    {isAdmin && (
                        <button
                            onClick={() => onEditPlayer(player)}
                            className="p-3 rounded-xl neumorphic-btn text-blue-400 hover:scale-110 transition-transform"
                            title="Modifica Anagrafica"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Personal Details Area (Anagrafica) */}
            <div className="p-8 rounded-3xl neumorphic-out space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" /> Anagrafica Atleta
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Membership Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Tessera FISB</p>
                                <p className="font-mono font-bold text-gray-200">{player.numero_tessera || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Award className="w-5 h-5 text-blue-400" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Categoria</p>
                                <p className="font-bold text-blue-400">{player.categoria || 'N/D'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-green-400" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Telefono</p>
                                <p className="font-bold text-gray-200">{player.telefono || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-purple-400" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Email</p>
                                <p className="font-bold text-gray-200 text-sm">{player.email || 'N/D'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sectors & Medical */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-red-500" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Scadenza Certificato</p>
                                <p className={`font-bold ${!player.data_scadenza_medica ? 'text-gray-500' : new Date(player.data_scadenza_medica) < new Date() ? 'text-red-500' : 'text-gray-200'}`}>
                                    {player.data_scadenza_medica ? new Date(player.data_scadenza_medica).toLocaleDateString('it-IT') : 'N/D'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {player.settore_seniores && (
                                <span className="text-[10px] py-1 px-3 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold flex items-center gap-1">
                                    <Award className="w-3 h-3" /> SENIORES
                                </span>
                            )}
                            {player.settore_aziendale && (
                                <span className="text-[10px] py-1 px-3 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 font-bold flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" /> AZIENDALE
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Summary Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl neumorphic-out text-center space-y-2 border border-blue-400/10">
                    <TrendingUp className="w-6 h-6 mx-auto text-blue-400" />
                    <p className="text-gray-400 uppercase text-xs tracking-widest">Media Totale</p>
                    <p className="text-4xl font-black text-blue-400">{overallMedia}</p>
                </div>
                <div className="p-6 rounded-3xl neumorphic-out text-center space-y-2 border border-purple-400/10">
                    <Target className="w-6 h-6 mx-auto text-purple-400" />
                    <p className="text-gray-400 uppercase text-xs tracking-widest">Totale Birilli</p>
                    <p className="text-4xl font-black text-purple-400">{totalPins}</p>
                </div>
                <div className="p-6 rounded-3xl neumorphic-out text-center space-y-2 border border-yellow-400/10">
                    <Hash className="w-6 h-6 mx-auto text-yellow-500" />
                    <p className="text-gray-400 uppercase text-xs tracking-widest">Totale Partite</p>
                    <p className="text-4xl font-black text-yellow-500">{totalGames}</p>
                </div>
            </div>

            {/* Tournament History Table */}
            <div className="p-8 rounded-3xl neumorphic-out">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Storico Tornei
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-400 border-b border-white/5">
                                <th className="pb-4 pl-4 font-medium uppercase text-xs md:text-base">Data</th>
                                <th className="pb-4 font-medium uppercase text-xs md:text-base">Torneo / Sede</th>
                                <th className="pb-4 font-medium uppercase text-xs md:text-base text-center">Partite</th>
                                <th className="pb-4 font-medium uppercase text-xs md:text-base text-center">Birilli</th>
                                <th className="pb-4 font-medium uppercase text-xs md:text-base text-center">Media</th>
                                <th className="pb-4 pr-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {tournamentHistory.map((h) => (
                                <React.Fragment key={h.id}>
                                    <tr className="group hover:bg-white/5 transition-colors cursor-pointer" onClick={() => toggleRow(h.id)}>
                                        <td className="py-4 pl-4 text-sm text-gray-400">
                                            {new Date(h.tournament_date).toLocaleDateString('it-IT')}
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold">{h.tournament_name}</div>
                                                {h.punteggi_partite && h.punteggi_partite.length > 0 && (
                                                    <div className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/20 text-blue-400 font-bold uppercase tracking-tighter">Dettagli</div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {h.tournament_sede}
                                                {h.tournament_locandina && (
                                                    <a href={h.tournament_locandina} target="_blank" rel="noreferrer" className="ml-2 text-blue-400 hover:underline flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                        <FileText className="w-3 h-3" /> Locandina
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 text-center font-mono">{h.partite}</td>
                                        <td className="py-4 text-center font-mono">{h.birilli}</td>
                                        <td className="py-4 text-center font-black text-blue-400">{h.media}</td>
                                        <td className="py-4 pr-4">
                                            <div className="flex justify-end gap-2 items-center">
                                                {isAdmin && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onEditResult(h); }}
                                                            className="p-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-110 transition-transform"
                                                            title="Modifica Punteggio"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onDeleteResult(h.id); }}
                                                            className="p-2 rounded-lg neumorphic-btn text-red-500 hover:scale-110 transition-transform"
                                                            title="Elimina Punteggio"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {h.punteggi_partite && h.punteggi_partite.length > 0 ? (
                                                    <div className="p-1 rounded-full text-gray-500 group-hover:text-blue-400 transition-colors">
                                                        {expandedRows.has(h.id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </div>
                                                ) : <div className="w-7"></div>}
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRows.has(h.id) && h.punteggi_partite && h.punteggi_partite.length > 0 && (
                                        <tr className="bg-white/[0.02]">
                                            <td colSpan={isAdmin ? 6 : 6} className="py-4 px-6">
                                                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 animate-slideDown">
                                                    {h.punteggi_partite.map((score, gIdx) => (
                                                        <div key={gIdx} className="p-3 rounded-xl neumorphic-in text-center space-y-1">
                                                            <p className="text-[10px] text-gray-500 uppercase font-medium">G{gIdx + 1}</p>
                                                            <p className="font-mono font-bold text-blue-400">{score}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {tournamentHistory.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                                        Nessun torneo registrato per questo atleta.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PlayerDetail;
