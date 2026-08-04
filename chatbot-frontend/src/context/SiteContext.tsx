import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMySites } from '../api/api';
import type { Site } from '../types';
import { useAuth } from './AuthContext';

interface SiteState {
    sites: Site[];
    selectedSiteId: string | null;
    setSelectedSiteId: (id: string) => void;
    loading: boolean;
    hasNoSites: boolean;
    refresh: () => void;
}

const SiteContext = createContext<SiteState | null>(null);

const STORAGE_KEY = 'selected_site_id';

export function SiteProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteIdState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const setSelectedSiteId = useCallback((id: string) => {
        setSelectedSiteIdState(id);
        localStorage.setItem(STORAGE_KEY, id);
    }, []);

    const load = useCallback(() => {
        if (!isAuthenticated) return;
        setLoading(true);
        getMySites()
            .then((data) => {
                const list: Site[] = data.sites || [];
                setSites(list);

                const stored = localStorage.getItem(STORAGE_KEY);
                const stillValid = stored && list.some(s => s.site_id === stored);

                if (stillValid) {
                    setSelectedSiteIdState(stored);
                } else if (list.length > 0) {
                    setSelectedSiteIdState(list[0].site_id);
                    localStorage.setItem(STORAGE_KEY, list[0].site_id);
                } else {
                    setSelectedSiteIdState(null);
                    localStorage.removeItem(STORAGE_KEY);
                }
            })
            .catch(() => setSites([]))
            .finally(() => setLoading(false));
    }, [isAuthenticated]);

    useEffect(() => { load(); }, [load]);

    return (
        <SiteContext.Provider value={{
            sites, selectedSiteId, setSelectedSiteId, loading,
            hasNoSites: !loading && sites.length === 0,
            refresh: load,
        }}>
            {children}
        </SiteContext.Provider>
    );
}

export function useSite() {
    const ctx = useContext(SiteContext);
    if (!ctx) throw new Error('useSite phải dùng bên trong <SiteProvider>');
    return ctx;
}
