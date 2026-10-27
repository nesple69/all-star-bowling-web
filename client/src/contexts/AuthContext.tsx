import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

interface User {
    id: string;
    username: string;
    email?: string;
    nome: string;
    cognome: string;
    ruolo: string;
    createdAt?: string;
    giocatore?: {
        id: string;
        nome: string;
        cognome: string;
        numeroTessera?: string;
        saldo?: {
            saldoAttuale: number;
        };
    };
}

interface AuthContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    token: string | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: () => boolean;
    isCoach: () => boolean;
    isCoachOrAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api/auth`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    const response = await axios.get(`${API_URL}/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setUser(response.data);
                } catch (error) {
                    console.error('Errore nel recupero utente:', error);
                    logout();
                }
            }
            setIsLoading(false);
        };

        fetchUser();
    }, [token]);

    const login = async (username: string, password: string) => {
        try {
            const response = await axios.post(`${API_URL}/login`, { username, password });
            const { token: newToken, user: newUser } = response.data;

            sessionStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(newUser);
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        sessionStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const isAdmin = () => user?.ruolo === 'ADMIN';
    const isCoach = () => user?.ruolo === 'COACH';
    const isCoachOrAdmin = () => user?.ruolo === 'ADMIN' || user?.ruolo === 'COACH';

    return (
        <AuthContext.Provider value={{ user, setUser, token, isLoading, login, logout, isAdmin, isCoach, isCoachOrAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve essere usato all\'interno di un AuthProvider');
    }
    return context;
};
