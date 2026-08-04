import { Request, Response } from 'express';
import pool from '../../config/db';

/**
 * ==========================================
 * 11. 全サイト一覧の取得（管理者用）
 * ==========================================
 */
export const getSites = async (_req: Request, res: Response) => {
    try {
        const resDb = await pool.query('SELECT * FROM public.sites ORDER BY site_id ASC');
        return res.json({ success: true, sites: resDb.rows });
    } catch (error) {
        console.error("❌ サイト一覧取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 11.1 現在のユーザーが操作可能なサイト一覧の取得
 * ==========================================
 */
export const getMySites = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ success: false, message: "認証されていません。" });
        }

        if (user.role === 'admin') {
            const resDb = await pool.query('SELECT site_id, site_name, contact_url, home_url, theme_color, ai_model, custom_prompt_rules, avatar_url, is_active FROM public.sites ORDER BY site_id ASC');
            return res.json({ success: true, sites: resDb.rows });
        }

        const resDb = await pool.query(
            `SELECT s.site_id, s.site_name, s.contact_url, s.home_url, s.theme_color, s.ai_model, s.custom_prompt_rules, s.avatar_url, s.is_active
             FROM public.sites s
             INNER JOIN public.user_site_permissions p ON p.site_id = s.site_id
             WHERE p.user_id = $1
             ORDER BY s.site_id ASC`,
            [user.id]
        );
        return res.json({ success: true, sites: resDb.rows });
    } catch (error) {
        console.error("❌ 担当サイト一覧取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 15.サイト公開情報の取得（埋め込みウィジェット用、ログイン不要）
 * ==========================================
 */
export const getPublicSiteInfo = async (req: Request, res: Response) => {
    try {
        const siteId = String(req.params.siteId || '').trim().toLowerCase();
        const resDb = await pool.query(
            'SELECT site_id, site_name, contact_url, home_url, theme_color, avatar_url, is_active FROM public.sites WHERE site_id = $1',
            [siteId]
        );

        if (resDb.rows.length === 0 || !resDb.rows[0].is_active) {
            return res.status(404).json({ success: false, message: "サイトが存在しないか、停止しています。" });
        }

        return res.json({ success: true, site: resDb.rows[0] });
    } catch (error) {
        console.error("❌ サイト公開情報取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 16.サイト情報の更新（管理者のみ）
 *     表示名、問い合わせ先/ページURL、ウィジェットのテーマカラーなどを
 *     DBを直接操作せず変更できる。
 * ==========================================
 */
export const updateSite = async (req: Request, res: Response) => {
    try {
        const { siteId } = req.params;
        const { site_name, contact_url, home_url, theme_color, ai_model, custom_prompt_rules, avatar_url, is_active } = req.body;

        if (theme_color && !/^#[0-9A-Fa-f]{6}$/.test(theme_color)) {
            return res.status(400).json({ success: false, message: "テーマカラーは #RRGGBB 形式で入力してください。" });
        }
        if (custom_prompt_rules && custom_prompt_rules.length > 2000) {
            return res.status(400).json({ success: false, message: "カスタムルールは2000文字以内で入力してください。" });
        }

        const resDb = await pool.query(`
            UPDATE public.sites
            SET site_name = COALESCE($1, site_name),
                contact_url = COALESCE($2, contact_url),
                home_url = COALESCE($3, home_url),
                theme_color = COALESCE($4, theme_color),
                ai_model = COALESCE($5, ai_model),
                custom_prompt_rules = COALESCE($6, custom_prompt_rules),
                avatar_url = COALESCE($7, avatar_url),
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE site_id = $9
            RETURNING site_id, site_name, contact_url, home_url, theme_color, ai_model, custom_prompt_rules, avatar_url, is_active
        `, [site_name, contact_url, home_url, theme_color, ai_model, custom_prompt_rules, avatar_url, is_active, siteId]);

        if (resDb.rows.length === 0) {
            return res.status(404).json({ success: false, message: "サイトが見つかりません。" });
        }

        return res.json({ success: true, site: resDb.rows[0], message: "サイト情報を更新しました。" });
    } catch (error) {
        console.error("❌ サイト情報更新でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 20. Ollamaにインストール済みのAIモデル一覧（LLM設定のドロップダウン用）
 *     OllamaのGET /api/tagsを直接呼び出す — 無料で、モデルの存在確認のために
 *     文章生成する必要がない。
 * ==========================================
 */
export const getAvailableAiModels = async (_req: Request, res: Response) => {
    try {
        const { ENV } = await import('../../config/env');
        const response = await fetch(`${ENV.OLLAMA_URL}/api/tags`);

        if (!response.ok) {
            return res.status(502).json({
                success: false,
                message: 'Ollamaサーバーに接続できませんでした。サーバーが起動しているか確認してください。',
            });
        }

        const data = await response.json() as { models?: { name: string }[] };
        const models = (data.models || []).map(m => m.name);

        return res.json({ success: true, models });
    } catch (error) {
        console.error("❌ Ollamaモデル一覧取得でエラー:", error);
        return res.status(502).json({
            success: false,
            message: 'Ollamaサーバーに接続できませんでした。サーバーが起動しているか確認してください。',
            models: [],
        });
    }
};
