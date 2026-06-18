import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from './db/pool.js';
import { requireAuth, getUser } from './auth.js';
import {
  provisionDatabase, deprovisionDatabase,
  pauseDatabase, resumeDatabase,
  getPodMetrics, getDeploymentStatus,
  buildConnectionString, generateManifestsForDisplay,
} from './kubernetes.js';
import { PLANS, ENGINE_PORTS } from './plans.js';
import type { DatabaseInstance, DatabaseConfig } from './types.js';

const db = new Hono();

// All database routes require auth
db.use('*', requireAuth);

// ── Row → DatabaseInstance ────────────────────────────────
interface DBRow {
  id: string; user_id: string; name: string; status: string;
  config: DatabaseConfig; connection_string: string;
  read_replica_conn_strings: string[];
  host: string; port: number; db_name: string;
  db_username: string; db_password: string;
  kubernetes_namespace: string; kubernetes_deployment_name: string;
  created_at: string; updated_at: string;
}

function rowToInstance(row: DBRow): DatabaseInstance {
  return {
    id: row.id, userId: row.user_id, name: row.name,
    status: row.status as DatabaseInstance['status'],
    config: row.config,
    connectionString: row.connection_string,
    readReplicaConnectionStrings: row.read_replica_conn_strings ?? [],
    host: row.host, port: row.port,
    database: row.db_name, username: row.db_username, password: row.db_password,
    kubernetesNamespace: row.kubernetes_namespace,
    kubernetesDeploymentName: row.kubernetes_deployment_name,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// ── Validation schema ─────────────────────────────────────
const createSchema = z.object({
  name:               z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
  engine:             z.enum(['postgresql', 'mysql', 'redis', 'mongodb']),
  version:            z.string(),
  region:             z.enum(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1', 'ap-southeast-1']),
  plan:               z.enum(['free', 'starter', 'pro', 'enterprise']),
  replicas:           z.number().int().min(1).max(20),
  storageGB:          z.number().min(1).max(1000),
  autoscaling:        z.boolean().default(false),
  maxReplicas:        z.number().int().min(1).max(20),
  connectionPooling:  z.boolean().default(false),
  maxConnections:     z.number().int().min(5).max(5000),
  backupEnabled:      z.boolean().default(true),
  backupRetentionDays:z.number().int().min(1).max(30),
  highAvailability:   z.boolean().default(false),
  readReplicas:       z.number().int().min(0).max(10),
});

// ── GET /api/databases ────────────────────────────────────
db.get('/', async (c) => {
  const { userId } = getUser(c);
  const rows = await query<DBRow>(
    'SELECT * FROM database_instances WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return c.json({ databases: rows.map(rowToInstance) });
});

// ── GET /api/databases/:id ────────────────────────────────
db.get('/:id', async (c) => {
  const { userId } = getUser(c);
  const row = await queryOne<DBRow>(
    'SELECT * FROM database_instances WHERE id = $1 AND user_id = $2',
    [c.req.param('id'), userId]
  );
  if (!row) return c.json({ error: 'Not found' }, 404);

  // Sync live status from Kubernetes
  if (row.status === 'provisioning' || row.status === 'running') {
    const liveStatus = await getDeploymentStatus(
      row.kubernetes_namespace, row.kubernetes_deployment_name
    );
    if (liveStatus !== row.status) {
      await query('UPDATE database_instances SET status = $1 WHERE id = $2', [liveStatus, row.id]);
      row.status = liveStatus;
    }
  }

  return c.json({ database: rowToInstance(row) });
});

// ── POST /api/databases ───────────────────────────────────
db.post('/', async (c) => {
  const { userId } = getUser(c);

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  const form = parsed.data;

  // Check name uniqueness per user
  const exists = await queryOne(
    'SELECT id FROM database_instances WHERE user_id = $1 AND name = $2', [userId, form.name]
  );
  if (exists) return c.json({ error: 'A database with this name already exists' }, 409);

  const plan = PLANS[form.plan];
  const id = uuidv4();
  const dbUsername = `usr_${id.replace(/-/g, '').substring(0, 12)}`;
  const dbPassword = generateSecurePassword();
  const dbName     = form.name.replace(/-/g, '_');

  const config: DatabaseConfig = {
    engine: form.engine, version: form.version, region: form.region,
    plan: form.plan, replicas: form.replicas, storageGB: form.storageGB,
    cpuMillicores: plan.cpuMillicores, memoryMB: plan.memoryMB,
    autoscaling: form.autoscaling, maxReplicas: form.maxReplicas,
    connectionPooling: form.connectionPooling, maxConnections: form.maxConnections,
    backupEnabled: form.backupEnabled, backupRetentionDays: form.backupRetentionDays,
    highAvailability: form.highAvailability, readReplicas: form.readReplicas,
    name: form.name,
  };

  // Insert as provisioning first (so UI sees it immediately)
  await query(
    `INSERT INTO database_instances
       (id, user_id, name, status, config, host, port, db_name, db_username, db_password,
        kubernetes_namespace, kubernetes_deployment_name, connection_string, read_replica_conn_strings)
     VALUES ($1,$2,$3,'provisioning',$4,'pending',$5,$6,$7,$8,'pending','pending','pending','[]')`,
    [id, userId, form.name, JSON.stringify(config),
     ENGINE_PORTS[form.engine], dbName, dbUsername, dbPassword]
  );

  // Provision asynchronously — don't block the HTTP response
  provisionInBackground(id, config, dbUsername, dbPassword, dbName);

  const row = await queryOne<DBRow>('SELECT * FROM database_instances WHERE id = $1', [id]);
  return c.json({ database: rowToInstance(row!) }, 201);
});

// ── DELETE /api/databases/:id ─────────────────────────────
db.delete('/:id', async (c) => {
  const { userId } = getUser(c);
  const row = await queryOne<DBRow>(
    'SELECT * FROM database_instances WHERE id = $1 AND user_id = $2',
    [c.req.param('id'), userId]
  );
  if (!row) return c.json({ error: 'Not found' }, 404);

  // Delete k8s namespace (cascades everything)
  try {
    await deprovisionDatabase(row.kubernetes_namespace);
  } catch (e) {
    console.error('K8s deprovision error (continuing):', e);
  }

  await query('DELETE FROM database_instances WHERE id = $1', [row.id]);
  return c.json({ message: 'Database terminated' });
});

// ── PATCH /api/databases/:id/pause ───────────────────────
db.patch('/:id/pause', async (c) => {
  const { userId } = getUser(c);
  const row = await queryOne<DBRow>(
    'SELECT * FROM database_instances WHERE id = $1 AND user_id = $2',
    [c.req.param('id'), userId]
  );
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.status !== 'running') return c.json({ error: 'Database is not running' }, 400);

  await pauseDatabase(row.kubernetes_namespace, row.kubernetes_deployment_name);
  await query("UPDATE database_instances SET status='paused' WHERE id=$1", [row.id]);
  return c.json({ message: 'Database paused' });
});

// ── PATCH /api/databases/:id/resume ──────────────────────
db.patch('/:id/resume', async (c) => {
  const { userId } = getUser(c);
  const row = await queryOne<DBRow>(
    'SELECT * FROM database_instances WHERE id = $1 AND user_id = $2',
    [c.req.param('id'), userId]
  );
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.status !== 'paused') return c.json({ error: 'Database is not paused' }, 400);

  await resumeDatabase(row.kubernetes_namespace, row.kubernetes_deployment_name);
  await query("UPDATE database_instances SET status='provisioning' WHERE id=$1", [row.id]);
  return c.json({ message: 'Database resuming' });
});

// ── GET /api/databases/:id/metrics ───────────────────────
db.get('/:id/metrics', async (c) => {
  const { userId } = getUser(c);
  const row = await queryOne<DBRow>(
    'SELECT kubernetes_namespace FROM database_instances WHERE id = $1 AND user_id = $2',
    [c.req.param('id'), userId]
  );
  if (!row) return c.json({ error: 'Not found' }, 404);

  const metrics = await getPodMetrics(row.kubernetes_namespace);
  // Also generate 60-point time series for charts (last hour, based on current snapshot)
  const now = Date.now();
  const series = Array.from({ length: 60 }, (_, i) => ({
    timestamp:   new Date(now - (59 - i) * 60_000).toISOString(),
    cpu:         +(metrics.cpuUsagePercent + (Math.random() - 0.5) * 5).toFixed(1),
    memory:      +(metrics.memoryUsageMB   + (Math.random() - 0.5) * 50).toFixed(0),
    connections: Math.max(0, metrics.connectionsActive + Math.floor((Math.random() - 0.5) * 5)),
    qps:         +(metrics.queriesPerSecond + (Math.random() - 0.5) * 20).toFixed(1),
  }));
  return c.json({ current: metrics, series });
});

// ── GET /api/databases/:id/manifests ─────────────────────
db.get('/:id/manifests', async (c) => {
  const { userId } = getUser(c);
  const row = await queryOne<DBRow>(
    'SELECT * FROM database_instances WHERE id = $1 AND user_id = $2',
    [c.req.param('id'), userId]
  );
  if (!row) return c.json({ error: 'Not found' }, 404);
  const manifests = generateManifestsForDisplay(
    row.id, row.config, row.db_username, row.db_password, row.db_name
  );
  return c.json({ manifests });
});

// ── Background provisioning ───────────────────────────────
async function provisionInBackground(
  id: string, config: DatabaseConfig,
  username: string, password: string, dbName: string
) {
  try {
    const { host, port, namespace, deploymentName } =
      await provisionDatabase(id, config, username, password, dbName);

    const connStr = buildConnectionString(config.engine, host, port, username, password, dbName);
    const replicaHost = host.replace('-svc.', '-replica-svc.');
    const readReplicaConns = config.readReplicas > 0
      ? [buildConnectionString(config.engine, replicaHost, port, username, password, dbName)]
      : [];

    await query(
      `UPDATE database_instances SET
         status = 'provisioning', host = $1, port = $2,
         connection_string = $3, read_replica_conn_strings = $4,
         kubernetes_namespace = $5, kubernetes_deployment_name = $6
       WHERE id = $7`,
      [host, port, connStr, JSON.stringify(readReplicaConns), namespace, deploymentName, id]
    );
    console.log(`Provisioned database ${id} in namespace ${namespace}`);
  } catch (err) {
    console.error(`Failed to provision database ${id}:`, err);
    await query("UPDATE database_instances SET status='error' WHERE id=$1", [id]);
  }
}

// ── Helpers ───────────────────────────────────────────────
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default db;
