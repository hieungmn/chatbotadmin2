// database/migrations / バックエンドのAPIレスポンスと1対1で対応

export type Role = 'admin' | 'staff';
export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface Site {
    site_id: string;
    site_name: string;
    contact_url: string;
    home_url?: string | null;
    theme_color?: string;
    ai_model?: string;
    custom_prompt_rules?: string | null;
    avatar_url?: string | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface AdminUserAccount {
    id: number;
    username: string;
    full_name: string | null;
    role: Role;
    is_active: boolean;
    created_at: string;
}


export interface FaqImage {
    id: number;
    image_path: string;
    display_order: number;
}

export interface FaqItem {
    id: number;
    data_id: string;
    site_id: string;
    category: string;
    question: string;
    keywords: string;
    answer_text: string;
    redirect_url: string | null;
    is_draft: boolean;
    approval_status: ApprovalStatus;
    import_batch_id: number | null;
    batch_file_name?: string | null;
    batch_approval_status?: ApprovalStatus | null;
    image_count?: string | number;
    images?: FaqImage[];
    created_at: string;
    updated_at?: string;
}

// 実際のExcel列構成: data_id, site_id, category, question, keywords, answer_text, redirect_url
export interface ExcelFaqRow {
    data_id: string;
    site_id: string;
    category: string;
    question: string;
    keywords: string;
    answer_text: string;
    redirect_url: string;
    is_draft: boolean;
}

export interface FaqBatch {
    id: number;
    site_id: string;
    file_name: string;
    row_count: number;
    skipped_count: number;
    approval_status: ApprovalStatus;
    uploaded_by_username: string | null;
    reviewed_by_username: string | null;
    reviewed_at: string | null;
    created_at: string;
}

export interface KnowledgeFile {
    id: number;
    site_id: string;
    file_name: string;
    file_type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | string;
    approval_status: ApprovalStatus;
    error_message: string | null;
    uploaded_by: number | null;
    uploaded_by_username: string | null;
    reviewed_by_username: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
    chunk_count: string;
}

// ===== Chat widget =====
export interface ChatMessage {
    id: string;
    sender: 'bot' | 'user';
    text: string;
    redirect_url?: string | null;
    images?: string[];
    showFeedback?: boolean;
    feedbackGiven?: boolean;
}

export interface SuggestedTopic {
    label: string;
}
