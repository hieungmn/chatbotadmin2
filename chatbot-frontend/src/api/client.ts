import axios from 'axios';
import { clearAdminAuth } from './auth-storage';

// Vite reads VITE_API_URL from the frontend environment; local backend by default.
export const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

// ngrok無料版でテストする際に必須のヘッダー — これがないとngrokが警告用の
// HTMLページを差し込んでしまい、バックエンドへリクエストが届かない。
// JSON呼び出し（fetch/XHR）はHTMLを受け取ってしまい、status 200でも
// 静かに失敗する（ウィジェットが「サポート」の初期状態のままになる）。
export const NGROK_SKIP_HEADER = { 'ngrok-skip-browser-warning': 'true' };

const API = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    headers: { 'Content-Type': 'application/json', ...NGROK_SKIP_HEADER },
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// トークンが期限切れ/無効な場合は、エラーを放置せずログイン画面へ強制的に戻す
API.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            clearAdminAuth(localStorage);
            if (!window.location.pathname.includes('/admin/login')) {
                window.location.href = '/admin/login';
            }
        }
        return Promise.reject(err);
    }
);

export default API;
