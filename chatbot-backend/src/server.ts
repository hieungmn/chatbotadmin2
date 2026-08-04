
import app from './app';
import pool from './config/db';

const PORT = process.env.PORT || 3000;

async function start() {
    // Do not report the API ready with an invalid database connection.
    await pool.query('SELECT 1');
    const server = app.listen(PORT, () => {
        console.log(`🚀 ========================================================`);
        console.log(`🚀 BOT MODULAR MONOLITH SERVER RUNNING ON PORT: http://localhost:${PORT}`);
        console.log('🚀 PostgreSQL schema: public');
        console.log(`🚀 ========================================================`);
    });
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
        server.close(() => { void pool.end(); });
    });
}

void start().catch(async error => {
    const { databaseError } = require('../database.config.cjs');
    console.error('Backend could not start: ' + databaseError(error));
    await pool.end();
    process.exitCode = 1;
});
