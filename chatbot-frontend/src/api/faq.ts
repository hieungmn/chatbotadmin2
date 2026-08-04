import API from './client';

// ===================== FAQ =====================
export const syncFaqDatabase = (site_id: string, file_name: string, faq_list: any[]) =>
    API.post('/admin/faq/sync', { site_id, file_name, faq_list }).then(r => r.data);

export const getFaqBatches = (siteId: string) =>
    API.get('/admin/faq/batches', { params: { site_id: siteId } }).then(r => r.data);

export const deleteFaqBatch = (id: number) =>
    API.delete(`/admin/faq/batches/${id}`).then(r => r.data);

export const reviewFaqBatch = (id: number, approve: boolean) =>
    API.post(`/admin/faq/batches/${id}/review`, { approve }).then(r => r.data);

export const getFaqList = (siteId?: string | null) =>
    API.get('/admin/faq', { params: siteId ? { site_id: siteId } : {} }).then(r => r.data);

export const createFaqItem = (payload: {
    site_id: string; data_id?: string; category: string; question: string;
    keywords: string; answer_text: string; redirect_url?: string; is_draft: boolean;
}) => API.post('/admin/faq', payload).then(r => r.data);

export const updateFaqItem = (id: number, payload: {
    category: string; question: string; keywords: string;
    answer_text: string; redirect_url?: string; is_draft: boolean;
}) => API.put(`/admin/faq/${id}`, payload).then(r => r.data);

export const reviewFaqItem = (id: number, approve: boolean) =>
    API.post(`/admin/faq/${id}/review`, { approve }).then(r => r.data);

export const deleteFaqItem = (id: number) =>
    API.delete(`/admin/faq/${id}`).then(r => r.data);

export const uploadFaqImages = (faqId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    return API.post(`/admin/faq/${faqId}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

export const getFaqImages = (faqId: number) => API.get(`/admin/faq/${faqId}/images`).then(r => r.data);

export const deleteFaqImage = (faqId: number, imageId: number) =>
    API.delete(`/admin/faq/${faqId}/images/${imageId}`).then(r => r.data);
