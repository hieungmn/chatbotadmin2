import { Router } from 'express';
import {
    getAllAdminUsers,
    createNewAdminUser,
    deleteAdminUser,
    getUserPermissions
} from './user.controller';
import { verifyToken, requireAdmin } from '../../middlewares/auth.middleware';
import pool from '../../config/db';

const router = Router();

// 1. アカウント管理の基本ルート（ベースパス: /api/v1/staff-users）
//    管理者のみが他アカウントの閲覧・作成・削除を行える。
router.get('/', verifyToken, requireAdmin, getAllAdminUsers);
router.post('/', verifyToken, requireAdmin, createNewAdminUser);
router.delete('/:id', verifyToken, requireAdmin, deleteAdminUser);

// 2. サイト権限の管理
//    権限の閲覧・上書きは管理者のみ可能（スタッフが自分自身に全サイト権限を
//    付与するような権限昇格を防ぐため）。
router.get('/:id/permissions', verifyToken, requireAdmin, getUserPermissions);

router.post('/:id/permissions', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { site_ids }: { site_ids: string[] } = req.body;

        await pool.query('DELETE FROM public.user_site_permissions WHERE user_id = $1', [id]);

        if (site_ids && site_ids.length > 0) {
            for (const siteId of site_ids) {
                await pool.query(
                    'INSERT INTO public.user_site_permissions (user_id, site_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [id, siteId.trim(), (req as any).user?.id || null]
                );
            }
        }

        return res.json({ success: true, message: "権限を更新しました。" });
    } catch (err: any) {
        console.error("❌ 権限保存でエラー:", err);
        return res.status(500).json({ success: false, message: "権限の保存に失敗しました。" });
    }
});

export default router;
