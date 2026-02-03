import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import PlayerForm from './components/PlayerForm';
import TournamentForm from './components/TournamentForm';
import PlayerDetail from './components/PlayerDetail';
import ResultForm from './components/ResultForm';
import TransactionForm from './components/TransactionForm';
import AccountingPlayerDetail from './components/AccountingPlayerDetail';
import {
  LayoutDashboard, Users, Trophy, Wallet, LogIn, LogOut,
  AlertTriangle, Plus, Search, TrendingUp, Target, MapPin,
  ArrowUpCircle, ArrowDownCircle, FileText, Pencil, X, Calendar
} from 'lucide-react';

const App = () => {
  useEffect(() => { console.log('All Star Project - UI v1.6 (Absolute Top)'); }, []);
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
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState(null);
  const [selectedAccountingPlayer, setSelectedAccountingPlayer] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);

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
                  <div className="p-6 rounded-2xl bg-red-400/10 border border-red-400/20 neumorphic-out">
                    <div className="flex items-center gap-3 mb-4 text-red-400">
                      <AlertTriangle className="w-6 h-6" />
                      <h3 className="text-lg font-bold">Certificati in Scadenza</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {expiringCertificates.map(p => {
                        const expiryDate = new Date(p.data_scadenza_medica).toLocaleDateString('it-IT');
                        const message = `Ciao ${p.nome}, il giorno ${expiryDate} ti scadrà il certificato medico. Per poter continuare la tua attività sportiva devi avere un certificato medico in corso di validità. Ti prego di prendere un appuntamento per aggiornare il tuo certificato e di farmelo avere. Grazie per la collaborazione.\n\nIl Presidente\nNedo Splendiani`;
                        const emailSubject = 'Scadenza Certificato Medico';
                        const emailBody = `Ciao ${p.nome},\n\nIl giorno ${expiryDate} ti scadrà il certificato medico. Per poter continuare la tua attività sportiva devi avere un certificato medico in corso di validità.\n\nTi prego di prendere un appuntamento per aggiornare il tuo certificato e di farmelo avere.\n\nGrazie per la collaborazione.\n\nIl Presidente\nNedo Splendiani`;

                        return (
                          <div key={p.id} className="p-4 rounded-xl neumorphic-in">
                            <div className="flex justify-between items-start mb-3">
                              <p className="font-bold">{p.nome} {p.cognome}</p>
                              <p className="text-xs text-red-500">{new Date(p.data_scadenza_medica).toLocaleDateString('it-IT')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.telefono && (
                                <a
                                  href={`https://wa.me/39${p.telefono.replace(/\s/g, '')}?text=${encodeURIComponent(message)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 px-3 py-2 rounded-lg neumorphic-btn text-green-400 hover:scale-105 transition-transform text-xs font-medium flex items-center justify-center gap-1"
                                  title="Invia WhatsApp"
                                >
                                  📱 WhatsApp
                                </a>
                              )}
                              {p.email && (
                                <a
                                  href={`mailto:${p.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                                  className="flex-1 px-3 py-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-105 transition-transform text-xs font-medium flex items-center justify-center gap-1"
                                  title="Invia Email"
                                >
                                  ✉️ Email
                                </a>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => { setEditingPlayer(p); setShowPlayerForm(true); }}
                                  className="p-2 rounded-lg neumorphic-btn text-gray-400 hover:scale-105 transition-transform"
                                  title="Modifica"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 rounded-3xl neumorphic-out text-center">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Atleti</p>
                    <p className="text-4xl font-black text-blue-400">{players.length}</p>
                  </div>
                  <div className="p-6 rounded-3xl neumorphic-out text-center text-green-400">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Saldo</p>
                    <p className="text-4xl font-black">€{balance.total.toLocaleString('it-IT')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Ranking */}
            {activeTab === 'ranking' && (
              <div className="space-y-6">
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
                      {playersWithStats.map((p, idx) => (
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
                      {playersWithStats.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-gray-500 italic">
                            Nessun atleta trovato nel database.
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
                      {playersWithStats.map((p) => (
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
                      {playersWithStats.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-gray-500 italic">
                            Nessun atleta registrato.
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
                  <button
                    onClick={() => setSelectedTournament(null)}
                    className="mb-4 px-4 py-2 rounded-lg neumorphic-btn text-blue-400 hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    ← Torna ai Tornei
                  </button>
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
                          {results.filter(r => r.id_torneo === selectedTournament.id).length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-12 text-center text-gray-500 italic">
                                Nessun risultato registrato per questo torneo.
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
                        {tournaments.sort((a, b) => new Date(b.data_inizio) - new Date(a.data_inizio)).map(t => (
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
                        {tournaments.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-gray-500 italic">
                              Nessun torneo registrato.
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
                        {players.map(p => {
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
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>

      {/* GLOBAL ADD BUTTON (FIXED BOTTOM RIGHT) */}
      {isAdmin && (activeTab === 'players' || activeTab === 'tournaments' || activeTab === 'ranking') && (
        <button
          onClick={() => {
            if (activeTab === 'players') { setEditingPlayer(null); setShowPlayerForm(true); }
            if (activeTab === 'tournaments') { setEditingTournament(null); setShowTournamentForm(true); }
            if (activeTab === 'ranking') { setEditingResult(null); setShowResultForm(true); }
          }}
          className="fixed bottom-8 right-8 z-[60] p-4 rounded-xl neumorphic-btn text-blue-400 font-bold flex items-center gap-2 shadow-2xl scale-90 md:scale-100"
        >
          <Plus className="w-5 h-5" /> <span>{activeTab === 'ranking' ? 'Punteggio' : 'Aggiungi'}</span>
        </button>
      )}

      {/* MODALS */}
      {(showPlayerForm || showTournamentForm || showResultForm || showTransactionForm) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
            setShowPlayerForm(false);
            setShowTournamentForm(false);
            setShowResultForm(false);
            setShowTransactionForm(false);
          }}></div>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
      )}
    </div>
  );
};

export default App;
