import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import PlayerForm from './components/PlayerForm';
import TournamentForm from './components/TournamentForm';
import PlayerDetail from './components/PlayerDetail';
import ResultForm from './components/ResultForm';
import TransactionForm from './components/TransactionForm';
import AccountingPlayerDetail from './components/AccountingPlayerDetail';
import TournamentImportForm from './components/TournamentImportForm';
import {
  LayoutDashboard, Users, Trophy, Wallet, LogIn, LogOut,
  AlertTriangle, Plus, Search, TrendingUp, Target, MapPin,
  ArrowUpCircle, ArrowDownCircle, FileText, Pencil, X, Calendar, Upload
} from 'lucide-react';

const App = () => {
  useEffect(() => {
    console.log('All Star Project - UI v2.0 (Tournament Import)');
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [results, setResults] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / Form States
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showTournamentImportForm, setShowTournamentImportForm] = useState(false);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState(null);
  const [selectedAccountingPlayer, setSelectedAccountingPlayer] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedDashboardCategory, setSelectedDashboardCategory] = useState(null);
  const [searchPlayers, setSearchPlayers] = useState('');
  const [searchAccounting, setSearchAccounting] = useState('');
  const [searchTournaments, setSearchTournaments] = useState('');
  const [searchTournamentResults, setSearchTournamentResults] = useState('');
  const [searchRanking, setSearchRanking] = useState('');

  // Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data
  const fetchData = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || url === '' || url.includes('YOUR_')) {
      alert('ERRORE CRITICO: URL di Supabase mancante o non valido su Vercel!');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: p, error: ep } = await supabase.from('players').select('*');
      const { data: t, error: et } = await supabase.from('tournaments').select('*');
      const { data: r, error: er } = await supabase.from('results').select('*');
      const { data: trx, error: etrx } = await supabase.from('transactions').select('*');

      if (ep || et || er || etrx) {
        console.error('Fetch Error:', { ep, et, er, etrx });
      }

      if (p) setPlayers(p);
      if (t) setTournaments(t);
      if (r) setResults(r);
      if (trx) setTransactions(trx);
    } catch (err) {
      console.error('System Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImportedResults = async (importedResults) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('results')
        .upsert(importedResults);

      if (error) throw error;

      await fetchData();
      setShowTournamentImportForm(false);
      alert(`Importato con successo! (${importedResults.length} risultati)`);
    } catch (error) {
      alert('Errore caricamento risultati: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dashboard Alerts Logic (Certificates)
  const expiringCertificates = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    return players.filter(p => {
      if (!p.data_scadenza_medica) return false;
      const expiry = new Date(p.data_scadenza_medica);
      return expiry >= today && expiry <= thirtyDaysFromNow;
    });
  }, [players]);

  // Accounting Logic
  const balance = useMemo(() => {
    const income = transactions.filter(t => t.tipo === 'entrate').reduce((sum, t) => sum + t.importo, 0);
    const expenses = transactions.filter(t => t.tipo === 'uscite').reduce((sum, t) => sum + t.importo, 0);
    return { income, expenses, total: income - expenses };
  }, [transactions]);

  // Rankings Logic
  const playersWithStats = useMemo(() => {
    return players.map(p => {
      const pResults = results.filter(r => r.id_giocatore === p.id);
      const totalPins = pResults.reduce((sum, r) => sum + r.birilli, 0);
      const totalGames = pResults.reduce((sum, r) => sum + r.partite, 0);
      const totalTournaments = new Set(pResults.map(r => r.id_torneo)).size;
      return {
        ...p,
        media: totalGames > 0 ? (totalPins / totalGames).toFixed(2) : '0.00',
        totaleBirilli: totalPins,
        totalePartite: totalGames,
        totaleTornei: totalTournaments
      };
    }).sort((a, b) => {
      const mediaA = parseFloat(a.media);
      const mediaB = parseFloat(b.media);
      if (mediaB !== mediaA) return mediaB - mediaA;
      return b.totaleBirilli - a.totaleBirilli;
    });
  }, [players, results]);

  // Dashboard Stats - Last 2 Tournaments
  const recentTournamentsStats = useMemo(() => {
    const sortedT = [...tournaments].sort((a, b) => new Date(b.data_inizio) - new Date(a.data_inizio));
    const lastTwo = sortedT.slice(0, 2);

    return lastTwo.map(t => {
      const tResults = results
        .filter(r => r.id_torneo === t.id)
        .map(r => {
          const player = players.find(p => p.id === r.id_giocatore);
          return { ...r, player };
        })
        .filter(r => r.player)
        .sort((a, b) => {
          const posA = a.posizione || 999;
          const posB = b.posizione || 999;
          if (posA !== posB) return posA - posB;
          return (b.birilli || 0) - (a.birilli || 0); // Tie-breaker by pins
        })
        .slice(0, 3); // Top 3

      return { ...t, topResults: tResults };
    });
  }, [tournaments, results, players]);

  // Dashboard Stats - Categories
  const categoryStats = useMemo(() => {
    const existingCategories = [...new Set(players.map(p => p.categoria))].filter(Boolean).sort();
    return existingCategories.map(cat => ({
      name: cat,
      count: players.filter(p => p.categoria === cat).length
    }));
  }, [players]);

  // Handlers
  const handleSavePlayer = async (formData) => {
    // Rimuoviamo i campi calcolati (media, totaleBirilli, etc.) che non esistono nel database
    const { media, totaleBirilli, totalePartite, totaleTornei, ...dbData } = formData;

    const cleanedData = {
      ...dbData,
      data_scadenza_medica: dbData.data_scadenza_medica === '' ? null : dbData.data_scadenza_medica
    };

    const { error } = editingPlayer
      ? await supabase.from('players').update(cleanedData).eq('id', editingPlayer.id)
      : await supabase.from('players').insert([cleanedData]);
    if (error) alert(error.message);
    else { fetchData(); setShowPlayerForm(false); setEditingPlayer(null); }
  };

  const handleSaveTournament = async (formData) => {
    // Clean dates to avoid "invalid input syntax for type date: \"\""
    const cleanedData = {
      ...formData,
      data_inizio: formData.data_inizio === '' ? null : formData.data_inizio,
      data_fine: formData.data_fine === '' ? null : formData.data_fine
    };

    const { error } = editingTournament
      ? await supabase.from('tournaments').update(cleanedData).eq('id', editingTournament.id)
      : await supabase.from('tournaments').insert([cleanedData]);
    if (error) alert(error.message);
    else { fetchData(); setShowTournamentForm(false); setEditingTournament(null); }
  };

  const handleSaveResult = async (formData) => {
    const { error } = editingResult
      ? await supabase.from('results').update(formData).eq('id', editingResult.id)
      : await supabase.from('results').insert([formData]);
    if (error) alert(error.message);
    else { fetchData(); setShowResultForm(false); setEditingResult(null); }
  };

  const handleSaveTransaction = async (formData) => {
    const { error } = editingTransaction
      ? await supabase.from('transactions').update(formData).eq('id', editingTransaction.id)
      : await supabase.from('transactions').insert([formData]);
    if (error) alert(error.message);
    else { fetchData(); setShowTransactionForm(false); setEditingTransaction(null); }
  };

  const handleSavePlayerTransaction = async (formData) => {
    const { error } = await supabase.from('transactions').insert([formData]);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleDeletePlayer = async (id) => {
    if (!window.confirm('Eliminare definitivamente questo giocatore?')) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleDeleteTournament = async (id) => {
    if (!window.confirm('Eliminare definitivamente questo torneo?')) return;
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleDeleteResult = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Eliminare questo punteggio?')) return;
    const { error } = await supabase.from('results').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Eliminare definitivamente questa operazione?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleLogin = async () => {
    const email = prompt('Inserisci Email Admin:');
    if (!email) return;
    const password = prompt('Inserisci Password Admin:');
    if (!password) return;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Errore di accesso: ' + error.message);
  };

  return (
    <div className="min-h-screen bg-background text-gray-200 md:flex">
      {/* Sidebar Navigation - Hidden when in detail view on mobile */}
      {!selectedPlayerForDetail && (
        <nav className="fixed bottom-0 left-0 w-full md:relative md:w-64 md:h-screen p-0 md:p-4 bg-background z-50">
          <div className="h-full rounded-3xl neumorphic-out flex flex-col md:p-6 p-2 justify-around md:justify-start gap-6">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'ranking', icon: TrendingUp, label: 'Classifiche' },
              { id: 'players', icon: Users, label: 'Giocatori' },
              { id: 'tournaments', icon: Trophy, label: 'Tornei' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col md:flex-row items-center gap-3 p-4 rounded-xl transition-all ${activeTab === tab.id ? 'neumorphic-in text-blue-400' : 'neumorphic-btn'}`}>
                <tab.icon className="w-6 h-6" /> <span className="text-xs md:text-base font-medium">{tab.label}</span>
              </button>
            ))}

            {isAdmin && (
              <button onClick={() => setActiveTab('accounting')} className={`flex flex-col md:flex-row items-center gap-3 p-4 rounded-xl transition-all ${activeTab === 'accounting' ? 'neumorphic-in text-blue-400' : 'neumorphic-btn'}`}>
                <Wallet className="w-6 h-6" /> <span className="text-xs md:text-base font-medium">Contabilità</span>
              </button>
            )}

            {/* TEAM LOGO */}
            <div className="flex-1 hidden md:flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity">
              <img src="/team-logo.png" alt="All Star Team Logo" className="w-full max-w-[160px] object-contain" />
            </div>

            <div className="md:mt-0">
              {isAdmin ? (
                <button onClick={() => supabase.auth.signOut()} className="w-full flex flex-col md:flex-row items-center gap-3 p-4 rounded-xl neumorphic-btn text-red-400">
                  <LogOut className="w-6 h-6" /> <span className="text-xs md:text-base">Logout</span>
                </button>
              ) : (
                <button onClick={handleLogin} className="w-full flex flex-col md:flex-row items-center gap-3 p-4 rounded-xl neumorphic-btn text-green-400">
                  <LogIn className="w-6 h-6" /> <span className="text-xs md:text-base text-center">Admin Login</span>
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className={`flex-1 ${selectedPlayerForDetail ? 'p-4 md:p-10' : 'pb-32 md:pb-32 p-0 md:pt-6 md:px-6'} min-w-0 tracking-tight`}>
        {selectedPlayerForDetail ? (
          <PlayerDetail
            player={selectedPlayerForDetail}
            results={results}
            tournaments={tournaments}
            onBack={() => setSelectedPlayerForDetail(null)}
            isAdmin={isAdmin}
            onDeleteResult={handleDeleteResult}
            onEditResult={(r) => { setEditingResult(r); setShowResultForm(true); }}
            onEditPlayer={(p) => { setEditingPlayer(p); setShowPlayerForm(true); }}
          />
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-400"></div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 pt-0">
                {expiringCertificates.length > 0 && (
                  <div className="mb-8 p-7 rounded-[2.5rem] bg-red-500/5 border border-red-500/10 backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500/40 to-red-500/0 opacity-50"></div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-red-500/20">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <h3 className="text-lg font-black text-red-400 uppercase tracking-wider">Certificati in Scadenza</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {expiringCertificates.map(p => {
                        const expiryDate = new Date(p.data_scadenza_medica).toLocaleDateString('it-IT');
                        const message = `Ciao ${p.nome}, il giorno ${expiryDate} ti scadrà il certificato medico. Per poter continuare la tua attività sportiva devi avere un certificato medico in corso di validità. Ti prego di prendere un appuntamento per aggiornare il tuo certificato e di farmelo avere. Grazie per la collaborazione.\n\nIl Presidente\nNedo Splendiani`;
                        const emailSubject = 'Scadenza Certificato Medico';
                        const emailBody = `Ciao ${p.nome},\n\nIl giorno ${expiryDate} ti scadrà il certificato medico. Per poter continuare la tua attività sportiva devi avere un certificato medico in corso di validità.\n\nTi prego di prendere un appuntamento per aggiornare il tuo certificato e di farmelo avere.\n\nGrazie per la collaborazione.\n\nIl Presidente\nNedo Splendiani`;

                        return (
                          <div key={p.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group/cert">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className="font-bold text-gray-200">{p.nome} {p.cognome}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Scadenza Medica</p>
                              </div>
                              <p className="text-xs font-black text-red-400 bg-red-400/10 px-2 py-1 rounded-lg">{expiryDate}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.telefono && (
                                <a
                                  href={`https://wa.me/39${p.telefono.replace(/\s/g, '')}?text=${encodeURIComponent(message)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 px-3 py-2.5 rounded-xl glass-btn text-green-400 text-xs font-bold flex items-center justify-center gap-1.5"
                                  title="Invia WhatsApp"
                                >
                                  WhatsApp
                                </a>
                              )}
                              {p.email && (
                                <a
                                  href={`mailto:${p.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                                  className="flex-1 px-3 py-2.5 rounded-xl glass-btn text-blue-400 text-xs font-bold flex items-center justify-center gap-1.5"
                                  title="Invia Email"
                                >
                                  Email
                                </a>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => { setEditingPlayer(p); setShowPlayerForm(true); }}
                                  className="p-2.5 rounded-xl glass-btn text-gray-400 hover:text-white"
                                  title="Modifica"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                  {recentTournamentsStats.map(t => (
                    <div key={t.id} className="p-7 rounded-[2.5rem] glass-card relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-xl font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">{t.nome}</h3>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Classifica Finale</p>
                        </div>
                        <div className="px-4 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/5">
                          <span className="text-xs font-black uppercase tracking-widest">
                            {new Date(t.data_inizio).toLocaleDateString('it-IT', { month: 'long' })}
                          </span>
                          <span className="ml-2 text-[10px] opacity-60 font-bold">{new Date(t.data_inizio).getFullYear()}</span>
                        </div>
                      </div>
                      <div className="px-2 mb-4 flex justify-between text-[9px] font-black text-gray-600 uppercase tracking-widest border-b border-white/5 pb-2">
                        <div className="flex gap-4">
                          <span className="w-10 text-center">Pos.</span>
                          <span>Giocatore</span>
                        </div>
                        <div className="flex gap-6 pr-4">
                          <span>Tot. Birilli</span>
                          <span>Media</span>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {t.topResults.map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 group/row">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner transition-transform group-hover/row:scale-110 ${r.posizione === 1 ? 'bg-yellow-500/20 text-yellow-500 shadow-yellow-500/10' :
                                r.posizione === 2 ? 'bg-slate-400/20 text-slate-300' :
                                  r.posizione === 3 ? 'bg-orange-600/20 text-orange-500' :
                                    'bg-blue-500/10 text-blue-400'
                                }`}>
                                {r.posizione || idx + 1}
                              </div>
                              <span className="font-bold text-gray-200 tracking-tight">{r.player.nome} {r.player.cognome}</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-lg font-black text-blue-400 leading-none">{r.birilli}</span>
                              <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none">birilli</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 w-12 border-l border-white/10 ml-2 pl-2">
                              <span className="text-sm font-black text-white leading-none">{(r.birilli / (t.numero_partite || 6)).toFixed(1)}</span>
                              <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none">media</span>
                            </div>
                          </div>
                        ))}
                        {t.topResults.length === 0 && (
                          <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-gray-500 italic text-xs">In attesa di risultati...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Category Summary Card */}
                  <div className="p-7 rounded-[2.5rem] glass-card relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/40 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-xl font-black text-white tracking-tight group-hover:text-purple-400 transition-colors">Riepilogo Squadra</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Giocatori Iscritti</p>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-purple-400 font-bold uppercase tracking-tighter">
                        {players.length} Atleti
                      </div>
                    </div>
                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                      {categoryStats.map(cat => (
                        <div
                          key={cat.name}
                          onClick={() => setSelectedDashboardCategory(selectedDashboardCategory === cat.name ? null : cat.name)}
                          className={`flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 cursor-pointer group/row border ${selectedDashboardCategory === cat.name
                            ? 'bg-purple-500/20 border-purple-500/40'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-inner transition-transform group-hover/row:scale-110 ${selectedDashboardCategory === cat.name ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400'
                              }`}>
                              {cat.name.split('/')[0]}
                            </div>
                            <span className={`font-bold tracking-tight transition-colors ${selectedDashboardCategory === cat.name ? 'text-purple-300' : 'text-gray-200'}`}>
                              Categoria {cat.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`text-lg font-black leading-none transition-colors ${selectedDashboardCategory === cat.name ? 'text-white' : 'text-purple-400'}`}>
                              {cat.count}
                            </span>
                            <span className="block text-[9px] text-gray-500 font-bold uppercase tracking-widest">giocatori</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* The category buttons row has been replaced by the card above */}

                  {selectedDashboardCategory && (
                    <div className="p-8 rounded-[2.5rem] glass-card animate-fadeIn shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full -mr-16 -mt-16"></div>
                      <div className="flex justify-between items-center mb-8 relative z-10">
                        <div>
                          <h3 className="text-xl font-black text-blue-400 tracking-tight">Atleti Categoria {selectedDashboardCategory}</h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Elenco Iscritti</p>
                        </div>
                        <button onClick={() => setSelectedDashboardCategory(null)} className="p-3 rounded-2xl glass-btn text-gray-400 hover:text-white">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                        {players.filter(p => p.categoria === selectedDashboardCategory).map(p => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPlayerForDetail(p)}
                            className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 transition-all duration-300 cursor-pointer group/player shadow-lg flex flex-col items-center text-center"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                              <Users className="w-7 h-7 text-blue-400" />
                            </div>
                            <p className="font-bold text-gray-200 leading-tight text-sm">{p.nome}</p>
                            <p className="font-black text-gray-200 leading-tight uppercase tracking-tighter text-base">{p.cognome}</p>
                            <div className="mt-3 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{p.sottocategoria || 'Classe Base'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Ranking */}
            {activeTab === 'ranking' && (
              <div className="space-y-6">
                <div className="relative max-w-md mx-auto md:mx-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca atleta..."
                    value={searchRanking}
                    onChange={(e) => setSearchRanking(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                  />
                </div>
                <div className="p-4 md:p-6 rounded-3xl neumorphic-out overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/5">
                        <th className="pb-4 pl-4 font-medium text-xs md:text-base">Pos.</th>
                        <th className="pb-4 font-medium text-xs md:text-base">Atleta</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Cat.</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">P.</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Birilli</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Media</th>
                        {isAdmin && <th className="pb-4 pr-4 text-right"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {playersWithStats
                        .filter(p => {
                          const search = searchRanking.toLowerCase();
                          return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                        })
                        .map((p, idx) => (
                          <tr key={p.id} onClick={() => setSelectedPlayerForDetail(p)} className="group hover:bg-white/5 transition-colors cursor-pointer">
                            <td className="py-4 pl-4 font-bold text-gray-500">{idx + 1}</td>
                            <td className="py-4 font-bold">{p.nome} {p.cognome}</td>
                            <td className="py-4 text-center text-xs font-bold text-blue-400">{p.categoria}</td>
                            <td className="py-4 text-center font-mono">{p.totalePartite}</td>
                            <td className="py-4 text-center font-mono">{p.totaleBirilli}</td>
                            <td className="py-4 text-center font-black text-blue-400">{p.media}</td>
                            {isAdmin && (
                              <td className="py-4 pr-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingPlayer(p); setShowPlayerForm(true); }}
                                    className="p-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-110 transition-transform"
                                    title="Modifica"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeletePlayer(p.id); }}
                                    className="p-2 rounded-lg neumorphic-btn text-red-500 hover:scale-110 transition-transform"
                                    title="Elimina"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      {playersWithStats.filter(p => {
                        const search = searchRanking.toLowerCase();
                        return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                      }).length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-gray-500 italic">
                              Nessun atleta trovato {searchRanking ? 'per questa ricerca' : 'nel database'}.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Players Area */}
            {activeTab === 'players' && (
              <div className="space-y-6 pt-0">
                <div className="relative max-w-md mx-auto md:mx-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca atleta..."
                    value={searchPlayers}
                    onChange={(e) => setSearchPlayers(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                  />
                </div>
                <div className="p-4 md:p-6 rounded-3xl neumorphic-out overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/5">
                        <th className="pb-4 pl-4 font-medium text-xs md:text-base">Atleta</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Tessera</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Cat.</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Tornei</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Birilli</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Media</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Senior</th>
                        <th className="pb-4 font-medium text-xs md:text-base text-center">Aziendale</th>
                        {isAdmin && <th className="pb-4 pr-4 text-right"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {playersWithStats
                        .filter(p => {
                          const search = searchPlayers.toLowerCase();
                          return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                        })
                        .map((p) => (
                          <tr key={p.id} className="group hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedPlayerForDetail(p)}>
                            <td className="py-4 pl-4 font-bold">{p.nome} {p.cognome}</td>
                            <td className="py-4 text-center font-mono text-sm text-gray-400">{p.numero_tessera || '-'}</td>
                            <td className="py-4 text-center text-xs font-bold text-blue-400">{p.categoria}</td>
                            <td className="py-4 text-center font-mono">{p.totaleTornei}</td>
                            <td className="py-4 text-center font-mono">{p.totaleBirilli}</td>
                            <td className="py-4 text-center font-black text-blue-400">{p.media}</td>
                            <td className="py-4 text-center">
                              {p.settore_seniores ? <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-lg border border-yellow-500/20">SI</span> : '-'}
                            </td>
                            <td className="py-4 text-center">
                              {p.settore_aziendale ? <span className="text-[10px] bg-purple-500/10 text-purple-500 px-2 py-1 rounded-lg border border-purple-500/20">SI</span> : '-'}
                            </td>
                            {isAdmin && (
                              <td className="py-4 pr-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingPlayer(p); setShowPlayerForm(true); }}
                                    className="p-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-110 transition-transform"
                                    title="Modifica"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeletePlayer(p.id); }}
                                    className="p-2 rounded-lg neumorphic-btn text-red-500 hover:scale-110 transition-transform"
                                    title="Elimina"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      {playersWithStats.filter(p => {
                        const search = searchPlayers.toLowerCase();
                        return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                      }).length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-gray-500 italic">
                              Nessun atleta trovato {searchPlayers ? 'per questa ricerca' : 'registrato'}.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tournaments Area */}
            {activeTab === 'tournaments' && (
              selectedTournament ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <button
                      onClick={() => { setSelectedTournament(null); setSearchTournamentResults(''); }}
                      className="px-4 py-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-105 transition-transform flex items-center gap-2 w-fit"
                    >
                      ← Torna ai Tornei
                    </button>
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cerca atleta..."
                        value={searchTournamentResults}
                        onChange={(e) => setSearchTournamentResults(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl neumorphic-in focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="p-4 md:p-6 rounded-3xl neumorphic-out">
                    <h2 className="text-2xl font-bold mb-6 text-blue-400">{selectedTournament.nome}</h2>
                    <div className="text-sm text-gray-400 mb-6 flex gap-6">
                      <span>📅 {new Date(selectedTournament.data_inizio).toLocaleDateString()}</span>
                      <span>📍 {selectedTournament.sede}</span>
                      <span>🎳 {selectedTournament.numero_partite} partite</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-gray-400 border-b border-white/5">
                            <th className="pb-4 pl-4 font-medium text-xs md:text-base">Pos.</th>
                            <th className="pb-4 font-medium text-xs md:text-base">Atleta</th>
                            <th className="pb-4 font-medium text-xs md:text-base text-center">Birilli</th>
                            <th className="pb-4 font-medium text-xs md:text-base text-center">Partite</th>
                            <th className="pb-4 font-medium text-xs md:text-base text-center">Media</th>
                            <th className="pb-4 pr-4 font-medium text-xs md:text-base text-center">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {results
                            .filter(r => r.id_torneo === selectedTournament.id)
                            .map(r => {
                              const player = players.find(p => p.id === r.id_giocatore);
                              return { ...r, player };
                            })
                            .filter(r => r.player)
                            .sort((a, b) => (a.posizione || 999) - (b.posizione || 999))
                            .filter(r => {
                              const search = searchTournamentResults.toLowerCase();
                              return r.player.nome.toLowerCase().includes(search) || r.player.cognome.toLowerCase().includes(search);
                            })
                            .map((r) => {
                              const media = r.partite > 0 ? (r.birilli / r.partite).toFixed(2) : '0.00';
                              return (
                                <tr key={r.id} className="group hover:bg-white/5 transition-colors">
                                  <td className="py-4 pl-4 font-black text-blue-400 text-lg">#{r.posizione || '-'}</td>
                                  <td className="py-4 font-bold">{r.player.nome} {r.player.cognome}</td>
                                  <td className="py-4 text-center font-mono text-green-400 font-bold">{r.birilli}</td>
                                  <td className="py-4 text-center font-mono">{r.partite}</td>
                                  <td className="py-4 text-center font-black text-blue-400">{media}</td>
                                  <td className="py-4 pr-4 text-center text-xs text-gray-400">
                                    {r.data ? new Date(r.data).toLocaleDateString() : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          {results.filter(r => r.id_torneo === selectedTournament.id).filter(r => {
                            const p = players.find(player => player.id === r.id_giocatore);
                            if (!p) return false;
                            const search = searchTournamentResults.toLowerCase();
                            return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                          }).length === 0 && (
                              <tr>
                                <td colSpan="6" className="py-12 text-center text-gray-500 italic">
                                  Nessun risultato trovato {searchTournamentResults ? 'per questa ricerca' : 'registrato'}.
                                </td>
                              </tr>
                            )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cerca torneo..."
                      value={searchTournaments}
                      onChange={(e) => setSearchTournaments(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                    />
                  </div>
                  <div className="p-4 md:p-6 rounded-3xl neumorphic-out overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-gray-400 border-b border-white/5">
                          <th className="pb-4 pl-4 font-medium text-xs md:text-base">Torneo</th>
                          <th className="pb-4 font-medium text-xs md:text-base text-center">Data</th>
                          <th className="pb-4 font-medium text-xs md:text-base text-center">Sede</th>
                          <th className="pb-4 font-medium text-xs md:text-base text-center">Partite</th>
                          <th className="pb-4 font-medium text-xs md:text-base text-center text-blue-400">PDF</th>
                          {isAdmin && <th className="pb-4 pr-4"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tournaments
                          .filter(t => t.nome.toLowerCase().includes(searchTournaments.toLowerCase()))
                          .sort((a, b) => new Date(b.data_inizio) - new Date(a.data_inizio)).map(t => (
                            <tr
                              key={t.id}
                              className="group hover:bg-white/5 transition-colors cursor-pointer"
                              onClick={() => setSelectedTournament(t)}
                            >
                              <td className="py-4 pl-4 font-bold">{t.nome}</td>
                              <td className="py-4 text-center font-mono text-xs">
                                {new Date(t.data_inizio).toLocaleDateString()}
                              </td>
                              <td className="py-4 text-center text-sm text-gray-400">{t.sede}</td>
                              <td className="py-4 text-center font-mono">{t.numero_partite}</td>
                              <td className="py-4 text-center">
                                {t.locandina_url ? (
                                  <a
                                    href={t.locandina_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 inline-block rounded-lg neumorphic-btn text-blue-400 scale-75"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </a>
                                ) : '-'}
                              </td>
                              {isAdmin && (
                                <td className="py-4 pr-4">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditingTournament(t); setShowTournamentForm(true); }}
                                      className="p-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-110 transition-transform"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteTournament(t.id); }}
                                      className="p-2 rounded-lg neumorphic-btn text-red-500 hover:scale-110 transition-transform"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        {tournaments.filter(t => t.nome.toLowerCase().includes(searchTournaments.toLowerCase())).length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-gray-500 italic">
                              Nessun torneo trovato {searchTournaments ? 'per questa ricerca' : 'registrato'}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}

            {/* Accounting (Admin Only) */}
            {activeTab === 'accounting' && isAdmin && (
              selectedAccountingPlayer ? (
                <AccountingPlayerDetail
                  player={selectedAccountingPlayer}
                  transactions={transactions}
                  onBack={() => setSelectedAccountingPlayer(null)}
                  onAddTransaction={handleSavePlayerTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              ) : (
                <div className="space-y-6">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cerca atleta..."
                      value={searchAccounting}
                      onChange={(e) => setSearchAccounting(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                    />
                  </div>
                  <div className="p-4 md:p-6 rounded-3xl neumorphic-out overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-gray-400 border-b border-white/5">
                          <th className="pb-4 pl-4 font-medium text-xs md:text-base">Atleta</th>
                          <th className="pb-4 font-medium text-xs md:text-base text-right">Saldo</th>
                          <th className="pb-4 pr-4 font-medium text-xs md:text-base text-center">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {players.filter(p => {
                          const search = searchAccounting.toLowerCase();
                          return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                        }).map(p => {
                          const balance = transactions
                            .filter(t => t.id_giocatore === p.id)
                            .reduce((acc, t) => t.tipo === 'entrate' ? acc + t.importo : acc - t.importo, 0);

                          const needsRecharge = balance < 15.01;
                          const hasPhone = p.telefono && p.telefono.trim() !== '';

                          // Clean phone number (remove spaces and ensure country code)
                          const cleanPhone = hasPhone ? p.telefono.replace(/\s/g, '').replace(/^(\+39)?/, '+39') : '';
                          const whatsappMessage = encodeURIComponent(
                            `Ciao ${p.nome}! Il tuo credito è a €${balance.toFixed(2)}. Ti ricordo di ricaricare per poter continuare a partecipare ai tornei! 🎳`
                          );
                          const whatsappLink = `https://wa.me/${cleanPhone}?text=${whatsappMessage}`;

                          return (
                            <tr key={p.id} className="group hover:bg-white/5 transition-colors">
                              <td
                                className="py-4 pl-4 font-bold cursor-pointer"
                                onClick={() => setSelectedAccountingPlayer(p)}
                              >
                                {p.nome} {p.cognome}
                              </td>
                              <td
                                className={`py-4 text-right font-black font-mono cursor-pointer ${balance < 10 ? 'text-red-500' : 'text-green-500'}`}
                                onClick={() => setSelectedAccountingPlayer(p)}
                              >
                                € {balance.toFixed(2)}
                              </td>
                              <td className="py-4 pr-4 text-center">
                                {needsRecharge && hasPhone && (
                                  <a
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors text-xs font-bold"
                                    title="Invia promemoria WhatsApp"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                    </svg>
                                    Ricarica
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {players.filter(p => {
                          const search = searchAccounting.toLowerCase();
                          return p.nome.toLowerCase().includes(search) || p.cognome.toLowerCase().includes(search);
                        }).length === 0 && (
                            <tr>
                              <td colSpan="3" className="py-12 text-center text-gray-500 italic">
                                Nessun atleta trovato {searchAccounting ? 'per questa ricerca' : 'registrato'}.
                              </td>
                            </tr>
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        )
        }
      </main >

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>

      {/* GLOBAL ADD BUTTON (FIXED BOTTOM RIGHT) */}
      {
        isAdmin && (activeTab === 'players' || activeTab === 'tournaments' || activeTab === 'ranking') && (
          <div className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-3 pointer-events-none">
            {activeTab === 'tournaments' && (
              <button
                onClick={() => setShowTournamentImportForm(true)}
                className="pointer-events-auto p-4 rounded-xl neumorphic-btn text-green-400 font-bold flex items-center gap-2 shadow-2xl scale-90 md:scale-100"
                title="Importa Risultati FISB"
              >
                <Upload className="w-5 h-5" /> <span>+ aggiungi torneo</span>
              </button>
            )}
            <button
              onClick={() => {
                if (activeTab === 'players') { setEditingPlayer(null); setShowPlayerForm(true); }
                if (activeTab === 'tournaments') { setEditingTournament(null); setShowTournamentForm(true); }
                if (activeTab === 'ranking') { setEditingResult(null); setShowResultForm(true); }
              }}
              className="pointer-events-auto p-4 rounded-xl neumorphic-btn text-blue-400 font-bold flex items-center gap-2 shadow-2xl scale-90 md:scale-100"
            >
              <Plus className="w-5 h-5" /> <span>{activeTab === 'ranking' ? 'Punteggio' : 'Aggiungi'}</span>
            </button>
          </div>
        )
      }

      {/* MODALS */}
      {
        (showPlayerForm || showTournamentForm || showResultForm || showTransactionForm || showTournamentImportForm) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
              setShowPlayerForm(false);
              setShowTournamentForm(false);
              setShowResultForm(false);
              setShowTransactionForm(false);
              setShowTournamentImportForm(false);
            }}></div>
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {showTournamentImportForm && (
                <TournamentImportForm
                  players={players}
                  tournaments={tournaments}
                  onSave={handleSaveImportedResults}
                  onCancel={() => setShowTournamentImportForm(false)}
                />
              )}
              {showPlayerForm && (
                <PlayerForm player={editingPlayer} onSave={handleSavePlayer} onCancel={() => setShowPlayerForm(false)} />
              )}
              {showTournamentForm && (
                <TournamentForm tournament={editingTournament} onSave={handleSaveTournament} onCancel={() => setShowTournamentForm(false)} />
              )}
              {showResultForm && (
                <ResultForm
                  result={editingResult}
                  players={players}
                  tournaments={tournaments}
                  onSave={handleSaveResult}
                  onCancel={() => setShowResultForm(false)}
                />
              )}
              {showTransactionForm && (
                <TransactionForm
                  transaction={editingTransaction}
                  onSave={handleSaveTransaction}
                  onCancel={() => setShowTransactionForm(false)}
                />
              )}
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
