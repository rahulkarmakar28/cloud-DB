import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query, queryOne } from './db/pool.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, requireAuth, getUser } from './auth.js';
import type { User } from './types.js';

const auth = new Hono();

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email:    z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
auth.post('/register', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);

  const { username, email, password } = parsed.data;

  // Check existing
  const existing = await queryOne<User>(
    'SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]
  );
  if (existing) return c.json({ error: 'Email or username already taken' }, 409);

  const password_hash = await bcrypt.hash(password, 12);
  const [user] = await query<User>(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
    [username, email, password_hash]
  );

  const payload = { userId: user.id, username: user.username, email: user.email };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store refresh token hash
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
    [user.id, tokenHash]
  );

  return c.json({ user: { id: user.id, username: user.username, email: user.email }, accessToken, refreshToken }, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);

  const { email, password } = parsed.data;
  const user = await queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const payload = { userId: user.id, username: user.username, email: user.email };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
    [user.id, tokenHash]
  );

  return c.json({ user: { id: user.id, username: user.username, email: user.email }, accessToken, refreshToken });
});

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { refreshToken } = body as { refreshToken?: string };
  if (!refreshToken) return c.json({ error: 'Missing refreshToken' }, 400);

  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch { return c.json({ error: 'Invalid or expired refresh token' }, 401); }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await queryOne('SELECT id FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()', [tokenHash]);
  if (!stored) return c.json({ error: 'Refresh token revoked or expired' }, 401);

  // Rotate: delete old, issue new
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  const newAccess  = signAccessToken(payload);
  const newRefresh = signRefreshToken(payload);
  const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
    [payload.userId, newHash]
  );

  return c.json({ accessToken: newAccess, refreshToken: newRefresh });
});

// POST /api/auth/logout
auth.post('/logout', requireAuth, async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { body = {}; }
  const { refreshToken } = body as { refreshToken?: string };
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  }
  return c.json({ message: 'Logged out' });
});

// GET /api/auth/me
auth.get('/me', requireAuth, async (c) => {
  const { userId } = getUser(c);
  const user = await queryOne<User>('SELECT id, username, email, created_at FROM users WHERE id = $1', [userId]);
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

export default auth;
