import { Pool, PoolConfig } from 'pg';
import { integerSetting } from './capacity';
import { TIMEOUTS } from './timeouts';

const { databaseConfig }: { databaseConfig: () => PoolConfig } = require('../../database.config.cjs');

const pool = new Pool({
    ...databaseConfig(),
    max: integerSetting('DB_POOL_MAX', 20, 1, 500),
    connectionTimeoutMillis: TIMEOUTS.database,
});

pool.on('connect', () => {
    console.log('📶 PostgreSQL connection established.');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err);
    process.exit(-1);
});

export default pool;
