import API from './client';

// ===================== STAFF USERS =====================
export const getStaffUsers = () => API.get('/staff-users').then(r => r.data);

export const createStaffUser = (payload: { username: string; password: string; full_name: string; role: string }) =>
    API.post('/staff-users', payload).then(r => r.data);

export const deleteStaffUser = (id: number) => API.delete(`/staff-users/${id}`).then(r => r.data);

export const getUserPermissions = (id: number) => API.get(`/staff-users/${id}/permissions`).then(r => r.data);

export const saveUserPermissions = (id: number, site_ids: string[]) =>
    API.post(`/staff-users/${id}/permissions`, { site_ids }).then(r => r.data);
