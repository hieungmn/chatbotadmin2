-- FAQ Hub Chatbot: complete schema for a NEW, EMPTY database.
-- Run the entire file in pgAdmin Query Tool, connected to the intended database.
-- Includes all tables, extensions, sample sites and the initial admin account.
-- Initial application login: admin / 123456. Change it before public use.
-- For initial installation only; does not reset or upgrade an existing database.

BEGIN;
SET search_path TO public;

-- ==========================================
-- 拡張機能の有効化
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;


-- updated_at を自動更新する共通関数
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ==========================================
-- 1. 管理者・スタッフアカウント
-- ==========================================
CREATE TABLE public.admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    -- Password changes invalidate previously issued account tokens.
    password_version INTEGER NOT NULL DEFAULT 0 CHECK (password_version >= 0),
    full_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'staff', -- 'admin' または 'staff'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. サイト情報（チャットボット導入先の各サイト）
-- ==========================================
CREATE TABLE public.sites (
    site_id VARCHAR(50) PRIMARY KEY,
    site_name VARCHAR(100) NOT NULL,
    contact_url TEXT NOT NULL,        -- AIが回答できない場合に案内する問い合わせ先
    home_url TEXT,                    -- 低評価フィードバック時に案内するトップページ
    theme_color VARCHAR(7) NOT NULL DEFAULT '#1B2C4F',
    ai_model VARCHAR(100) NOT NULL DEFAULT 'gemma3:4b',
    custom_prompt_rules TEXT,         -- サイト独自のAI回答ルール（共通ルールに追加で適用）
    avatar_url TEXT,                  -- チャットウィジェットのアバター画像
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 4. スタッフごとのサイト権限
-- ==========================================
CREATE TABLE public.user_site_permissions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    granted_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_site UNIQUE (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_usp_user ON public.user_site_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_usp_site ON public.user_site_permissions(site_id);

-- ==========================================
-- 5. スタッフの操作ログ
-- ==========================================
CREATE TABLE public.user_action_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_user ON public.user_action_logs(user_id);

-- ==========================================
-- 6. FAQ一括アップロードのロット単位
--    （1回のExcelアップロード = 1ロット。ロット削除で配下のFAQも連動削除）
-- ==========================================
CREATE TABLE public.faq_import_batches (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    uploaded_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'pending', 'rejected')),
    reviewed_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faq_batch_site ON public.faq_import_batches(site_id);
CREATE INDEX IF NOT EXISTS idx_faq_batch_status ON public.faq_import_batches(approval_status);

-- ==========================================
-- 7. FAQ本体
--    チャットボットは approval_status='approved' かつ is_draft=false の
--    FAQのみを回答に使用する。
-- ==========================================
CREATE TABLE public.faq_master (
    id SERIAL PRIMARY KEY,
    data_id VARCHAR(50) NOT NULL,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    import_batch_id INT REFERENCES public.faq_import_batches(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL DEFAULT '一般',
    keywords TEXT NOT NULL DEFAULT '',
    question TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    redirect_url TEXT DEFAULT NULL,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'pending', 'rejected')),
    created_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    reviewed_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    embedding vector(768), -- 意味検索（Tier 3）用のベクトル
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_faq_site_data UNIQUE (site_id, data_id)
);
CREATE INDEX IF NOT EXISTS idx_faq_site ON public.faq_master(site_id);
CREATE INDEX IF NOT EXISTS idx_faq_publish ON public.faq_master(site_id, is_draft, approval_status);
CREATE INDEX IF NOT EXISTS idx_faq_batch ON public.faq_master(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_faq_status ON public.faq_master(approval_status);
CREATE INDEX IF NOT EXISTS idx_faq_keywords_trgm ON public.faq_master USING gin (keywords gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faq_embedding_hnsw ON public.faq_master USING hnsw (embedding vector_cosine_ops);

-- ==========================================
-- 8 FAQ画像（1FAQにつき複数枚可、上限はアプリ側で5枚に制御）
-- ==========================================
CREATE TABLE public.faq_images (
    id SERIAL PRIMARY KEY,
    faq_id INT NOT NULL REFERENCES public.faq_master(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faq_images_faq ON public.faq_images(faq_id);

-- ==========================================
-- 9. AIナレッジ元ファイル（Word/Excel/PDF/テキスト）
-- ==========================================
CREATE TABLE public.site_knowledge_files (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('word', 'excel', 'pdf', 'txt')),
    file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- アップロード結果：completed/failed
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'pending', 'rejected')),
    reviewed_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    uploaded_by INT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skf_site ON public.site_knowledge_files(site_id);
CREATE INDEX IF NOT EXISTS idx_skf_status ON public.site_knowledge_files(approval_status);

-- ==========================================
-- 10. AIナレッジ本文（チャンク単位に分割済み）
-- ==========================================
CREATE TABLE public.site_knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    file_id INT NOT NULL REFERENCES public.site_knowledge_files(id) ON DELETE CASCADE,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    content_text TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    chunk_index INT NOT NULL DEFAULT 0,
    section_id TEXT,
    section_title TEXT,
    page_number INT,
    sheet_name TEXT,
    row_number INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_chunk_index_nonnegative CHECK (chunk_index >= 0),
    CONSTRAINT knowledge_file_chunk_index_unique UNIQUE (file_id, chunk_index) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_skc_file ON public.site_knowledge_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_skc_site ON public.site_knowledge_chunks(site_id);
CREATE INDEX IF NOT EXISTS idx_skc_site_file ON public.site_knowledge_chunks(site_id, file_id);
CREATE INDEX IF NOT EXISTS idx_skc_embedding_hnsw
ON public.site_knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_text_trgm ON public.site_knowledge_chunks USING gin (lower(content_text) gin_trgm_ops);
CREATE INDEX idx_faq_question_trgm ON public.faq_master USING gin (lower(question) gin_trgm_ops);

-- ==========================================
-- 11. チャットセッション（訪問者ごとの会話単位）
-- ==========================================
CREATE TABLE public.chat_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_site ON public.chat_sessions(site_id);

-- ==========================================
-- 12 チャットメッセージ本文（ユーザー・AI双方）
-- ==========================================
CREATE TABLE public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    images TEXT[], -- この回答に添付された画像（FAQ画像）。履歴復元時も画像を保持するため保存
    model_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time ON public.chat_messages(session_id, created_at);

-- ==========================================
-- 13 検索・回答ログ（分析画面のデータ元）
-- ==========================================
CREATE TABLE public.search_logs (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE,
    site_id VARCHAR(50) NOT NULL REFERENCES public.sites(site_id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    matched_faq_id INT REFERENCES public.faq_master(id) ON DELETE SET NULL,
    response_source VARCHAR(20) DEFAULT 'faq'
        CHECK (response_source IN ('faq', 'ai', 'escalated', 'fallback')),
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_session ON public.search_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_site ON public.search_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_faq ON public.search_logs(matched_faq_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_time ON public.search_logs(searched_at DESC);


-- ==========================================
-- updated_at 自動更新トリガー
-- ==========================================
CREATE TRIGGER trg_admin_users_updated BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_faq_master_updated BEFORE UPDATE ON public.faq_master FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_knowledge_files_updated BEFORE UPDATE ON public.site_knowledge_files FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ==========================================
-- 初期データ（サイト・管理者アカウント）
-- ==========================================
INSERT INTO public.sites (site_id, site_name, contact_url, home_url, theme_color, avatar_url) VALUES
('s-wing', 'S-Wing 学園システム', 'https://s-wing.net/inquiry/', 'https://s-wing.net/', '#2FA98C', 'https://static.vecteezy.com/system/resources/previews/037/393/224/large_2x/robot-chat-icon-vector.jpg'),
('c-wing', 'C-Wing Community', 'https://jukou-kanri.jp/contact/', 'https://jukou-kanri.jp/', '#1A5276', 'https://as2.ftcdn.net/jpg/05/65/06/85/1000_F_565068547_fAfynS8cesC9kIxtDb7OzoXr0t33sNpC.jpg'),
('cansuke', 'Cansuke Support', 'https://cansuke.net/contact/', 'https://cansuke.net/', '#E67E22', 'https://static.vecteezy.com/system/resources/previews/037/393/224/large_2x/robot-chat-icon-vector.jpg'),
('account-business', 'Account Business', 'https://account-business.jp/contact/', 'https://anabuki-cs.jp/service/', '#27AE60', 'https://static.vecteezy.com/system/resources/previews/041/922/887/non_2x/virtual-virtual-assistance-icon-illustration-vector.jpg')
ON CONFLICT (site_id) DO NOTHING;

-- Initial admin password: 123456. Hash generated with the backend bcrypt library.
-- Existing accounts are never overwritten.
INSERT INTO public.admin_users (username, password_hash, full_name, role, is_active)
VALUES ('admin', '$2b$10$GZ8X8WbL9RCxNbBsVjO8euAFwtTryHq0jlmKlkNsCrRDS4WZcx3qe', 'Administrator', 'admin', TRUE)
ON CONFLICT (username) DO NOTHING;

COMMIT;

