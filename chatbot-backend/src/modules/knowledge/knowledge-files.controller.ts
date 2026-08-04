import { Request, Response } from "express";
import fs from "fs";
import pool from "../../config/db";

/**
 * ==========================================
 * 2. アップロード済みナレッジファイル一覧の取得
 * ==========================================
 */
export const getKnowledgeFiles = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const explicitSiteId = req.query.site_id ? String(req.query.site_id).trim().toLowerCase() : null;
        const allowedSiteIds = (req as any).allowedSiteIds as string[] | undefined;

        const conditions: string[] = [];
        const params: any[] = [];

        if (explicitSiteId) {
            if (user && user.role !== 'admin') {
                const permCheck = await pool.query(
                    'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
                    [user.id, explicitSiteId]
                );
                if (permCheck.rows.length === 0) {
                    return res.status(403).json({ success: false, message: `サイト [${explicitSiteId}] のデータを閲覧する権限がありません。` });
                }
            }
            conditions.push(`f.site_id = $${params.length + 1}`);
            params.push(explicitSiteId);
        } else if (user && user.role !== 'admin') {
            if (allowedSiteIds && allowedSiteIds.length > 0) {
                conditions.push(`f.site_id = ANY($${params.length + 1})`);
                params.push(allowedSiteIds);
            } else {
                return res.json({ success: true, files: [] });
            }
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const resDb = await pool.query(`
            SELECT
                f.id, f.site_id, f.file_name, f.file_type, f.status, f.approval_status, f.error_message,
                f.uploaded_by, u.username AS uploaded_by_username,
                r.username AS reviewed_by_username, f.reviewed_at,
                f.created_at, f.updated_at,
                COUNT(c.id) AS chunk_count
            FROM public.site_knowledge_files f
            LEFT JOIN public.site_knowledge_chunks c ON c.file_id = f.id
            LEFT JOIN public.admin_users u ON u.id = f.uploaded_by
            LEFT JOIN public.admin_users r ON r.id = f.reviewed_by
            ${whereClause}
            GROUP BY f.id, u.username, r.username
            ORDER BY f.created_at DESC
        `, params);

        return res.json({ success: true, files: resDb.rows });
    } catch (error) {
        console.error("❌ ナレッジファイル一覧の取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 3. ナレッジファイルの承認／却下（管理者のみ）
 * ==========================================
 */
export const reviewKnowledgeFile = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { id } = req.params;
        const { approve } = (req.body || {}) as { approve?: boolean };
        if (typeof approve !== 'boolean') {
            return res.status(400).json({ success: false, message: 'approve は真偽値を指定してください。' });
        }
        const newStatus = approve ? 'approved' : 'rejected';

        const resDb = await pool.query(
            "UPDATE public.site_knowledge_files SET approval_status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 AND status = 'completed' RETURNING id",
            [newStatus, user.id, id]
        );

        if (resDb.rows.length === 0) {
            const existing = await pool.query('SELECT status FROM public.site_knowledge_files WHERE id = $1', [id]);
            if (existing.rows.length) return res.status(409).json({ success: false, message: '処理が完了したファイルのみ承認できます。' });
            return res.status(404).json({ success: false, message: "対象のファイルが見つかりません。" });
        }

        return res.json({ success: true, message: approve ? "承認しました。" : "却下しました。" });
    } catch (error) {
        console.error("❌ ナレッジファイル承認処理でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 6. 学習済みチャンク内容の確認（管理者・スタッフ向け）
 *    データベースを直接見なくても、AIが実際に学習した内容を確認できる。
 * ==========================================
 */
export const getKnowledgeFileChunks = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { id } = req.params;

        const fileRes = await pool.query('SELECT site_id, file_name FROM public.site_knowledge_files WHERE id = $1', [id]);
        if (fileRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "ファイルが見つかりません。" });
        }

        if (user && user.role !== 'admin') {
            const permCheck = await pool.query(
                'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
                [user.id, fileRes.rows[0].site_id]
            );
            if (permCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: `サイト [${fileRes.rows[0].site_id}] のデータを閲覧する権限がありません。` });
            }
        }

        const chunksRes = await pool.query(
            `SELECT id, content_text, chunk_index, section_id, section_title, page_number, sheet_name, row_number
             FROM public.site_knowledge_chunks WHERE file_id = $1 ORDER BY chunk_index ASC, id ASC`,
            [id]
        );

        return res.json({ success: true, file_name: fileRes.rows[0].file_name, chunks: chunksRes.rows });
    } catch (error) {
        console.error("❌ チャンク内容の取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 7. ナレッジファイルの削除（配下のチャンクも連動削除）
 * ==========================================
 */
export const deleteKnowledgeFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        const fileRes = await pool.query(
            'SELECT id, site_id, file_path FROM public.site_knowledge_files WHERE id = $1',
            [id]
        );

        if (fileRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "ファイルが見つかりません。" });
        }

        const file = fileRes.rows[0];

        if (user && user.role !== 'admin') {
            const permCheck = await pool.query(
                'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
                [user.id, file.site_id]
            );
            if (permCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: `サイト [${file.site_id}] のデータを削除する権限がありません。` });
            }
        }

        await pool.query('DELETE FROM public.site_knowledge_files WHERE id = $1', [id]);

        try {
            if (file.file_path && fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path);
            }
        } catch (fsErr) {
            console.warn("⚠️ 物理ファイルの削除に失敗（DBデータには影響なし）:", fsErr);
        }

        return res.json({ success: true, message: "ナレッジファイルと関連データを削除しました。" });
    } catch (error) {
        console.error("❌ ナレッジファイル削除でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};
