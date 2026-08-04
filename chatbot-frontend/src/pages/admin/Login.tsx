import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { IconBrain, IconDoc, IconMessage, IconShield } from '../../components/icons';

export default function Login() {
    const navigate = useNavigate();
    const { login: setAuth } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setLoading(true);
        try {
            const data = await login(username, password);
            if (data.success) {
                setAuth(data.token, data.username, data.role, data.full_name);
                navigate('/admin/faq');
            } else setError(data.message || 'ログインに失敗しました。');
        } catch (failure: any) {
            setError(failure.response?.data?.message || 'サーバーに接続できませんでした。');
        } finally { setLoading(false); }
    };

    return (
        <div className="login-shell">
            <section className="login-story" aria-label="FAQ HUBについて">
                <div className="workspace-brand">
                    <span className="brand-symbol" aria-hidden="true"><IconBrain size={22} /></span>
                    <span className="brand-copy"><strong>FAQ HUB</strong><span>AI MANAGEMENT</span></span>
                </div>
                <div className="login-story-content">
                    <div className="page-eyebrow">KNOWLEDGE. ANSWERS. INSIGHTS.</div>
                    <h2>知識をつなぐ。<br />回答を、もっと確かに。</h2>
                    <p>FAQとナレッジを、一つのワークスペースに。<br />文書の管理から回答の評価まで、<br />日々のサポートを見渡せます。</p>
                    <div className="login-flow" aria-label="ナレッジをもとにAIが回答する流れ">
                        <div className="login-flow-card"><IconDoc size={24} />ナレッジ</div>
                        <span aria-hidden="true">→</span>
                        <div className="login-flow-card is-featured"><IconBrain size={28} />AI</div>
                        <span aria-hidden="true">→</span>
                        <div className="login-flow-card"><IconMessage size={24} />回答</div>
                    </div>
                </div>
                <div className="login-story-footer"><IconShield size={15} />社内専用の管理ワークスペース</div>
            </section>
            <main className="login-form-region">
                <div className="login-form-card">
                    <div className="page-eyebrow">ADMIN CONSOLE</div>
                    <h1>ログイン</h1>
                    <p>アカウントで管理画面にログインしてください。</p>
                    {error && <div className="banner banner-danger" role="alert" style={{ marginBottom: 20 }}>{error}</div>}
                    <form onSubmit={handleLogin} aria-busy={loading}>
                        <div className="field">
                            <label className="field-label" htmlFor="login-username">ユーザー名</label>
                            <input id="login-username" className="field-input" type="text" autoComplete="username"
                                value={username} onChange={event => setUsername(event.target.value)} placeholder="ユーザー名を入力" autoFocus required disabled={loading} />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="login-password">パスワード</label>
                            <div className="login-password">
                                <input id="login-password" className="field-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                                    value={password} onChange={event => setPassword(event.target.value)} placeholder="パスワードを入力" required disabled={loading} />
                                <button type="button" aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'} aria-pressed={showPassword}
                                    onClick={() => setShowPassword(show => !show)}>{showPassword ? '隠す' : '表示'}</button>
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="btn btn-primary login-submit">{loading ? '確認中…' : 'ログイン'}</button>
                    </form>
                    <div className="login-note">アクセスには管理者から発行されたアカウントが必要です。</div>
                </div>
            </main>
        </div>
    );
}
