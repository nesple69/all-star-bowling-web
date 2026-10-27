import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
    const { token, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return token ? <Outlet /> : <Navigate to="/login" replace />;
};

export const ProtectedAdminRoute: React.FC = () => {
    const { token, isAdmin, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (!isAdmin()) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export const ProtectedCoachRoute: React.FC = () => {
    const { token, isCoachOrAdmin, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (!isCoachOrAdmin()) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};
