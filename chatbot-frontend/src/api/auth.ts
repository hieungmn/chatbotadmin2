import API from './client';

// ===================== AUTH =====================
export const login = (username: string, password: string) =>
    API.post('/auth/admin/login', { username, password }).then(r => r.data);
