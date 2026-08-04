import React, { useEffect, useState } from 'react';
import { getAllSites } from '../../api/sites';
import { createStaffUser, deleteStaffUser, getStaffUsers, getUserPermissions, saveUserPermissions } from '../../api/users';
import { AdminUserAccount, Site } from '../../types';
import Badge from '../../components/Badge';
import { IconPlus, IconTrash } from '../../components/icons';
export default function ManageUsers() {

    const [users, setUsers] = useState<AdminUserAccount[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('staff');
    const [submitting, setSubmitting] = useState(false);
    const [permModalUser, setPermModalUser] = useState<AdminUserAccount | null>(null);
    const [permSiteIds, setPermSiteIds] = useState<string[]>([]);
    const [savingPerm, setSavingPerm] = useState(false);
    const showAlert = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 4000);
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [userRes, siteRes] = await Promise.all([getStaffUsers(), getAllSites()]);
            if (userRes.success) setUsers(userRes.users);
            if (siteRes.success) setSites(siteRes.sites);
        } catch {
            showAlert('データの取得に失敗しました。', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await createStaffUser({ username, password, full_name: fullName, role });
            if (res.success) {
                showAlert('メンバーを作成しました。', 'success');
                setUsername(''); setPassword(''); setFullName(''); setRole('staff');
                loadAll();
            } else {
                showAlert(res.message || '作成に失敗しました。', 'error');
            }
        } catch (err: any) {
            showAlert(err.response?.data?.message || '作成に失敗しました。', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (u: AdminUserAccount) => {
        if (!window.confirm(`「${u.username}」を削除しますか？`)) return;
        try {
            const res = await deleteStaffUser(u.id);
            if (res.success) {
                showAlert('削除しました。', 'success');
                setUsers(prev => prev.filter(x => x.id !== u.id));
            }
        } catch {
            showAlert('削除に失敗しました。', 'error');
        }
    };

    const openPermModal = async (u: AdminUserAccount) => {
        setPermModalUser(u);
        setPermSiteIds([]);
        try {
            const res = await getUserPermissions(u.id);
            if (res.success) setPermSiteIds(res.site_ids || []);
        } catch { /* noop */ }
    };

    const toggleSite = (siteId: string) => {
        setPermSiteIds(prev => prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]);
    };

    const savePermissions = async () => {
        if (!permModalUser) return;
        setSavingPerm(true);
        try {
            const res = await saveUserPermissions(permModalUser.id, permSiteIds);
            if (res.success) {
                showAlert('権限を更新しました。', 'success');
                setPermModalUser(null);
            }
        } catch {
            showAlert('権限の保存に失敗しました。', 'error');
        } finally {
            setSavingPerm(false);
        }
    };

    return (
        <div className="page">
            <div className="page-head">
                <div className="page-eyebrow">Users</div>
                <h1 className="page-title">ユーザー管理</h1>
                <div className="page-desc">社内アカウントの作成、削除、サイト権限の管理を行います。</div>
            </div>

            {message && <div className={`banner ${message.type === 'success' ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>{message.text}</div>}

            <div className="import-grid">
                <div className="panel">
                    <div className="panel-head"><span className="panel-head-title">新規メンバー追加</span></div>
                    <div className="panel-body">
                        <form onSubmit={handleCreate}>
                            <div className="field">
                                <label className="field-label">ユーザー名</label>
                                <input className="field-input" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="field">
                                <label className="field-label">パスワード</label>
                                <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                                <div className="field-hint">6文字以上</div>
                            </div>
                            <div className="field">
                                <label className="field-label">氏名</label>
                                <input className="field-input" value={fullName} onChange={e => setFullName(e.target.value)} />
                            </div>
                            <div className="field">
                                <label className="field-label">権限ロール</label>
                                <select className="field-select" value={role} onChange={e => setRole(e.target.value)}>
                                    <option value="staff">Staff（サイト権限制）</option>
                                    <option value="admin">Admin（全権限）</option>
                                </select>
                            </div>
                            <button disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
                                <IconPlus size={13} /> {submitting ? '作成中…' : 'メンバーを作成'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-head"><span className="panel-head-title">メンバー一覧（{users.length}名）</span></div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>ユーザー</th><th>ロール</th><th>状態</th><th>操作</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} className="table-empty">読み込み中…</td></tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{u.username}</div>
                                                <div className="cell-muted" style={{ fontSize: 11.5 }}>{u.full_name || '—'}</div>
                                            </td>
                                            <td>{u.role === 'admin' ? <Badge tone="info">ADMIN</Badge> : <Badge tone="neutral">STAFF</Badge>}</td>
                                            <td>{u.is_active ? <Badge tone="success">有効</Badge> : <Badge tone="danger">無効</Badge>}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {u.role === 'staff' && (
                                                    <button className="btn btn-secondary btn-sm" style={{ marginRight: 6 }} onClick={() => openPermModal(u)}>
                                                        サイト権限
                                                    </button>
                                                )}
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}><IconTrash size={12} /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {permModalUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,61,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div className="panel" style={{ width: 420, maxWidth: 'calc(100vw - 32px)', background: '#fff' }}>
                        <div className="panel-head">
                            <span className="panel-head-title">サイト権限 — {permModalUser.username}</span>
                        </div>
                        <div className="panel-body">
                            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                                {sites.map(site => {
                                    const enabled = permSiteIds.includes(site.site_id);
                                    return (
                                        <div key={site.site_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ fontSize: 12.5 }}>{site.site_name}</span>
                                            <label className="switch">
                                                <input type="checkbox" checked={enabled} onChange={() => toggleSite(site.site_id)} />
                                                <span className="switch-track" />
                                                <span className="switch-thumb" />
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn btn-ghost" onClick={() => setPermModalUser(null)}>キャンセル</button>
                                <button className="btn btn-primary" disabled={savingPerm} onClick={savePermissions}>
                                    {savingPerm ? '保存中…' : '保存する'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
