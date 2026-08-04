erDiagram
    admin_users {
        int id PK
        varchar(50) username UK
        varchar(255) password_hash
        int password_version
        varchar(100) full_name
        varchar(50) role
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    sites {
        varchar(50) site_id PK
        varchar(100) site_name
        text contact_url
        text home_url
        varchar(7) theme_color
        varchar(100) ai_model
        text custom_prompt_rules
        text avatar_url
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    user_site_permissions {
        int id PK
        int user_id FK
        varchar(50) site_id FK
        int granted_by FK
        timestamptz created_at
    }
    user_action_logs {
        bigint id PK
        int user_id FK
        varchar(50) action_type
        text details
        timestamptz created_at
    }
    faq_import_batches {
        int id PK
        varchar(50) site_id FK
        varchar(255) file_name
        int row_count
        int skipped_count
        int uploaded_by FK
        varchar(20) approval_status
        int reviewed_by FK
        timestamptz reviewed_at
        timestamptz created_at
    }
    faq_master {
        int id PK
        varchar(50) data_id
        varchar(50) site_id FK
        int import_batch_id FK
        varchar(100) category
        text keywords
        text question
        text answer_text
        text redirect_url
        boolean is_draft
        varchar(20) approval_status
        int created_by FK
        int reviewed_by FK
        timestamptz reviewed_at
        vector(768) embedding
        timestamptz created_at
        timestamptz updated_at
    }
    faq_images {
        int id PK
        int faq_id FK
        text image_path
        int display_order
        timestamptz created_at
    }
    site_knowledge_files {
        int id PK
        varchar(50) site_id FK
        varchar(255) file_name
        varchar(50) file_type
        text file_path
        varchar(20) status
        varchar(20) approval_status
        int reviewed_by FK
        timestamptz reviewed_at
        int uploaded_by FK
        text error_message
        timestamptz created_at
        timestamptz updated_at
    }
    site_knowledge_chunks {
        bigint id PK
        int file_id FK
        varchar(50) site_id FK
        text content_text
        vector(768) embedding
        int chunk_index
        text section_id
        text section_title
        int page_number
        text sheet_name
        int row_number
        timestamptz created_at
    }
    chat_sessions {
        varchar(100) session_id PK
        varchar(50) site_id FK
        varchar(45) ip_address
        text user_agent
        timestamptz created_at
        timestamptz last_active_at
    }
    chat_messages {
        bigint id PK
        varchar(100) session_id FK
        varchar(20) role
        text content
        text[] images
        varchar(100) model_name
        timestamptz created_at
    }
    search_logs {
        bigint id PK
        varchar(100) session_id FK
        varchar(50) site_id FK
        text query_text
        int matched_faq_id FK
        varchar(20) response_source
        timestamptz searched_at
    }
    admin_users ||--o{ user_site_permissions : "id -> user_id"
    sites ||--o{ user_site_permissions : "site_id -> site_id"
    admin_users |o--o{ user_site_permissions : "id -> granted_by"
    admin_users ||--o{ user_action_logs : "id -> user_id"
    sites ||--o{ faq_import_batches : "site_id -> site_id"
    admin_users |o--o{ faq_import_batches : "id -> uploaded_by"
    admin_users |o--o{ faq_import_batches : "id -> reviewed_by"
    sites ||--o{ faq_master : "site_id -> site_id"
    faq_import_batches |o--o{ faq_master : "id -> import_batch_id"
    admin_users |o--o{ faq_master : "id -> created_by"
    admin_users |o--o{ faq_master : "id -> reviewed_by"
    faq_master ||--o{ faq_images : "id -> faq_id"
    sites ||--o{ site_knowledge_files : "site_id -> site_id"
    admin_users |o--o{ site_knowledge_files : "id -> reviewed_by"
    admin_users |o--o{ site_knowledge_files : "id -> uploaded_by"
    site_knowledge_files ||--o{ site_knowledge_chunks : "id -> file_id"
    sites ||--o{ site_knowledge_chunks : "site_id -> site_id"
    sites ||--o{ chat_sessions : "site_id -> site_id"
    chat_sessions ||--o{ chat_messages : "session_id -> session_id"
    chat_sessions ||--o{ search_logs : "session_id -> session_id"
    sites ||--o{ search_logs : "site_id -> site_id"
    faq_master |o--o{ search_logs : "id -> matched_faq_id"
