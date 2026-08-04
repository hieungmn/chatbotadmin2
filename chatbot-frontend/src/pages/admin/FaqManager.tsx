import { useEffect, useRef, useState } from 'react';
import { createFaqItem, deleteFaqImage, deleteFaqItem, getFaqImages, getFaqList, reviewFaqItem, updateFaqItem, uploadFaqImages } from '../../api/faq';
import { useSite } from '../../context/SiteContext';
import { useAuth } from '../../context/AuthContext';
import { FaqImage, FaqItem } from '../../types';
import { BASE_URL } from '../../api/client';
import Badge from '../../components/Badge';
import ImageLightbox from '../../components/ImageLightbox';
import EmptyState from '../../components/EmptyState';
import { IconPlus, IconRefresh, IconTrash } from '../../components/icons';

const EMPTY_FORM = { category: '', question: '', keywords: '', answer_text: '', redirect_url: '', is_draft: false };

const MAX_FAQ_IMAGES = 5;
const isLocked = (item: FaqItem) => item.approval_status === 'rejected' || item.batch_approval_status === 'rejected';

const statusBadge = (item: FaqItem) => {
    if (item.batch_approval_status === 'rejected') return <Badge tone="danger">却下</Badge>;
    if (item.approval_status === 'pending') return <Badge tone="warning">承認待ち</Badge>;
    if (item.approval_status === 'rejected') return <Badge tone="danger">却下</Badge>;
    return item.is_draft ? <Badge tone="neutral">下書き</Badge> : <Badge tone="success">公開中</Badge>;
};

export default function FaqManager() {

    const { selectedSiteId, hasNoSites, sites } = useSite();

    const { role } = useAuth();

    const [faqs, setFaqs] = useState<FaqItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [modalImages, setModalImages] = useState<FaqImage[]>([]);
    const [imagesLoading, setImagesLoading] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [imageError, setImageError] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const currentSite = sites.find(s => s.site_id === selectedSiteId);

    const fetchFaqs = () => {
        if (!selectedSiteId) { setFaqs([]); setLoading(false); return; }
        setLoading(true);
        getFaqList(selectedSiteId)
            .then(res => { if (res.success) setFaqs(res.faqs || []); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchFaqs(); }, [selectedSiteId]);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setModalImages([]);
        setImageError('');
        setModalOpen(true);
    };

    const openEdit = (item: FaqItem) => {
        if (isLocked(item)) return;
        setEditingId(item.id);
        setForm({
            category: item.category, question: item.question, keywords: item.keywords,
            answer_text: item.answer_text, redirect_url: item.redirect_url || '', is_draft: role === 'admin' && item.is_draft,
        });
        setFormError('');
        setImageError('');
        setModalImages([]);
        setImagesLoading(true);
        getFaqImages(item.id)
            .then(res => { if (res.success) setModalImages(res.images || []); })
            .finally(() => setImagesLoading(false));
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.question.trim() || !form.answer_text.trim()) {
            setFormError('質問と回答は必須項目です。');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editingId) {
                const res = await updateFaqItem(editingId, form);
                if (res.success) {
                    setFaqs(prev => prev.map(f => f.id === editingId ? { ...f, ...res.faq } : f));
                    setModalOpen(false);
                } else {
                    setFormError(res.message || '更新に失敗しました。');
                }
            } else {
                if (!selectedSiteId) return;
                const res = await createFaqItem({ site_id: selectedSiteId, ...form });
                if (res.success) {
                    setFaqs(prev => [res.faq, ...prev]);
                    // 画像は既存のFAQ（faq_id）にのみ添付可能なため、作成直後に編集
                    // モードへ切り替え、閉じ直さずそのまま画像を追加できるようにする。
                    setEditingId(res.faq.id);
                } else {
                    setFormError(res.message || '作成に失敗しました。');
                }
            }
        } catch (err: any) {
            setFormError(err.response?.data?.message || '保存に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: FaqItem) => {
        if (!window.confirm(`「${item.question}」を削除しますか？この操作は取り消せません。`)) return;
        setBusyId(item.id);
        try {
            await deleteFaqItem(item.id);
            setFaqs(prev => prev.filter(f => f.id !== item.id));
        } catch (err: any) {
            alert(err.response?.data?.message || '削除に失敗しました。');
        } finally {
            setBusyId(null);
        }
    };

    const handleReview = async (item: FaqItem, approve: boolean) => {
        setBusyId(item.id);
        try {
            await reviewFaqItem(item.id, approve);
            setFaqs(prev => prev.map(f => f.id === item.id ? { ...f, approval_status: approve ? 'approved' : 'rejected', is_draft: approve ? false : f.is_draft } : f));
        } catch (err: any) {
            alert(err.response?.data?.message || '処理に失敗しました。');
        } finally {
            setBusyId(null);
        }
    };

    const handleImageSelect = async (files: FileList | null) => {
        if (!files || files.length === 0 || !editingId) return;
        setImageError('');

        const fileArr = Array.from(files);
        if (modalImages.length + fileArr.length > MAX_FAQ_IMAGES) {
            setImageError(`画像は1つのFAQにつき最大${MAX_FAQ_IMAGES}枚までです（現在${modalImages.length}枚登録済み）。`);
            return;
        }
        const tooBig = fileArr.find(f => f.size > 5 * 1024 * 1024);
        if (tooBig) {
            setImageError(`「${tooBig.name}」は5MBを超えています。5MB以内の画像を選択してください。`);
            return;
        }

        setImageUploading(true);
        try {
            const res = await uploadFaqImages(editingId, fileArr);
            if (res.success) {
                setModalImages(prev => [...prev, ...res.images]);
                setFaqs(prev => prev.map(f => f.id === editingId ? { ...f, approval_status: role === 'admin' ? f.approval_status : 'pending' } : f));
            } else {
                setImageError(res.message || 'アップロードに失敗しました。');
            }
        } catch (err: any) {
            setImageError(err.response?.data?.message || 'アップロードに失敗しました。');
        } finally {
            setImageUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const handleImageDelete = async (image: FaqImage) => {
        if (!editingId || !window.confirm('この画像を削除しますか？')) return;
        try {
            await deleteFaqImage(editingId, image.id);
            setModalImages(prev => prev.filter(img => img.id !== image.id));
            setFaqs(prev => prev.map(f => f.id === editingId ? { ...f, approval_status: role === 'admin' ? f.approval_status : 'pending' } : f));
        } catch (err: any) {
            setImageError(err.response?.data?.message || '削除に失敗しました。');
        }
    };

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    useEffect(() => { setSearch(''); setStatus('all'); }, [selectedSiteId]);
    const normalizedSearch = search.trim().normalize('NFKC').toLowerCase();
    const visibleFaqs = faqs.filter(faq => {
        const matchesSearch = [faq.question, faq.answer_text, faq.category, faq.keywords, faq.id]
            .some(value => String(value ?? '').normalize('NFKC').toLowerCase().includes(normalizedSearch));
        const effectiveStatus = faq.batch_approval_status === 'rejected' ? 'rejected' : faq.approval_status;
        const matchesStatus = status === 'all' || (status === 'draft' ? effectiveStatus === 'approved' && faq.is_draft
            : status === 'published' ? effectiveStatus === 'approved' && !faq.is_draft : effectiveStatus === status);
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="page">
            <div className="page-head">
                <div className="page-head-row">
                    <div>
                        <div className="page-eyebrow">FAQ Manager</div>
                        <h1 className="page-title">FAQ管理</h1>
                        <div className="page-desc">登録済みのFAQを確認し、追加・編集・削除ができます（{currentSite?.site_name || selectedSiteId} 対象）。</div>
                    </div>
                    <div className="page-actions">
                        <button onClick={fetchFaqs} disabled={loading} className="btn btn-secondary"><IconRefresh size={13} /> 更新</button>
                        {selectedSiteId && (
                            <button onClick={openCreate} className="btn btn-primary"><IconPlus size={13} /> 新規追加</button>
                        )}
                    </div>
                </div>
            </div>

            {hasNoSites ? (
                <div className="panel"><EmptyState title="割り当てられたサイトがありません" /></div>
            ) : (
                <div className="panel">
                    <div className="table-toolbar">
                        <div className="table-toolbar-controls">
                            <input className="field-input search-field" type="search" aria-label="FAQを検索" placeholder="質問・回答・キーワードで検索…"
                                value={search} onChange={event => setSearch(event.target.value)} />
                            <select className="field-select status-filter" aria-label="FAQの状態" value={status} onChange={event => setStatus(event.target.value)}>
                                <option value="all">すべての状態</option><option value="published">公開中</option>
                                <option value="pending">承認待ち</option>{role === 'admin' && <option value="draft">下書き</option>}<option value="rejected">却下</option>
                            </select>
                            {(search || status !== 'all') && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatus('all'); }}>クリア</button>}
                        </div>
                        <span className="table-result-count" role="status">{visibleFaqs.length} / {faqs.length} 件</span>
                    </div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>カテゴリ</th>
                                    <th>質問</th>
                                    <th>キーワード</th>
                                    <th>状態</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="table-empty">読み込み中…</td></tr>
                                ) : visibleFaqs.length === 0 ? (
                                    <tr><td colSpan={6} className="table-empty">{faqs.length ? '検索条件に一致するFAQがありません' : 'FAQが登録されていません'}</td></tr>
                                ) : (
                                    visibleFaqs.map(f => (
                                        <tr key={f.id}>
                                            <td className="cell-mono cell-muted">{f.data_id}</td>
                                            <td className="cell-muted">{f.category}</td>
                                            <td className="cell-truncate" title={f.question}>
                                                {f.question}
                                                {f.batch_file_name && <div className="cell-muted cell-truncate" style={{ fontSize: 10.5, marginTop: 2 }} title={f.batch_file_name}>ファイル: {f.batch_file_name}</div>}
                                            </td>
                                            <td className="cell-muted cell-truncate-sm" title={f.keywords}>{f.keywords}</td>
                                            <td>
                                                {statusBadge(f)}
                                                {Number(f.image_count || 0) > 0 && (
                                                    <span style={{ marginLeft: 4 }}><Badge tone="info">画像{f.image_count}</Badge></span>
                                                )}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {role === 'admin' && f.batch_approval_status !== 'rejected' && (f.approval_status === 'pending' || (f.approval_status === 'rejected' && !f.import_batch_id)) && (
                                                    <>
                                                        <button className="btn btn-secondary btn-sm" disabled={busyId === f.id} onClick={() => handleReview(f, true)} style={{ marginRight: 6 }}>承認</button>
                                                        {f.approval_status === 'pending' && <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => handleReview(f, false)} style={{ marginRight: 6 }}>却下</button>}
                                                    </>
                                                )}
                                                {!isLocked(f) && <button className="btn btn-secondary btn-sm" disabled={busyId === f.id} onClick={() => openEdit(f)} style={{ marginRight: 6 }}>
                                                    編集
                                                </button>}
                                                {isLocked(f) && f.import_batch_id && <span className="cell-muted" style={{ marginRight: 6, fontSize: 11 }}>FAQ一括取込で再承認</span>}
                                                <button className="btn btn-danger btn-sm" disabled={busyId === f.id} onClick={() => handleDelete(f)}>
                                                    <IconTrash size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,61,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
                    <div className="panel" style={{ width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: '88vh', overflowY: 'auto', background: '#fff' }}>
                        <div className="panel-head">
                            <span className="panel-head-title">{editingId ? 'FAQを編集' : 'FAQを新規追加'}（{currentSite?.site_name || selectedSiteId}）</span>
                        </div>
                        <div className="panel-body">
                            {formError && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{formError}</div>}
                            {role === 'staff' && (
                                <div className="banner banner-info" style={{ marginBottom: 14 }}>保存後、管理者の承認を経てAIに反映されます。</div>
                            )}

                            <div className="field">
                                <label className="field-label">カテゴリ</label>
                                <input className="field-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="例: 導入・運用サポート" />
                            </div>
                            <div className="field">
                                <label className="field-label">質問 *</label>
                                <textarea className="field-textarea" style={{ height: 60 }} value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} />
                            </div>
                            <div className="field">
                                <label className="field-label">キーワード（カンマ区切り）</label>
                                <input className="field-input" value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} placeholder="例: 導入, 運用, サポート" />
                            </div>
                            <div className="field">
                                <label className="field-label">回答 *</label>
                                <textarea className="field-textarea" style={{ height: 120 }} value={form.answer_text} onChange={e => setForm({ ...form, answer_text: e.target.value })} />
                            </div>
                            <div className="field">
                                <label className="field-label">詳細リンク（任意）</label>
                                <input className="field-input" value={form.redirect_url} onChange={e => setForm({ ...form, redirect_url: e.target.value })} placeholder="https://..." />
                            </div>
                            {role === 'admin' && <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label className="switch">
                                    <input type="checkbox" checked={!form.is_draft} onChange={e => setForm({ ...form, is_draft: !e.target.checked })} />
                                    <span className="switch-track" />
                                    <span className="switch-thumb" />
                                </label>
                                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{form.is_draft ? '下書き（非公開）' : '公開する'}</span>
                            </div>}

                            <div className="field">
                                <label className="field-label">画像（任意・最大{MAX_FAQ_IMAGES}枚）</label>
                                {!editingId ? (
                                    <div className="field-hint">画像は保存後に追加できます。まずFAQを作成してください。</div>
                                ) : (
                                    <>
                                        {imageError && <div className="banner banner-danger" style={{ marginBottom: 8, fontSize: 11 }}>{imageError}</div>}
                                        {imagesLoading ? (
                                            <div className="field-hint">読み込み中…</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                                {modalImages.map((img, idx) => (
                                                    <div key={img.id} style={{ position: 'relative', width: 76, height: 76 }}>
                                                        <img
                                                            src={`${BASE_URL}${img.image_path}`}
                                                            alt=""
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}
                                                            onClick={() => setLightboxIndex(idx)}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleImageDelete(img)}
                                                            style={{
                                                                position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                                                                background: '#fff', border: '1px solid var(--border-strong)', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                                                            }}
                                                        >
                                                            <IconTrash size={11} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {modalImages.length < MAX_FAQ_IMAGES && (
                                            <>
                                                <input
                                                    type="file"
                                                    ref={imageInputRef}
                                                    accept="image/jpeg,image/png,image/webp"
                                                    multiple
                                                    style={{ display: 'none' }}
                                                    onChange={e => handleImageSelect(e.target.files)}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={imageUploading}
                                                    onClick={() => imageInputRef.current?.click()}
                                                >
                                                    {imageUploading ? 'アップロード中…' : '画像を追加'}
                                                </button>
                                                <div className="field-hint" style={{ marginTop: 4 }}>jpg / png / webp、1枚5MBまで。質問に一致した際、回答と一緒に表示されます。</div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>キャンセル</button>
                                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                                    {saving ? '保存中…' : editingId ? '更新する' : '作成する'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {lightboxIndex !== null && (
                <ImageLightbox
                    images={modalImages.map(img => `${BASE_URL}${img.image_path}`)}
                    index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onIndexChange={setLightboxIndex}
                />
            )}
        </div>
    );
}
