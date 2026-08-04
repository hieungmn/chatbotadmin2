import API from './client';

// ===================== KNOWLEDGE (AI RAG) =====================
export const uploadKnowledgeFile = (formData: FormData) =>
    API.post('/knowledge/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);

export const getKnowledgeFiles = (siteId?: string | null) =>
    API.get('/knowledge/files', { params: siteId ? { site_id: siteId } : {} }).then(r => r.data);

export const reviewKnowledgeFile = (id: number, approve: boolean) =>
    API.post(`/knowledge/files/${id}/review`, { approve }).then(r => r.data);

export const getKnowledgeFileChunks = (id: number) => API.get(`/knowledge/files/${id}/chunks`).then(r => r.data);

export const deleteKnowledgeFile = (id: number) =>
    API.delete(`/knowledge/files/${id}`).then(r => r.data);
