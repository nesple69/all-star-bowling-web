import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Istanza Axios centralizzata per tutte le chiamate API dell'applicazione.
 * Inietta automaticamente il token JWT presente in sessionStorage per le richieste autenticate.
 */
export const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = sessionStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Se il token scade o non è valido, rimuoviamo il token invalido da sessionStorage
            // (evitando loop infiniti se siamo già nella pagina di login)
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                console.warn('⚠️ Sessione scaduta o non valida (401).');
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
