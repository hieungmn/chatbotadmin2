import axios from 'axios';
import { BASE_URL, NGROK_SKIP_HEADER } from './client';
import { normalizeWidgetApiUrl } from '../widget/widget-runtime';

// Public chat traffic never shares the admin client's token interceptor or credentials.
const publicWidgetClient = axios.create({ headers: NGROK_SKIP_HEADER, withCredentials: false });
publicWidgetClient.interceptors.request.use(config => {
    config.headers.delete('Authorization');
    config.headers.delete('Proxy-Authorization');
    config.auth = undefined;
    config.withCredentials = false;
    return config;
});

export function widgetApiUrl(path: string, apiUrl?: string): string {
    return `${normalizeWidgetApiUrl(apiUrl ?? BASE_URL)}/api/v1${path}`;
}

export default publicWidgetClient;
