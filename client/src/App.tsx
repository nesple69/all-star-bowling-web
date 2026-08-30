import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedAdminRoute } from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import { API_BASE_URL } from './config';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Giocatori from './pages/Giocatori';
import GestioneTornei from './pages/GestioneTornei';
import FormTorneo from './components/FormTorneo';
import InserimentoRisultati from './pages/InserimentoRisultati';
import Tornei from './pages/Tornei';
import DettaglioTorneo from './pages/DettaglioTorneo';
import IscrizioneTorneo from './pages/IscrizioneTorneo';
import Contabilita from './pages/Contabilita';
import ImportDati from './pages/ImportDati';
import GestioneUtenti from './pages/GestioneUtenti';
import GestioneStagioni from './pages/GestioneStagioni';
import Profilo from './pages/Profilo';
import './App.css';

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

function App() {
  // Keep-alive ping ogni 4 minuti per evitare il cold start di Vercel
  useEffect(() => {
    const ping = () => fetch(`${API_BASE_URL}/api/health`).catch(() => { });
    ping(); // Ping immediato all'avvio
    const interval = setInterval(ping, 4 * 60 * 1000); // Ogni 4 minuti
    return () => clearInterval(interval);
  }, []);

  console.log('📦 Componente App montato');
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<Layout />}>
            {/* Admin Routes wrapped in ProtectedAdminRoute inside Layout */}
            <Route element={<ProtectedAdminRoute />}>
              <Route path="/admin/tornei" element={<GestioneTornei />} />
              <Route path="/admin/tornei/nuovo" element={<FormTorneo />} />
              <Route path="/admin/tornei/modifica/:id" element={<FormTorneo />} />
              <Route path="/admin/tornei/:id/risultati" element={<InserimentoRisultati />} />
              <Route path="/admin/contabilita" element={<Contabilita />} />
              <Route path="/admin/import" element={<ImportDati />} />
              <Route path="/admin/utenti" element={<GestioneUtenti />} />
              <Route path="/admin/stagioni" element={<GestioneStagioni />} />
              <Route path="/profilo" element={<Profilo />} />
            </Route>

            <Route path="/" element={<Dashboard />} />
            <Route path="/giocatori" element={<Giocatori />} />
            <Route path="/tornei" element={<Tornei />} />
            <Route path="/tornei/:id" element={<DettaglioTorneo />} />
            <Route path="/tornei/:id/iscrizione" element={<IscrizioneTorneo />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
