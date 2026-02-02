import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import PlayerForm from './components/PlayerForm';
import TournamentForm from './components/TournamentForm';
import PlayerDetail from './components/PlayerDetail';
import ResultForm from './components/ResultForm';
import {
  LayoutDashboard, Users, Trophy, Wallet, LogIn, LogOut,
  AlertTriangle, Plus, Search, TrendingUp, Target, MapPin,
  ArrowUpCircle, ArrowDownCircle, FileText
} from 'lucide-react';

const App = () => {
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
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState(null);

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
      return expiry <= thirtyDaysFromNow;
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
      return {
        ...p,
        media: totalGames > 0 ? (totalPins / totalGames).toFixed(2) : '0.00',
        totaleBirilli: totalPins,
        totalePartite: totalGames
      };
    }).sort((a, b) => b.media - a.media);
  }, [players, results]);

  // Handlers
  const handleSavePlayer = async (formData) => {
    const { error } = editingPlayer
      ? await supabase.from('players').update(formData).eq('id', editingPlayer.id)
      : await supabase.from('players').insert([formData]);
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
    const { error } = await supabase.from('results').insert([formData]);
    if (error) alert(error.message);
    else { fetchData(); setShowResultForm(false); }
  };

  const handleLogin = async () => {
    const email = prompt('Inserisci Email Admin:');
    if (!email) return;
    const password = prompt('Inserisci Password Admin:');
    if (!password) return;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Errore di accesso: ' + error.message);
  };

  if (selectedPlayerForDetail) {
    return (
      <div className="min-h-screen bg-background text-gray-200 p-8">
        <PlayerDetail
          player={selectedPlayerForDetail}
          results={results}
          tournaments={tournaments}
          onBack={() => setSelectedPlayerForDetail(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-gray-200">
      {/* Sidebar Navigation */}
      <nav className="fixed bottom-0 left-0 w-full md:relative md:w-64 md:h-screen p-4 bg-background z-50">
        <div className="h-full rounded-3xl neumorphic-out flex flex-col md:p-6 p-2 justify-around md:justify-start gap-6">
          <h1 className="hidden md:block text-xl font-bold text-center text-blue-400 mb-8 mt-4">
            ALL STAR <br /> BOWLING TEAM
          </h1>

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

          <div className="md:mt-auto">
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

      <main className="pb-24 md:pb-0 md:pl-8 p-4 md:p-8 w-full">
        <header className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold capitalize">{activeTab}</h2>
          {isAdmin && (activeTab === 'players' || activeTab === 'tournaments' || activeTab === 'ranking') && (
            <button
              onClick={() => {
                if (activeTab === 'players') { setEditingPlayer(null); setShowPlayerForm(true); }
                if (activeTab === 'tournaments') { setEditingTournament(null); setShowTournamentForm(true); }
                if (activeTab === 'ranking') setShowResultForm(true);
              }}
              className="p-4 rounded-xl neumorphic-btn text-blue-400 font-bold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> {activeTab === 'ranking' ? 'Inserisci Punteggio' : 'Aggiungi'}
            </button>
          )}
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-400"></div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                {expiringCertificates.length > 0 && (
                  <div className="p-6 rounded-2xl bg-red-400/10 border border-red-400/20 neumorphic-out">
                    <div className="flex items-center gap-3 mb-4 text-red-400">
                      <AlertTriangle className="w-6 h-6" />
                      <h3 className="text-lg font-bold">Certificati in Scadenza</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {expiringCertificates.map(p => (
                        <div key={p.id} className="p-4 rounded-xl neumorphic-in flex justify-between items-center">
                          <p className="font-bold">{p.nome} {p.cognome}</p>
                          <p className="text-xs text-red-500">{new Date(p.data_scadenza_medica).toLocaleDateString('it-IT')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="p-8 rounded-3xl neumorphic-out text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Atleti</p>
                    <p className="text-5xl font-black text-blue-400">{players.length}</p>
                  </div>
                  <div className="p-8 rounded-3xl neumorphic-out text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Media Team</p>
                    <p className="text-5xl font-black text-purple-400">
                      {(playersWithStats.reduce((sum, p) => sum + parseFloat(p.media), 0) / (players.length || 1)).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-8 rounded-3xl neumorphic-out text-center text-green-400">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Saldo</p>
                    <p className="text-5xl font-black">€{balance.total.toLocaleString('it-IT')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Ranking */}
            {activeTab === 'ranking' && (
              <div className="space-y-6">
                <div className="p-8 rounded-3xl neumorphic-out overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/5">
                        <th className="pb-4 pl-4 font-medium text-xs">Pos.</th>
                        <th className="pb-4 font-medium text-xs">Atleta</th>
                        <th className="pb-4 font-medium text-xs text-center">Cat.</th>
                        <th className="pb-4 font-medium text-xs text-center">P.</th>
                        <th className="pb-4 font-medium text-xs text-center">Birilli</th>
                        <th className="pb-4 font-medium text-xs text-right pr-4">Media</th>
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
                          <td className="py-4 text-right pr-4 font-black text-blue-400">{p.media}</td>
                        </tr>
                      ))}
                      {playersWithStats.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-gray-500 italic">
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
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {players.map(p => (
                    <div key={p.id} onClick={() => setSelectedPlayerForDetail(p)} className="p-6 rounded-3xl neumorphic-out group cursor-pointer hover:scale-[1.02] transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold">{p.nome} {p.cognome}</h3>
                          <p className="text-sm text-gray-400">{p.categoria}</p>
                        </div>
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); setEditingPlayer(p); setShowPlayerForm(true); }} className="p-2 rounded-lg neumorphic-btn opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                        )}
                      </div>
                      <div className="mt-4 space-y-1">
                        {p.settore_aziendale && <div className="text-[10px] text-purple-400 flex items-center gap-1 uppercase"><MapPin className="w-3 h-3" /> {p.nome_azienda}</div>}
                        {p.settore_seniores && <div className="text-[10px] text-yellow-500 flex items-center gap-1 uppercase"><Trophy className="w-3 h-3" /> {p.fascia_seniores}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tournaments Area */}
            {activeTab === 'tournaments' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournaments.sort((a, b) => new Date(b.data_inizio) - new Date(a.data_inizio)).map(t => (
                    <div key={t.id} className="p-6 rounded-3xl neumorphic-out relative group">
                      <div className="flex justify-between items-start mb-4">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        {isAdmin && (
                          <button onClick={() => { setEditingTournament(t); setShowTournamentForm(true); }} className="p-2 rounded-lg neumorphic-btn">
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                        )}
                      </div>
                      <h3 className="text-lg font-bold mb-2">{t.nome}</h3>
                      <div className="space-y-2 text-sm text-gray-400">
                        <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {new Date(t.data_inizio).toLocaleDateString()} - {new Date(t.data_fine).toLocaleDateString()}</p>
                        <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {t.sede}</p>
                        <p className="flex items-center gap-2"><Target className="w-4 h-4" /> {t.numero_partite} Partite</p>
                      </div>
                      {t.locandina_url && (
                        <a href={t.locandina_url} target="_blank" rel="noreferrer" className="mt-4 block py-2 text-center rounded-xl bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-400/20 hover:bg-blue-500/20 transition-all">
                          SFOGLIA LOCANDINA PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accounting (Admin Only) */}
            {activeTab === 'accounting' && isAdmin && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                  <div className="p-8 rounded-3xl neumorphic-out border border-green-500/10">
                    <ArrowUpCircle className="w-8 h-8 mx-auto text-green-400 mb-2" />
                    <h3 className="text-lg font-bold">Entrate</h3>
                    <p className="text-4xl font-black text-green-400">€{balance.income.toLocaleString()}</p>
                  </div>
                  <div className="p-8 rounded-3xl neumorphic-out border border-red-500/10">
                    <ArrowDownCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
                    <h3 className="text-lg font-bold">Uscite</h3>
                    <p className="text-4xl font-black text-red-400">€{balance.expenses.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-8 rounded-3xl neumorphic-out">
                  <h3 className="text-xl font-bold mb-6">Operazioni Recenti</h3>
                  <div className="space-y-4">
                    {transactions.map(t => (
                      <div key={t.id} className="flex justify-between items-center p-4 rounded-xl neumorphic-in">
                        <div>
                          <p className="font-bold">{t.descrizione}</p>
                          <p className="text-[10px] text-gray-500">{new Date(t.data).toLocaleDateString()}</p>
                        </div>
                        <p className={`font-black ${t.tipo === 'entrate' ? 'text-green-400' : 'text-red-400'}`}>
                          {t.tipo === 'entrate' ? '+' : '-'} €{t.importo}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>

      {/* MODALS */}
      {(showPlayerForm || showTournamentForm || showResultForm) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
            setShowPlayerForm(false);
            setShowTournamentForm(false);
            setShowResultForm(false);
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
                players={players}
                tournaments={tournaments}
                onSave={handleSaveResult}
                onCancel={() => setShowResultForm(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
