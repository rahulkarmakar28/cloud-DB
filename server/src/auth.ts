import jwt from 'jsonwebtoken';
import 'dotenv/config';
import type { Context, Next } from 'hono';
import type { JWTPayload } from './types.js';

const JWT_SECRET  = process.env['JWT_SECRET']  ?? 'change_me_in_production_please_use_long_secret';
const JWT_EXPIRES = process.env['JWT_EXPIRES'] ?? '15m';
const REFRESH_SECRET  = process.env['REFRESH_SECRET']  ?? 'refresh_change_me_in_production_too';
const REFRESH_EXPIRES = process.env['REFRESH_EXPIRES'] ?? '7d';

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, REFRESH_SECRET) as JWTPayload;
}

// Hono middleware — attaches user to context
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Token expired or invalid' }, 401);
  }
}

export function getUser(c: Context): JWTPayload {
  return c.get('user') as JWTPayload;
}
