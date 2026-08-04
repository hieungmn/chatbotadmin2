import dotenv from 'dotenv';
import path from 'node:path';
// Resolve the same backend .env in both src/config and dist/config, regardless of cwd.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/**
 * 機密性の高い環境変数を1箇所に集約する。
 * JWT_SECRET が未設定の場合はアプリ起動時に即座に停止する（安全でない
 * ハードコード値や、ファイルごとに異なるsecretで署名される事態を防ぐため）。
 */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        '❌ .env に JWT_SECRET が設定されていません。' +
        '以下のコマンドでランダムな値を生成してください: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
}

export const ENV = {
    JWT_SECRET: JWT_SECRET as string,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    PORT: process.env.PORT || 3000,
    OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
};
