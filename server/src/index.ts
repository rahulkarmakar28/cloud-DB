import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

import authRoutes from './authRoutes.js';
import dbRoutes from './dbRoutes.js';
import { PLANS, ENGINE_VERSIONS, REGIONS } from './plans.js';
import 'dotenv/config';

const app = new Hono();

// ── Global middleware ─────────────────────────────────────
app.use('*', cors({
  origin: process.env['FRONTEND_URL'] ?? '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use('*', logger());

// ── Health ────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Meta (public) ─────────────────────────────────────────
app.get('/api/plans',   (c) => c.json({ plans:   Object.values(PLANS) }));
app.get('/api/engines', (c) => c.json({ engines: ENGINE_VERSIONS }));
app.get('/api/regions', (c) => c.json({ regions: REGIONS }));

// ── Auth routes ───────────────────────────────────────────
app.route('/api/auth', authRoutes);

// ── Database routes (all protected) ──────────────────────
app.route('/api/databases', dbRoutes);

// ── 404 fallback ──────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ── Node HTTP server ──────────────────────────────────────
const PORT = parseInt(process.env['PORT'] ?? '3001');
console.log(`DBCloud API → http://localhost:${PORT}`);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k] = v;
  }
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise<string>((resolve) => {
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => resolve(data));
    });
  }
  const honoReq = new Request(url.toString(), { method: req.method, headers, body: body || undefined });
  const honoRes = await app.fetch(honoReq);
  res.writeHead(honoRes.status, Object.fromEntries(honoRes.headers.entries()));
  res.end(await honoRes.text());
});

server.listen(PORT);
