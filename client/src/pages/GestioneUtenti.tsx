import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import {
    Users,
    UserPlus,
    Trash2,
    Shield,
    User as UserIcon,
    Clock,
    AlertCircle,
    CheckCircle2,
    ArrowRightLeft,
    Mail,
    Key,
    Award
} from 'lucide-react';
import ModalNuovoAdmin from '../components/ModalNuovoAdmin';
import { useAuth } from '../contexts/AuthContext';

interface UserData {
    id: string;
    username: string;
    email: string | null;
    nome: string;
    cognome: string;
    ruolo: 'USER' | 'ADMIN' | 'COACH';
    createdAt: string;
}

const GestioneUtenti: React.FC = () => {
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [userToReset, setUserToReset] = useState<UserData | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const { user: currentUser } = useAuth();

    const fetchUsersData = async () => {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data as UserData[];
    };

    const { data: users = [], isLoading, error: fetchError, refetch: fetchUsers } = useQuery({
        queryKey: ['adminUsers'],
        queryFn: fetchUsersData,
    });

    useEffect(() => {
        if (fetchError) {
            setError('Errore nel caricamento degli utenti');
        }
    }, [fetchError]);

    const handleSetRole = async (userId: string, currentRole: string, newRole: string) => {
        if (currentRole === newRole) return;

        if (currentRole === 'ADMIN' && users.filter(u => u.ruolo === 'ADMIN').length <= 1 && newRole !== 'ADMIN') {
            setError('Impossibile rimuovere l\'ultimo amministratore');
            return;
        }

        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/users/${userId}/role`,
                { ruolo: newRole },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccessMessage(`Ruolo aggiornato a ${newRole} con successo`);
            fetchUsers();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Errore durante l\'aggiornamento del ruolo');
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        if (userId === currentUser?.id) {
            setError('Non puoi eliminare il tuo stesso account');
            return;
        }

        if (!window.confirm(`Sei sicuro di voler eliminare l'utente "${username}"? Questa azione è irreversibile.`)) {
            return;
        }

        try {
            const token = sessionStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccessMessage(`Utente ${username} eliminato con successo`);
            fetchUsers();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Errore durante l\'eliminazione dell\'utente');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToReset || newPassword.length < 6) {
            setError('La password deve essere di almeno 6 caratteri');
            return;
        }

        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/users/${userToReset.id}/reset-password`,
                { newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccessMessage(`Password di ${userToReset.username} resettata con successo`);
            setResetPasswordModalOpen(false);
            setUserToReset(null);
            setNewPassword('');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Errore durante il reset della password');
        }
    };

    const sortedUsers = [...users].sort((a, b) => {
        if (a.ruolo === 'ADMIN' && b.ruolo !== 'ADMIN') return -1;
        if (a.ruolo !== 'ADMIN' && b.ruolo === 'ADMIN') return 1;
        if (a.ruolo === 'COACH' && b.ruolo === 'USER') return -1;
        if (a.ruolo === 'USER' && b.ruolo === 'COACH') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <Users className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-dark uppercase tracking-tight">Gestione Utenti</h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-widest flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" />
                            Amministrazione Accessi e Ruoli (Admin, Coach, Atleti)
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all active:scale-95 uppercase text-xs tracking-widest"
                >
                    <UserPlus className="w-4 h-4" />
                    Aggiungi Admin
                </button>
            </div>

            {/* Alert Messaggi */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center justify-between group animate-shake">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <p className="text-sm text-red-700 font-bold">{error}</p>
                    </div>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors">
                        <ArrowRightLeft className="w-4 h-4 rotate-45" />
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-sm text-green-700 font-bold uppercase tracking-tight">{successMessage}</p>
                </div>
            )}

            {/* Tabella Utenti */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Utente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ruolo Attuale</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Creazione</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Azioni & Cambio Ruolo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-8">
                                            <div className="h-4 bg-gray-100 rounded-full w-3/4 mx-auto"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 uppercase font-bold text-sm">
                                        Nessun utente trovato
                                    </td>
                                </tr>
                            ) : (
                                sortedUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl border-2 ${
                                                    u.ruolo === 'ADMIN'
                                                        ? 'bg-secondary/10 border-secondary/20'
                                                        : u.ruolo === 'COACH'
                                                        ? 'bg-amber-400/20 border-amber-300'
                                                        : 'bg-gray-100 border-gray-200'
                                                }`}>
                                                    {u.ruolo === 'ADMIN' ? (
                                                        <Shield className="w-5 h-5 text-secondary" />
                                                    ) : u.ruolo === 'COACH' ? (
                                                        <Award className="w-5 h-5 text-amber-600" />
                                                    ) : (
                                                        <UserIcon className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-dark text-sm uppercase tracking-tight">{u.nome} {u.cognome}</span>
                                                        {u.id === currentUser?.id && (
                                                            <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">Tu</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                                            <UserIcon className="w-3 h-3" />
                                                            {u.username}
                                                        </span>
                                                        {u.email && (
                                                            <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                                                <Mail className="w-2.5 h-2.5" />
                                                                {u.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                                u.ruolo === 'ADMIN'
                                                    ? 'bg-secondary text-white border border-secondary shadow-sm'
                                                    : u.ruolo === 'COACH'
                                                    ? 'bg-amber-400 text-slate-950 font-black border border-amber-300 shadow-sm'
                                                    : 'bg-gray-100 text-gray-500 border border-transparent'
                                            }`}>
                                                {u.ruolo === 'ADMIN' ? (
                                                    <Shield className="w-3 h-3" />
                                                ) : u.ruolo === 'COACH' ? (
                                                    <Award className="w-3 h-3" />
                                                ) : (
                                                    <UserIcon className="w-3 h-3" />
                                                )}
                                                {u.ruolo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatDate(u.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Selettore Ruolo */}
                                                <select
                                                    value={u.ruolo}
                                                    onChange={(e) => handleSetRole(u.id, u.ruolo, e.target.value)}
                                                    className="bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-gray-100"
                                                    title="Modifica Ruolo"
                                                >
                                                    <option value="USER">USER (Atleta)</option>
                                                    <option value="COACH">COACH (Formazioni)</option>
                                                    <option value="ADMIN">ADMIN (Totale)</option>
                                                </select>

                                                <button
                                                    onClick={() => {
                                                        setUserToReset(u);
                                                        setNewPassword('');
                                                        setResetPasswordModalOpen(true);
                                                    }}
                                                    className="p-2 rounded-xl border-2 transition-all shadow-sm bg-white border-gray-100 text-gray-500 hover:bg-primary/10 hover:border-primary/20 hover:text-primary hover:-translate-y-0.5"
                                                    title="Resetta Password"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button
                                                    disabled={u.id === currentUser?.id}
                                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                                    className={`p-2 rounded-xl border-2 border-gray-100 text-gray-400 transition-all ${u.id === currentUser?.id
                                                        ? 'opacity-30 cursor-not-allowed'
                                                        : 'hover:bg-red-500 hover:text-white hover:border-red-500 hover:-translate-y-0.5 shadow-sm'
                                                        }`}
                                                    title="Elimina Utente"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ModalNuovoAdmin
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    fetchUsers();
                    setSuccessMessage('Nuovo amministratore creato con successo!');
                    setTimeout(() => setSuccessMessage(''), 3000);
                }}
            />

            {/* Modale Reset Password */}
            {resetPasswordModalOpen && userToReset && (
                <div className="fixed inset-0 bg-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-6 sm:p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-dark tracking-tight uppercase">Reset Password</h2>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Imposta una nuova password per <span className="text-primary">{userToReset.username}</span></p>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <Key className="w-6 h-6 text-primary" />
                                </div>
                            </div>

                            <form onSubmit={handleResetPassword} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nuova Password</label>
                                    <input
                                        type="text"
                                        placeholder="Inserisci password..."
                                        className="w-full px-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        autoComplete="off"
                                    />
                                    <p className="text-[10px] text-gray-400 font-medium px-1 uppercase tracking-widest">Minimo 6 caratteri</p>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setResetPasswordModalOpen(false);
                                            setUserToReset(null);
                                        }}
                                        className="flex-1 px-4 py-3.5 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-all uppercase tracking-widest text-xs"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-widest"
                                    >
                                        Conferma
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestioneUtenti;
