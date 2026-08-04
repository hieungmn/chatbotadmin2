const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

// Shared by the API and database commands.
// Explicit DB_* fields take precedence over a legacy DATABASE_URL.
function databaseConfig(env = process.env) {
    const timeout = Number(env.DB_CONNECTION_TIMEOUT_MS);
    const connectionTimeoutMillis = Number.isSafeInteger(timeout) && timeout >= 1 && timeout <= 300000 ? timeout : 10000;
    const fields = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const hasFields = fields.some(key => env[key] !== undefined);
    if (!hasFields) {
        if (!env.DATABASE_URL) throw new Error('Configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME in chatbot-backend/.env.');
        return { connectionString: env.DATABASE_URL, connectionTimeoutMillis };
    }
    for (const key of fields) {
        if (typeof env[key] !== 'string' || !env[key].length || (key !== 'DB_PASSWORD' && !env[key].trim())) {
            throw new Error(`${key} is required in chatbot-backend/.env.`);
        }
    }
    const port = Number(env.DB_PORT);
    if (!/^\d+$/.test(env.DB_PORT) || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT must be an integer from 1 to 65535.');
    }
    return {
        host: env.DB_HOST.trim(), port, user: env.DB_USER.trim(),
        password: env.DB_PASSWORD, database: env.DB_NAME.trim(),
        connectionTimeoutMillis,
    };
}

function databaseError(error) {
    const hints = {
        '28P01': 'Incorrect PostgreSQL username or password. Check DB_USER and DB_PASSWORD.',
        '28000': 'PostgreSQL rejected authentication. Check the user and server authentication settings.',
        '3D000': 'Database does not exist. Create DB_NAME in pgAdmin first.',
        '42501': 'Insufficient database permissions. Run initialization as the database owner with permission to enable extensions.',
        '58P01': 'An extension file is missing. Install pgvector into the PostgreSQL server directory.',
        '0A000': 'An extension is unavailable. Check pgvector installation and PostgreSQL compatibility.',
        'ECONNREFUSED': 'PostgreSQL is not reachable. Check the Windows service, DB_HOST and DB_PORT.',
        'ENOTFOUND': 'PostgreSQL host was not found. Check DB_HOST.',
    };
    if (hints[error.code]) return hints[error.code];
    if (!error.code && /^(DB_|Configure DB_)/.test(error.message || '')) return error.message;
    return `Database operation failed${error.code ? ` (${error.code})` : ''}. Check PostgreSQL, connection settings and permissions.`;
}

module.exports = { databaseConfig, databaseError };
