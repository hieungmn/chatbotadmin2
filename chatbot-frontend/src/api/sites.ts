import API from './client';
import publicWidgetClient, { widgetApiUrl } from './public-widget-client';

// ===================== SITES =====================
export const getAllSites = () => API.get('/admin/sites').then(r => r.data);

export const updateSite = (siteId: string, payload: Partial<{ site_name: string; contact_url: string; home_url: string; theme_color: string; ai_model: string; custom_prompt_rules: string; avatar_url: string; is_active: boolean }>) =>
    API.put(`/admin/sites/${siteId}`, payload).then(r => r.data);

export const getOllamaModels = () => API.get('/admin/ollama-models').then(r => r.data);

export const getMySites = () => API.get('/admin/sites/my-sites').then(r => r.data);

export const getPublicSiteInfo = (siteId: string, apiUrl?: string, signal?: AbortSignal) =>
    publicWidgetClient.get(widgetApiUrl(`/sites/${encodeURIComponent(siteId)}/public`, apiUrl), { signal }).then(r => r.data);
