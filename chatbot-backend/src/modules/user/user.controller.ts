import { Request, Response } from 'express';
import pool from '../../config/db';
import bcrypt from 'bcryptjs';

interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: string;
    };
}

// 1. 全アカウント一覧を取得（public.admin_users）
export const getAllAdminUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const requestUserRole = req.user?.role;

        if (!requestUserRole || requestUserRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "スタッフ権限ではアカウント一覧を閲覧できません。"
            });
        }

        const resDb = await pool.query(
            'SELECT id, username, full_name, role, is_active, created_at FROM public.admin_users ORDER BY id DESC'
        );

        return res.json({ success: true, users: resDb.rows });
    } catch (error: any) {
        console.error("❌ ユーザー一覧取得でエラー:", error);
        return res.status(500).json({ success: false, message: "アカウント一覧の取得に失敗しました。" });
    }
};

// 2. 新規アカウントの作成（管理者のみ）
export const createNewAdminUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { username, password, full_name, role } = req.body;
        const requestUserRole = req.user?.role;

        if (!requestUserRole || requestUserRole !== 'admin') {
            return res.status(403).json({ success: false, message: "この操作を行う権限がありません。" });
        }

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "ユーザー名とパスワードを入力してください。" });
        }

        if (String(password).length < 6) {
            return res.status(400).json({ success: false, message: "パスワードは6文字以上で入力してください。" });
        }

        const cleanUsername = String(username).trim().toLowerCase();

        const checkUser = await pool.query(
            'SELECT id FROM public.admin_users WHERE LOWER(username) = $1',
            [cleanUsername]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています。' });
        }

        // パスワードは平文で保存せず、必ずbcryptでハッシュ化する
        const passwordHash = await bcrypt.hash(String(password), 10);

        await pool.query(
            `INSERT INTO public.admin_users (username, password_hash, full_name, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())`,
            [cleanUsername, passwordHash, full_name || null, role || 'staff']
        );

        

        return res.status(201).json({ success: true, message: 'アカウントを作成しました。' });
    } catch (error: any) {
        console.error("❌ アカウント作成でエラー:", error);
        return res.status(500).json({ success: false, message: 'アカウント作成に失敗しました。' });
    }
};

// 3. アカウントの削除（管理者のみ）
export const deleteAdminUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const requestUserRole = req.user?.role;

        if (!requestUserRole || requestUserRole !== 'admin') {
            return res.status(403).json({ success: false, message: "この操作を行う権限がありません。" });
        }

        // 自分自身のアカウントは削除できないようにする
        if (Number(id) === req.user?.id) {
            return res.status(400).json({ success: false, message: "自分自身のアカウントは削除できません。" });
        }

        await pool.query('DELETE FROM public.admin_users WHERE id = $1', [id]);
        return res.json({ success: true, message: 'アカウントを削除しました。' });
    } catch (error: any) {
        console.error("❌ アカウント削除でエラー:", error);
        return res.status(500).json({ success: false, message: '削除処理に失敗しました。' });
    }
};

// 4. 指定ユーザーが権限を持つサイト一覧を取得（権限編集画面のチェックボックス初期表示用）
export const getUserPermissions = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const queryStr = 'SELECT site_id FROM public.user_site_permissions WHERE user_id = $1';
        const result = await pool.query(queryStr, [id]);
        const siteIds = result.rows.map(row => row.site_id);

        return res.json({ success: true, site_ids: siteIds });
    } catch (error) {
        console.error('❌ ユーザー権限の取得でエラー:', error);
        return res.status(500).json({ success: false, message: '権限情報の取得に失敗しました。' });
    }
};

