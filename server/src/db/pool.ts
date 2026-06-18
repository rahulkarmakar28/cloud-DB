import pg from '../../node_modules/@types/pg';
import 'dotenv/config';
const { Pool } = pg;

export const pool = new Pool({
  host:     process.env['DB_HOST']     ?? 'postgres',
  port:     parseInt(process.env['DB_PORT'] ?? '5432'),
  database: process.env['DB_NAME']     ?? 'dbcloud',
  user:     process.env['DB_USER']     ?? 'dbcloud',
  password: process.env['DB_PASSWORD'] ?? 'dbcloud_secret',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
