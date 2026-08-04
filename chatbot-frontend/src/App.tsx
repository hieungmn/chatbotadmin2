import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import AdminLayout from './layouts/AdminLayout';

const Login = lazy(() => import('./pages/admin/Login'));
const FaqManager = lazy(() => import('./pages/admin/FaqManager'));
const FaqUpload = lazy(() => import('./pages/admin/FaqUpload'));
const KnowledgeUpload = lazy(() => import('./pages/admin/KnowledgeUpload'));
const ManageSites = lazy(() => import('./pages/admin/ManageSites'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const WidgetPreview = lazy(() => import('./pages/admin/WidgetPreview'));

function PageLoading() {
    return <div className="page" role="status" aria-live="polite">読み込み中…</div>;
}

function AccessDenied() {
    return (
        <div className="page">
            <div className="panel" style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>アクセス権限がありません</div>
                <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    このページは管理者（admin）のみ閲覧できます。
                </p>
            </div>
        </div>
    );
}

function ProtectedAdminRoute({
    children, adminOnly = false,
}: { children: React.ReactNode; adminOnly?: boolean }) {
    const { isAuthenticated, role } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace />;
    }

    const denied = adminOnly && role !== 'admin';

    return (
        <SiteProvider>
            <AdminLayout>
                <Suspense fallback={<PageLoading />}>
                    {denied ? <AccessDenied /> : children}
                </Suspense>
            </AdminLayout>
        </SiteProvider>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/admin/faq" replace />} />
            <Route path="/admin/login" element={<Login />} />

            <Route path="/admin/analytics" element={<Navigate to="/admin/faq" replace />} />
            <Route path="/admin/faq" element={<ProtectedAdminRoute><FaqManager /></ProtectedAdminRoute>} />
            <Route path="/admin/faq/upload" element={<ProtectedAdminRoute><FaqUpload /></ProtectedAdminRoute>} />
            <Route path="/admin/knowledge/upload" element={<ProtectedAdminRoute><KnowledgeUpload /></ProtectedAdminRoute>} />
            <Route path="/admin/sites" element={<ProtectedAdminRoute adminOnly><ManageSites /></ProtectedAdminRoute>} />
            <Route path="/admin/users" element={<ProtectedAdminRoute adminOnly><ManageUsers /></ProtectedAdminRoute>} />
            <Route path="/admin/widget-preview" element={<ProtectedAdminRoute><WidgetPreview /></ProtectedAdminRoute>} />

            <Route path="*" element={
                <div style={{ padding: 60, textAlign: 'center', fontFamily: 'var(--font-ui)' }}>
                    <h2 style={{ color: 'var(--text-primary)' }}>404 — ページが見つかりません</h2>
                    <a href="/admin/faq" style={{ color: 'var(--info)', fontWeight: 600 }}>FAQ管理へ戻る →</a>
                </div>
            } />
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Suspense fallback={<PageLoading />}>
                    <AppRoutes />
                </Suspense>
            </Router>
        </AuthProvider>
    );
}
