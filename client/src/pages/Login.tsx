import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User as UserIcon, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Errore durante il login. Verifica le credenziali.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border-t-4 border-secondary">
                <div className="text-center">
                    <div className="inline-block p-3 bg-white rounded-2xl shadow-lg mb-4 border-2 border-secondary overflow-hidden w-24 h-24 flex items-center justify-center mx-auto transition-transform hover:scale-105">
                        <img
                            src="/logo All Star.png"
                            alt="Logo ALL STAR TEAM"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0Y4QjUwMCIgZD0iTTEyIDFsMy4zOSA2LjY4IDcuNjEgMS4xLTUuNSA1LjM2IDEuMyA3LjYyLTkuOC0zLjY2LTYuOCA0Ljk2IDEuMy03LjYyLTUuNS01LjM2IDcuNjEtMS4xTDEyIDFsMy4zOSA2LjY4eiIvPjwvc3ZnPg==';
                            }}
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-dark font-heading uppercase tracking-tight">ALL STAR TEAM</h1>
                    <p className="text-gray-500 text-sm mt-1 uppercase tracking-tighter">Area Riservata Associazione</p>
                    <div className="mt-2 h-1 w-20 bg-secondary mx-auto rounded-full"></div>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-center gap-3 animate-shake">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-xs font-bold text-dark uppercase ml-1 mb-1.5">
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    className="appearance-none relative block w-full px-10 py-3 border-2 border-gray-100 placeholder-gray-400 text-dark rounded-lg focus:outline-none focus:border-primary focus:ring-0 transition-colors sm:text-sm font-medium"
                                    placeholder="Il tuo username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-bold text-dark uppercase ml-1 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    className="appearance-none relative block w-full px-10 py-3 border-2 border-gray-100 placeholder-gray-400 text-dark rounded-lg focus:outline-none focus:border-primary focus:ring-0 transition-colors sm:text-sm font-medium pr-10"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-primary transition-colors cursor-pointer"
                                    title={showPassword ? "Nascondi password" : "Mostra password"}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold uppercase tracking-widest rounded-lg text-white bg-primary hover:bg-light-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-md hover:shadow-lg transition-all duration-200 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}`}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Accesso in corso...
                                </span>
                            ) : 'Accedi'}
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-2">
                        <div className="flex items-center w-full gap-4">
                            <div className="h-[1px] bg-gray-100 flex-1"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Oppure</span>
                            <div className="h-[1px] bg-gray-100 flex-1"></div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="text-xs font-bold text-gray-500 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-2 group"
                        >
                            Continua come Ospite
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    </div>
                </form>

                <p className="text-center text-[10px] text-gray-400 uppercase font-bold tracking-widest pt-4">
                    Associazione Sportiva Dilettantistica ALL STAR TEAM
                </p>
            </div>
        </div>
    );
};

export default Login;
