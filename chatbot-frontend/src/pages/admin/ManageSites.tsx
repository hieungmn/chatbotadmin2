import { useEffect, useState } from 'react';
import { getAllSites, getOllamaModels, updateSite } from '../../api/sites';
import { Site } from '../../types';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import { IconRefresh } from '../../components/icons';
type Tab = 'general' | 'llm' | 'chat';

export default function ManageSites() {

    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('general');
    const [form, setForm] = useState({
        site_name: '', contact_url: '', home_url: '', theme_color: '#1B2C4F',
        ai_model: 'gemma3:4b', custom_prompt_rules: '',
        avatar_url: '', is_active: true,
    });

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [savedMsg, setSavedMsg] = useState('');
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [modelsError, setModelsError] = useState('');
    const [modelsLoading, setModelsLoading] = useState(false);
    const [useManualModel, setUseManualModel] = useState(false);
    const fetchOllamaModels = () => {
        setModelsLoading(true);
        setModelsError('');
        getOllamaModels()
            .then(res => {
                if (res.success) setOllamaModels(res.models || []);
                else setModelsError(res.message || 'モデル一覧の取得に失敗しました。');
            })
            .catch(err => setModelsError(err.response?.data?.message || 'Ollamaサーバーに接続できませんでした。'))
            .finally(() => setModelsLoading(false));
    };

    useEffect(() => { fetchOllamaModels(); }, []);

    const fetchSites = () => {
        setLoading(true);
        getAllSites()
            .then(res => {
                if (res.success) {
                    setSites(res.sites || []);
                    if (!activeSiteId && res.sites?.length > 0) selectSite(res.sites[0]);
                }
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSites(); }, []);

    const selectSite = (site: Site) => {
        setActiveSiteId(site.site_id);
        setTab('general');
        setFormError('');
        setSavedMsg('');
        const currentModel = site.ai_model || 'gemma3:4b';
        setUseManualModel(ollamaModels.length > 0 && !ollamaModels.includes(currentModel));
        setForm({
            site_name: site.site_name,
            contact_url: site.contact_url,
            home_url: site.home_url || '',
            theme_color: site.theme_color || '#1B2C4F',
            ai_model: currentModel,
            custom_prompt_rules: site.custom_prompt_rules || '',
            avatar_url: site.avatar_url || '',
            is_active: site.is_active,
        });
    };

    const activeSite = sites.find(s => s.site_id === activeSiteId) || null;

    const handleSave = async () => {
        if (!activeSiteId) return;
        setSaving(true);
        setFormError('');
        setSavedMsg('');
        try {
            const res = await updateSite(activeSiteId, form);
            if (res.success) {
                setSites(prev => prev.map(s => s.site_id === activeSiteId ? { ...s, ...res.site } : s));
                setSavedMsg('保存しました。');
                setTimeout(() => setSavedMsg(''), 2500);
            } else {
                setFormError(res.message || '更新に失敗しました。');
            }
        } catch (err: any) {
            setFormError(err.response?.data?.message || '更新に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <div className="page-head">
                <div className="page-head-row">
                    <div>
                        <div className="page-eyebrow">Sites</div>
                        <h1 className="page-title">サイト管理</h1>
                        <div className="page-desc">サイトを選択して、基本情報・AIモデル・ウィジェットの外観を設定します。</div>
                    </div>
                    <div className="page-actions">
                        <button onClick={fetchSites} disabled={loading} className="btn btn-secondary"><IconRefresh size={13} /> 更新</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="panel"><EmptyState title="読み込み中…" /></div>
            ) : sites.length === 0 ? (
                <div className="panel"><EmptyState title="サイトが登録されていません" /></div>
            ) : (
                <div className="site-management-grid">
                    {/* ===== 左: サイト一覧（コンパクト） ===== */}
                    <div className="panel">
                        <div style={{ padding: 6 }}>
                            {sites.map(site => (
                                <button
                                    key={site.site_id}
                                    onClick={() => selectSite(site)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                                        marginBottom: 2, borderRadius: 5, border: 'none', textAlign: 'left', cursor: 'pointer',
                                        background: activeSiteId === site.site_id ? 'var(--surface-sunken)' : 'transparent',
                                        fontSize: 12.5, fontWeight: activeSiteId === site.site_id ? 700 : 500,
                                    }}
                                >
                                    <span style={{
                                        width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                                        background: site.theme_color || '#1B2C4F',
                                    }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.site_name}</span>
                                    {!site.is_active && <Badge tone="danger">停止</Badge>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ===== 右: 詳細パネル（タブ切り替え） ===== */}
                    {activeSite && (
                        <div className="panel">
                            <div className="panel-head">
                                <span className="panel-head-title">{activeSite.site_name}（{activeSite.site_id}）</span>
                                {activeSite.is_active ? <Badge tone="success">稼働中</Badge> : <Badge tone="danger">停止中</Badge>}
                            </div>

                            <div style={{ padding: '10px 16px 0' }}>
                                <div className="tab-bar" style={{ marginBottom: 0 }}>
                                    <button className={`tab-item ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>一般設定</button>
                                    <button className={`tab-item ${tab === 'llm' ? 'active' : ''}`} onClick={() => setTab('llm')}>LLM設定</button>
                                    <button className={`tab-item ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>チャット外観</button>
                                </div>
                            </div>

                            <div className="panel-body">
                                {formError && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{formError}</div>}
                                {savedMsg && <div className="banner banner-success" style={{ marginBottom: 14 }}>{savedMsg}</div>}

                                {tab === 'general' && (
                                    <div style={{ maxWidth: 460 }}>
                                        <div className="field">
                                            <label className="field-label">サイト名</label>
                                            <input className="field-input" value={form.site_name} onChange={e => setForm({ ...form, site_name: e.target.value })} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">問い合わせURL（AIが回答できない時に案内）</label>
                                            <input className="field-input" value={form.contact_url} onChange={e => setForm({ ...form, contact_url: e.target.value })} placeholder="https://example.com/contact/" />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">ホームページURL</label>
                                            <input className="field-input" value={form.home_url} onChange={e => setForm({ ...form, home_url: e.target.value })} placeholder="https://example.com/" />
                                        </div>
                                        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <label className="switch">
                                                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                                                <span className="switch-track" />
                                                <span className="switch-thumb" />
                                            </label>
                                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{form.is_active ? '稼働中（ウィジェット表示）' : '停止中（ウィジェット非表示）'}</span>
                                        </div>
                                    </div>
                                )}

                                {tab === 'llm' && (
                                    <div style={{ maxWidth: 520 }}>
                                        <p className="panel-description">Ollamaを使用し、日本語で回答します。</p>
                                        <div className="field">
                                            <label className="field-label">AIモデル</label>
                                            {modelsError && (
                                                <div className="banner banner-danger" style={{ marginBottom: 8, fontSize: 11 }}>
                                                    {modelsError}
                                                    <button className="btn btn-ghost btn-sm" onClick={fetchOllamaModels} style={{ marginLeft: 4 }}><IconRefresh size={11} /> 再試行</button>
                                                </div>
                                            )}
                                            {!useManualModel ? (
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <select className="field-select" value={form.ai_model}
                                                        onChange={e => setForm({ ...form, ai_model: e.target.value })}
                                                        disabled={modelsLoading || ollamaModels.length === 0}>
                                                        {ollamaModels.length === 0 && <option value={form.ai_model}>{form.ai_model}</option>}
                                                        {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                    <button className="btn btn-secondary btn-sm" onClick={fetchOllamaModels} disabled={modelsLoading}><IconRefresh size={12} /></button>
                                                </div>
                                            ) : (
                                                <input className="field-input" value={form.ai_model} onChange={e => setForm({ ...form, ai_model: e.target.value })} placeholder="gemma3:4b" />
                                            )}
                                            <div className="field-hint">
                                                <button className="btn-link" onClick={() => setUseManualModel(v => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--navy-600)', cursor: 'pointer', fontSize: 11 }}>
                                                    {useManualModel ? '一覧から選択する' : 'モデル名を直接入力する'}
                                                </button>
                                                ※一覧はOllamaに実際にpull済みのモデルのみ表示されます。
                                            </div>
                                        </div>
                                        <div className="field">
                                            <label className="field-label">サイト独自ルール（任意）</label>
                                            <textarea className="field-textarea" style={{ height: 90 }} maxLength={2000}
                                                value={form.custom_prompt_rules}
                                                onChange={e => setForm({ ...form, custom_prompt_rules: e.target.value })}
                                                placeholder="例：常に「AIアシスタント」と名乗ってください。競合他社名には言及しないでください。" />
                                            <div className="field-hint">
                                                共通の回答ルールに加えて適用する、このサイト専用の追加ルールです。（{form.custom_prompt_rules.length}/2000文字）
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {tab === 'chat' && (
                                    <div style={{ maxWidth: 460 }}>
                                        <div className="field">
                                            <label className="field-label">テーマカラー</label>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input type="color" value={form.theme_color} onChange={e => setForm({ ...form, theme_color: e.target.value })} style={{ width: 44, height: 34, padding: 2, border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                                                <input className="field-input" value={form.theme_color} onChange={e => setForm({ ...form, theme_color: e.target.value })} placeholder="#1B2C4B" style={{ maxWidth: 140 }} />
                                            </div>
                                        </div>
                                        <div className="field">
                                            <label className="field-label">アバター画像URL（任意）</label>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                {form.avatar_url && (
                                                    <img src={form.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                                                )}
                                                <input className="field-input" value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://example.com/avatar.png" />
                                            </div>
                                            <div className="field-hint">未入力の場合はデフォルトのAIアイコンが表示されます。</div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: 18 }}>
                                    <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? '保存中…' : '保存する'}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
