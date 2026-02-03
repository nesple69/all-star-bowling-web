import React from 'react';
import { X, Trophy, Hash, Target, TrendingUp, Calendar, MapPin, FileText, Pencil, ArrowLeft, ChevronDown, ChevronUp, Phone, Mail, CreditCard, User, AlertTriangle, Briefcase, Award, TrendingDown, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';

const PlayerDetail = ({ player, results, tournaments, onBack, isAdmin, onDeleteResult, onEditResult, onEditPlayer }) => {
    // Filter results for this player
    const playerResults = results.filter(r => r.id_giocatore === player.id);

    // Link results to tournament info
    const tournamentHistory = playerResults.map(r => {
        const tournament = tournaments.find(t => t.id === r.id_torneo);
        const avg = r.partite > 0 ? (r.birilli / r.partite) : 0;
        return {
            ...r,
            tournament_name: tournament?.nome || 'Torneo Sconosciuto',
            tournament_sede: tournament?.sede || '-',
            tournament_date: tournament?.data_inizio || r.data,
            tournament_locandina: tournament?.locandina_url,
            media: avg.toFixed(2),
            avgNum: avg
        };
    }).sort((a, b) => new Date(a.tournament_date) - new Date(b.tournament_date)); // Ascending for chart

    const totalPins = playerResults.reduce((sum, r) => sum + r.birilli, 0);
    const totalGames = playerResults.reduce((sum, r) => sum + r.partite, 0);
    const overallMedia = totalGames > 0 ? (totalPins / totalGames).toFixed(2) : '0.00';

    // Advanced Stats
    const allScores = playerResults.flatMap(r => r.punteggi_partite || []);
    const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;

    // Trend Calculation (Last 3 tournaments)
    const lastThree = [...tournamentHistory].reverse().slice(0, 3);
    const recentPins = lastThree.reduce((sum, r) => sum + r.birilli, 0);
    const recentGames = lastThree.reduce((sum, r) => sum + r.partite, 0);
    const recentMedia = recentGames > 0 ? (recentPins / recentGames).toFixed(2) : '0.00';
    const trendValue = (parseFloat(recentMedia) - parseFloat(overallMedia)).toFixed(2);

    const [expandedRows, setExpandedRows] = React.useState(new Set());

    const toggleRow = (id) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedRows(newExpanded);
    };

    // Prepare chart data
    const chartData = tournamentHistory.map(h => ({
        data: new Date(h.tournament_date).toLocaleDateString('it-IT', { month: 'short', year: '2y' }),
        media: parseFloat(h.media),
        torneo: h.tournament_name
    }));

    return (
        <div className="space-y-8 animate-fadeIn pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 p-3 rounded-xl glass-btn text-gray-400 group">
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold">Indietro</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <h2 className="text-2xl font-black text-white tracking-tight">{player.nome} {player.cognome}</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">{player.categoria || 'Categoria N.D.'}</p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => onEditPlayer(player)}
                            className="p-3 rounded-xl glass-btn text-blue-400 hover:scale-110 transition-transform shadow-lg shadow-blue-500/10"
                            title="Modifica Anagrafica"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Title */}
            <div className="md:hidden">
                <h2 className="text-3xl font-black text-white tracking-tight uppercase">{player.nome} {player.cognome}</h2>
                <div className="mt-2 inline-flex py-1 px-3 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold tracking-widest border border-blue-500/20">
                    {player.categoria || 'CATEGORIA N.D.'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Info & Stats */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Stats Highlights */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-[2rem] glass-card text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-20"></div>
                            <TrendingUp className="w-5 h-5 mx-auto text-blue-400 mb-2" />
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Media Gen.</p>
                            <p className="text-3xl font-black text-blue-400">{overallMedia}</p>
                        </div>
                        <div className="p-6 rounded-[2rem] glass-card text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 opacity-20"></div>
                            <Star className="w-5 h-5 mx-auto text-yellow-500 mb-2" />
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Best Score</p>
                            <p className="text-3xl font-black text-yellow-500">{bestScore || '-'}</p>
                        </div>
                        <div className="p-6 rounded-[2rem] glass-card text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 opacity-20"></div>
                            <Trophy className="w-5 h-5 mx-auto text-purple-400 mb-2" />
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Tot. Birilli</p>
                            <p className="text-2xl font-black text-white">{totalPins}</p>
                        </div>
                        <div className="p-6 rounded-[2rem] glass-card text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-20"></div>
                            {parseFloat(trendValue) >= 0 ? <TrendingUp className="w-5 h-5 mx-auto text-green-400 mb-2" /> : <TrendingDown className="w-5 h-5 mx-auto text-red-400 mb-2" />}
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Trend (Ultimi 3)</p>
                            <p className={`text-2xl font-black ${parseFloat(trendValue) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {parseFloat(trendValue) >= 0 ? `+${trendValue}` : trendValue}
                            </p>
                        </div>
                    </div>

                    {/* Anagrafica Atleta */}
                    <div className="p-8 rounded-[2.5rem] glass-card space-y-6 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full"></div>
                        <h3 className="text-xs font-black text-gray-400 flex items-center gap-2 uppercase tracking-[0.2em]">
                            <User className="w-4 h-4 text-blue-400" /> Profilo Atleta
                        </h3>
                        <div className="space-y-5">
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                                <div className="p-2.5 rounded-xl bg-blue-500/10"><CreditCard className="w-4 h-4 text-blue-400" /></div>
                                <div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Tessera FISB</p>
                                    <p className="font-mono font-bold text-gray-200">{player.numero_tessera || 'N/D'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                                <div className="p-2.5 rounded-xl bg-green-500/10"><Phone className="w-4 h-4 text-green-400" /></div>
                                <div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Contatto</p>
                                    <p className="font-bold text-gray-200 text-sm">{player.telefono || 'N/D'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                                <div className="p-2.5 rounded-xl bg-red-500/10"><Calendar className="w-4 h-4 text-red-500" /></div>
                                <div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Scadenza Medica</p>
                                    <p className={`font-bold text-sm ${!player.data_scadenza_medica ? 'text-gray-500' : new Date(player.data_scadenza_medica) < new Date() ? 'text-red-500' : 'text-gray-200'}`}>
                                        {player.data_scadenza_medica ? new Date(player.data_scadenza_medica).toLocaleDateString('it-IT') : 'N/D'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Sectors badges */}
                        <div className="flex flex-wrap gap-2 pt-2">
                            {player.settore_seniores && (
                                <span className="text-[9px] py-1.5 px-3 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-black tracking-widest uppercase">
                                    Seniores {player.fascia_seniores}
                                </span>
                            )}
                            {player.settore_aziendale && (
                                <span className="text-[9px] py-1.5 px-3 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 font-black tracking-widest uppercase">
                                    Aziendale
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Charts & History */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Performance Chart */}
                    <div className="p-8 rounded-[2.5rem] glass-card relative overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Andamento Media</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Evoluzione tecnica per torneo</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-blue-500/10">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>
                        <div className="h-[300px] w-full mt-4">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorMedia" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="data"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }}
                                            dy={10}
                                        />
                                        <YAxis
                                            domain={['auto', 'auto']}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }}
                                            dx={-10}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                                            itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                            cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="media"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorMedia)"
                                            animationDuration={1500}
                                        />
                                        <ReferenceLine y={parseFloat(overallMedia)} stroke="#3b82f6" strokeDasharray="3 3" opacity={0.5} label={{ value: 'Media Gen.', fill: '#3b82f6', fontSize: 10, fontWeight: 'black', position: 'right' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-3xl">
                                    <p className="text-gray-500 italic text-sm">Dati insufficienti per il grafico</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Historical Results */}
                    <div className="p-8 rounded-[2.5rem] glass-card">
                        <h3 className="text-xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                            <Trophy className="w-6 h-6 text-yellow-500" /> Storico Risultati
                        </h3>
                        <div className="space-y-4">
                            {[...tournamentHistory].reverse().map((h) => (
                                <div key={h.id} className="group">
                                    <div
                                        onClick={() => h.punteggi_partite?.length > 0 && toggleRow(h.id)}
                                        className={`p-5 rounded-3xl transition-all duration-300 border cursor-pointer ${expandedRows.has(h.id) ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex flex-col items-center justify-center border border-white/5">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase leading-none mb-1">
                                                        {new Date(h.tournament_date).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
                                                    </span>
                                                    <span className="text-sm font-black text-white leading-none">
                                                        {new Date(h.tournament_date).getFullYear().toString().slice(-2)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-white uppercase tracking-tight text-sm">{h.tournament_name}</h4>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1 uppercase">
                                                            <MapPin className="w-3 h-3" /> {h.tournament_sede}
                                                        </span>
                                                        <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
                                                            {h.partite} Partite
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 self-end md:self-auto">
                                                <div className="text-right">
                                                    <span className="text-2xl font-black text-white leading-none">{h.birilli}</span>
                                                    <span className="block text-[8px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1">Birilli</span>
                                                </div>
                                                <div className="text-right w-16 border-l border-white/10 pl-4">
                                                    <span className="text-xl font-black text-blue-400 leading-none">{h.media}</span>
                                                    <span className="block text-[8px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1">Media</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isAdmin && (
                                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onEditResult(h); }}
                                                                className="p-2 rounded-xl glass-btn text-blue-400"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onDeleteResult(h.id); }}
                                                                className="p-2 rounded-xl glass-btn text-red-500"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {h.punteggi_partite?.length > 0 && (
                                                        <div className={`p-2 rounded-xl ${expandedRows.has(h.id) ? 'bg-blue-500/20 text-blue-400' : 'text-gray-600'}`}>
                                                            {expandedRows.has(h.id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {expandedRows.has(h.id) && h.punteggi_partite && (
                                        <div className="mt-2 ml-4 p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-3 animate-slideDown">
                                            {h.punteggi_partite.map((score, gIdx) => (
                                                <div key={gIdx} className="text-center group/score">
                                                    <p className="text-[8px] text-gray-500 font-black uppercase mb-1">G{gIdx + 1}</p>
                                                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 font-mono font-black text-blue-300 text-xs">
                                                        {score}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {tournamentHistory.length === 0 && (
                                <div className="py-20 text-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                                    <Target className="w-8 h-8 mx-auto text-gray-700 mb-3" />
                                    <p className="text-gray-500 italic text-sm">Nessun risultato registrato per questo atleta.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerDetail;
