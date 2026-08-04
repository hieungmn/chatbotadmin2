import { Request, Response } from 'express';
import pool from '../../config/db';
import type { PoolClient } from 'pg';

// Lock the batch before its FAQ, in the same order as batch review.
export async function lockFaq(client: PoolClient, id: string) {
    const link = await client.query('SELECT import_batch_id FROM public.faq_master WHERE id = $1', [id]);
    if (!link.rows.length) return null;
    let batchStatus: string | null = null;
    if (link.rows[0].import_batch_id != null) {
        const batch = await client.query('SELECT approval_status FROM public.faq_import_batches WHERE id = $1 FOR UPDATE', [link.rows[0].import_batch_id]);
        batchStatus = batch.rows[0]?.approval_status ?? null;
    }
    const faq = await client.query('SELECT site_id, approval_status, import_batch_id FROM public.faq_master WHERE id = $1 FOR UPDATE', [id]);
    return faq.rows.length ? { ...faq.rows[0], batch_approval_status: batchStatus } : null;
}

export function assertFaqChange(faq: any, res: Response, review = false): boolean {
    if (!faq) {
        res.status(404).json({ success: false, message: '対象のFAQが見つかりません。' });
        return false;
    }
    if (faq.batch_approval_status === 'rejected' || (faq.approval_status === 'rejected' && (!review || faq.import_batch_id != null))) {
        res.status(409).json({ success: false, code: 'FAQ_REJECTED', message: faq.import_batch_id != null
            ? '却下されたFAQは編集できません。FAQ一括取込の「編集」からファイルを再承認してください。'
            : '却下されたFAQは編集できません。管理者が再承認してください。' });
        return false;
    }
    return true;
}

export const parseAllowedSiteIds = (req: Request): string[] => {
    return (req as any).allowedSiteIds || [];
};

export async function assertSitePermission(user: any, siteId: string, res: Response): Promise<boolean> {
    if (user.role === 'admin') return true;
    const permCheck = await pool.query(
        'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
        [user.id, siteId]
    );
    if (permCheck.rows.length === 0) {
        res.status(403).json({ success: false, message: `サイト [${siteId}] のデータを管理する権限がありません。` });
        return false;
    }
    return true;
}
