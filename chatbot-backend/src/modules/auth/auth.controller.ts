import { Request, Response } from 'express';
import pool from '../../config/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ENV } from '../../config/env';

export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'ユーザー名とパスワードを入力してください。' });
        }

        const lowerUsername = username.trim().toLowerCase();

        // password_hash は必要な範囲以外に漏らさない
        const resDb = await pool.query(
            'SELECT id, username, password_hash, password_version, full_name, role, is_active FROM public.admin_users WHERE LOWER(username) = $1',
            [lowerUsername]
        );

        if (resDb.rows.length === 0) {
            // アカウントの存在有無は伝えない（ユーザー名の推測防止）
            return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません。' });
        }

        const dbUser = resDb.rows[0];

        if (!dbUser.is_active) {
            return res.status(401).json({ success: false, message: 'このアカウントは無効化されています。' });
        }

        // bcryptでパスワードを照合（DB側は必ずbcryptハッシュであること）
        const isMatch = await bcrypt.compare(password, dbUser.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません。' });
        }

        const finalId = dbUser.id;
        const finalUsername = dbUser.username;
        const userRole = dbUser.role || 'staff'; // DBの実際のroleを使用する（username由来で判定しない）

        // .envで一元管理するシークレットでJWTを発行する
        const token = jwt.sign(
            { id: finalId, username: finalUsername, role: userRole, password_version: dbUser.password_version ?? 0 },
            ENV.JWT_SECRET,
            { expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
        );

        return res.json({
            success: true,
            token,
            role: userRole,
            username: finalUsername,
            full_name: dbUser.full_name,
            message: 'ログインしました。',
        });
    } catch (error) {
        console.error('❌ 管理者ログインでエラー:', error);
        return res.status(500).json({ success: false, message: 'サーバーエラーが発生しました。' });
    }
};
