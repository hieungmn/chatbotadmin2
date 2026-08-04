import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Role } from '../types';
import { clearAdminAuth } from '../api/auth-storage';

interface AuthState {
    token: string | null;
    username: string | null;
    fullName: string | null;
    role: Role | null;
    isAuthenticated: boolean;
    login: (token: string, username: string, role: Role, fullName?: string | null) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
    const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
    const [fullName, setFullName] = useState<string | null>(localStorage.getItem('full_name'));
    const [role, setRole] = useState<Role | null>((localStorage.getItem('user_role') as Role) || null);

    const login = useCallback((newToken: string, newUsername: string, newRole: Role, newFullName?: string | null) => {
        localStorage.setItem('admin_token', newToken);
        localStorage.setItem('username', newUsername);
        localStorage.setItem('user_role', newRole);
        if (newFullName) localStorage.setItem('full_name', newFullName);
        setToken(newToken);
        setUsername(newUsername);
        setRole(newRole);
        setFullName(newFullName || null);
    }, []);

    const logout = useCallback(() => {
        clearAdminAuth(localStorage);
        setToken(null);
        setUsername(null);
        setRole(null);
        setFullName(null);
    }, []);

    return (
        <AuthContext.Provider value={{ token, username, fullName, role, isAuthenticated: !!token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
    return ctx;
}
