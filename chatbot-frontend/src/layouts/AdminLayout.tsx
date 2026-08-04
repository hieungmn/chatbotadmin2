import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { IconDoc, IconUpload, IconBrain, IconGlobe, IconUsers,
    IconLogout, IconChevronDown, IconMessage, IconShield, IconMenu, IconClose } from '../components/icons';

interface NavItem { to: string; label: string; icon: React.ComponentType<{ size?: number }>; adminOnly?: boolean; }
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    { label: 'ナレッジ', items: [
        { to: '/admin/faq', label: 'FAQ管理', icon: IconDoc },
        { to: '/admin/faq/upload', label: 'FAQ一括取込', icon: IconUpload },
        { to: '/admin/knowledge/upload', label: 'AIナレッジ', icon: IconBrain },
    ] },
    { label: 'プレビュー', items: [{ to: '/admin/widget-preview', label: 'ウィジェット確認', icon: IconMessage }] },
    { label: 'ワークスペース管理', items: [
        { to: '/admin/sites', label: 'サイト管理', icon: IconGlobe, adminOnly: true },
        { to: '/admin/users', label: 'ユーザー管理', icon: IconUsers, adminOnly: true },
    ] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { username, fullName, role, logout } = useAuth();
    const { sites, selectedSiteId, setSelectedSiteId, loading: sitesLoading, hasNoSites } = useSite();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
    const menuRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const mainRef = useRef<HTMLDivElement>(null);
    const currentItem = NAV_GROUPS.flatMap(group => group.items).find(item => item.to === location.pathname);
    const currentSite = sites.find(site => site.site_id === selectedSiteId);

    useEffect(() => { setMobileOpen(false); setUserMenuOpen(false); }, [location.pathname]);
    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setUserMenuOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
    }, []);
    useEffect(() => {
        const viewport = window.matchMedia('(max-width: 900px)');
        const onResize = () => { if (!viewport.matches) setMobileOpen(false); };
        viewport.addEventListener('change', onResize);
        return () => viewport.removeEventListener('change', onResize);
    }, []);
    useEffect(() => {
        if (!mobileOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        const main = mainRef.current;
        document.body.style.overflow = 'hidden';
        if (main) main.inert = true;
        const controls = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') || [])
            .filter(element => element.getClientRects().length > 0);
        controls()[0]?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
            if (event.key !== 'Tab') return;
            const items = controls();
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
            if (main) main.inert = false;
            previouslyFocused?.focus();
        };
    }, [mobileOpen]);
    const toggleCollapsed = () => setCollapsed(previous => {
        localStorage.setItem('sidebar_collapsed', String(!previous));
        return !previous;
    });

    return (
        <div className={`app-shell${collapsed ? ' sidebar-is-collapsed' : ''}${mobileOpen ? ' mobile-nav-open' : ''}`}>
            <a className="skip-link" href="#admin-content">メインコンテンツへ</a>
            {mobileOpen && <button className="nav-backdrop" aria-label="メニューを閉じる" tabIndex={-1} onClick={() => setMobileOpen(false)} />}
            <aside ref={sidebarRef} className="admin-sidebar" id="admin-navigation"
                aria-label="管理メニュー" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined}>
                <Link className="workspace-brand" to="/admin/faq" aria-label="FAQ HUB ホーム">
                    <span className="brand-symbol" aria-hidden="true"><IconBrain size={22} /></span>
                    <span className="brand-copy"><strong>FAQ HUB</strong><span>AI MANAGEMENT</span></span>
                </Link>
                <button className="mobile-nav-close btn btn-ghost" aria-label="メニューを閉じる" onClick={() => setMobileOpen(false)}><IconClose size={20} /></button>
                <div className="sidebar-workspace">
                    <span className="workspace-icon"><IconGlobe size={17} /></span>
                    <div><strong>{currentSite?.site_name || 'ワークスペース'}</strong><span>{currentSite?.site_id || 'サイトを選択'}</span></div>
                </div>
                <nav className="sidebar-nav" aria-label="ページ">
                    {NAV_GROUPS.map(group => {
                        const items = group.items.filter(item => !item.adminOnly || role === 'admin');
                        return items.length ? <div className="nav-group" key={group.label}>
                            <div className="nav-group-label">{group.label}</div>
                            {items.map(item => {
                                const Icon = item.icon;
                                const active = location.pathname === item.to;
                                return <Link key={item.to} to={item.to} className={`nav-link${active ? ' is-active' : ''}`}
                                    aria-current={active ? 'page' : undefined} title={item.label}>
                                    <Icon size={18} /><span>{item.label}</span>
                                    {active && <span className="nav-active-dot" aria-hidden="true" />}
                                </Link>;
                            })}
                        </div> : null;
                    })}
                </nav>
                <div className="sidebar-footer">
                    <span className="sidebar-security"><IconShield size={15} /><span>社内管理ワークスペース</span></span>
                    <button className="sidebar-collapse" onClick={toggleCollapsed}
                        aria-label={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'} aria-expanded={!collapsed}>
                        <IconMenu size={17} /><span>メニューを折りたたむ</span>
                    </button>
                </div>
            </aside>
            <div className="main-col" ref={mainRef}>
                <header className="admin-topbar">
                    <div className="topbar-context">
                        <button className="mobile-nav-toggle btn btn-ghost" aria-label="管理メニューを開く"
                            aria-controls="admin-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><IconMenu size={20} /></button>
                        <div className="topbar-breadcrumb"><span>ワークスペース</span><span aria-hidden="true">/</span><strong>{currentItem?.label || '管理'}</strong></div>
                    </div>
                    <div className="topbar-actions">
                        <div className="site-switcher">
                            <label htmlFor="workspace-site"><IconGlobe size={15} /><span>対象サイト</span></label>
                            {sitesLoading ? <span className="cell-muted" role="status">読み込み中…</span>
                                : hasNoSites ? <span className="badge badge-warning">未割当</span>
                                    : <select id="workspace-site" className="field-select" value={selectedSiteId || ''} onChange={event => setSelectedSiteId(event.target.value)}>
                                        {sites.map(site => <option key={site.site_id} value={site.site_id}>{site.site_name}</option>)}
                                    </select>}
                        </div>
                        <div className="user-menu" ref={menuRef}>
                            <button onClick={() => setUserMenuOpen(open => !open)} className="user-menu-trigger"
                                aria-label="アカウントメニュー" aria-expanded={userMenuOpen} aria-haspopup="menu">
                                <span className="user-avatar">{(fullName || username || '?').charAt(0).toUpperCase()}</span>
                                <span className="user-identity"><strong>{fullName || username}</strong><span>{role === 'admin' ? '管理者' : 'スタッフ'}</span></span>
                                <IconChevronDown size={14} />
                            </button>
                            {userMenuOpen && <div className="user-dropdown" role="menu" aria-label="アカウント">
                                <button role="menuitem" onClick={() => { logout(); navigate('/admin/login'); }}><IconLogout size={16} />ログアウト</button>
                            </div>}
                        </div>
                    </div>
                </header>
                <main id="admin-content" tabIndex={-1}>{children}</main>
            </div>
        </div>
    );
}
