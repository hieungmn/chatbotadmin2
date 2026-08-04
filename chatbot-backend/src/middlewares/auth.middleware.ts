import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { ENV } from '../config/env';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: string;
    };
    /** スタッフが閲覧可能なサイト一覧 — Express 5 では req.query への直接代入が
     *  できない（読み取り専用）ため、ここに保持する。 */
    allowedSiteIds?: string[];
}

/**
 * 1. 共通トークン認証ミドルウェア（管理者・スタッフ共通）
 *    JWTの内容を鵜呑みにせず、常にDBから最新のrole/is_activeを取得する。
 */
export const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'アクセスが拒否されました。トークンがありません。' });
        }

        const token = authHeader.split(' ')[1];

        if (!token || token === 'null' || token === 'undefined' || token.split('.').length !== 3) {
            return res.status(401).json({
                success: false,
                message: '再度ログインしてください。認証トークンが不正です。'
            });
        }

        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: number; username: string; password_version?: number };
        if (!Number.isInteger(decoded.id) || decoded.id <= 0 || typeof decoded.username !== 'string') {
            return res.status(401).json({ success: false, message: '認証トークンが不正です。' });
        }

        const userCheck = await pool.query(
            'SELECT role, is_active, password_version FROM public.admin_users WHERE id = $1',
            [decoded.id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'アカウントが存在しません。' });
        }
        if (!userCheck.rows[0].is_active) {
            return res.status(401).json({ success: false, message: 'このアカウントは無効化されています。' });
        }

        // Existing tokens without a version remain valid until the first password change.
        const tokenVersion = decoded.password_version ?? 0;
        if (!Number.isInteger(tokenVersion) || tokenVersion < 0 || tokenVersion !== (userCheck.rows[0].password_version ?? 0)) {
            return res.status(401).json({ success: false, message: 'パスワードが変更されました。再度ログインしてください。' });
        }

        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: userCheck.rows[0].role || 'staff',
        };

        return next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ success: false, message: 'トークンが無効か、有効期限が切れています。' });
        }
        console.error('❌ トークン認証でエラー:', error);
        return res.status(500).json({ success: false, message: '認証情報の確認中にエラーが発生しました。' });
    }
};

/**
 * 2. role === 'admin' のみ通過を許可するミドルウェア。
 *    用途: アカウント管理、コンテンツの承認／却下。
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: '認証されていません。' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'この操作は管理者のみ実行できます。' });
    }
    return next();
};

/**
 * 3. サイト単位の権限チェック・処理ミドルウェア。
 *    スタッフがサイトのコンテンツを作成/編集/削除/アップロードできる唯一の
 *    条件はこのサイト権限であり（別途can_manage_contentフラグはない）、
 *    作成/アップロードした内容は管理者が承認するまで「承認待ち」となる。
 */
export const checkSitePermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'システムエラー: 認証されていません。' });
        }

        if (req.user.role === 'admin') {
            return next();
        }

        // GETリクエストでは req.body が undefined になる場合があるため、
        // アクセス前に必ず存在チェックを行う（TypeError防止）。
        const siteId = req.params.siteId || (req.body && req.body.site_id) || req.query.site_id;

        if (!siteId) {
            const allowedSites = await pool.query(
                'SELECT site_id FROM public.user_site_permissions WHERE user_id = $1',
                [req.user.id]
            );
            req.allowedSiteIds = allowedSites.rows.map((r: any) => r.site_id);
            return next();
        }

        const permissionCheck = await pool.query(
            'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
            [req.user.id, siteId]
        );

        if (permissionCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: `サイト [${siteId}] のデータを管理・閲覧する権限がありません。`
            });
        }

        return next();
    } catch (error) {
        console.error('❌ サイト権限チェックでエラー:', error);
        return res.status(500).json({ success: false, message: 'サイト権限の確認中にエラーが発生しました。' });
    }
};
