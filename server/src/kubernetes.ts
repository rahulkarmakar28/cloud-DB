import * as k8s from '@kubernetes/client-node';
import type { DatabaseConfig, DBEngine, PodMetrics } from './types.js';
import 'dotenv/config';

// ── K8s client setup ──────────────────────────────────────
const kc = new k8s.KubeConfig();

// In-cluster when running inside k8s pod, otherwise falls back to ~/.kube/config
try {
  if (process.env['KUBERNETES_SERVICE_HOST']) {
    kc.loadFromCluster();
  } else {
    kc.loadFromDefault();
  }
} catch {
  console.warn('⚠️  No kubeconfig found — Kubernetes operations will fail. Set KUBECONFIG or run inside a cluster.');
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const autoApi = kc.makeApiClient(k8s.AutoscalingV2Api);

// ── Engine image map ──────────────────────────────────────
const ENGINE_IMAGES: Record<DBEngine, (v: string) => string> = {
  postgresql: (v) => `postgres:${v}-alpine`,
  mysql: (v) => `mysql:${v}`,
  redis: (v) => `redis:${v}-alpine`,
  mongodb: (v) => `mongo:${v}`,
};

const ENGINE_PORTS: Record<DBEngine, number> = {
  postgresql: 5432, mysql: 3306, redis: 6379, mongodb: 27017,
};

// ── Connection string builder ─────────────────────────────
export function buildConnectionString(
  engine: DBEngine, host: string, port: number,
  username: string, password: string, dbName: string
): string {
  const enc = encodeURIComponent;
  switch (engine) {
    case 'postgresql': return `postgresql://${enc(username)}:${enc(password)}@${host}:${port}/${dbName}`;
    case 'mysql': return `mysql://${enc(username)}:${enc(password)}@${host}:${port}/${dbName}`;
    case 'redis': return `redis://:${enc(password)}@${host}:${port}/0`;
    case 'mongodb': return `mongodb://${enc(username)}:${enc(password)}@${host}:${port}/${dbName}?authSource=admin`;
  }
}

// ── ENV vars per engine ───────────────────────────────────
function engineEnvVars(engine: DBEngine, username: string, password: string, dbName: string): k8s.V1EnvVar[] {
  switch (engine) {
    case 'postgresql': return [
      { name: 'POSTGRES_USER', value: username },
      { name: 'POSTGRES_PASSWORD', value: password },
      { name: 'POSTGRES_DB', value: dbName },
    ];
    case 'mysql': return [
      { name: 'MYSQL_ROOT_PASSWORD', value: password },
      { name: 'MYSQL_USER', value: username },
      { name: 'MYSQL_PASSWORD', value: password },
      { name: 'MYSQL_DATABASE', value: dbName },
    ];
    case 'redis': return [
      { name: 'REDIS_PASSWORD', value: password },
    ];
    case 'mongodb': return [
      { name: 'MONGO_INITDB_ROOT_USERNAME', value: username },
      { name: 'MONGO_INITDB_ROOT_PASSWORD', value: password },
      { name: 'MONGO_INITDB_DATABASE', value: dbName },
    ];
  }
}

// ── Redis command override ────────────────────────────────
function engineCommand(engine: DBEngine, password: string): string[] | undefined {
  if (engine === 'redis') return ['redis-server', '--requirepass', password];
  return undefined;
}

// ── Liveness probe ────────────────────────────────────────
function livenessProbe(engine: DBEngine, port: number): k8s.V1Probe {
  if (engine === 'redis') {
    return { exec: { command: ['redis-cli', 'ping'] }, initialDelaySeconds: 15, periodSeconds: 10 };
  }
  return { tcpSocket: { port: port as unknown as k8s.IntOrString }, initialDelaySeconds: 20, periodSeconds: 15 };
}

// ── Volume mount path ─────────────────────────────────────
function dataMountPath(engine: DBEngine): string {
  switch (engine) {
    case 'postgresql': return '/var/lib/postgresql/data';
    case 'mysql': return '/var/lib/mysql';
    case 'redis': return '/data';
    case 'mongodb': return '/data/db';
  }
}

// ── Main: provision a database on Kubernetes ──────────────
export async function provisionDatabase(
  instanceId: string,
  config: DatabaseConfig,
  username: string,
  password: string,
  dbName: string
): Promise<{ host: string; port: number; namespace: string; deploymentName: string }> {
  const ns = `dbcloud-${instanceId.substring(0, 8)}`;
  const app = `db-${instanceId.substring(0, 8)}`;
  const port = ENGINE_PORTS[config.engine];
  const image = ENGINE_IMAGES[config.engine](config.version);
  const envs = engineEnvVars(config.engine, username, password, dbName);
  const cmd = engineCommand(config.engine, password);
  const mount = dataMountPath(config.engine);
  const labels = { app, 'dbcloud/instance': instanceId, 'dbcloud/managed': 'true' };

  // 1. Namespace
  await coreApi.createNamespace({
    metadata: { name: ns, labels: { 'dbcloud/managed': 'true' } },
  }).catch(ignoreAlreadyExists);

  // 2. Secret
  const secretData: Record<string, string> = {
    username: Buffer.from(username).toString('base64'),
    password: Buffer.from(password).toString('base64'),
    database: Buffer.from(dbName).toString('base64'),
  };
  await coreApi.createNamespacedSecret(ns, {
    metadata: { name: `${app}-secret`, namespace: ns },
    type: 'Opaque',
    data: secretData,
  }).catch(ignoreAlreadyExists);

  // 3. StatefulSet (primary)
  const stsSpec: k8s.V1StatefulSet = {
    metadata: { name: `${app}-primary`, namespace: ns, labels },
    spec: {
      serviceName: `${app}-headless`,
      replicas: 1,
      selector: { matchLabels: { app, role: 'primary' } },
      template: {
        metadata: { labels: { ...labels, role: 'primary' } },
        spec: {
          containers: [{
            name: config.engine,
            image,
            ports: [{ containerPort: port }],
            env: envs,
            ...(cmd ? { command: cmd } : {}),
            resources: {
              requests: { cpu: `${config.cpuMillicores}m`, memory: `${config.memoryMB}Mi` },
              limits: { cpu: `${config.cpuMillicores * 2}m`, memory: `${Math.floor(config.memoryMB * 1.5)}Mi` },
            },
            volumeMounts: [{ name: 'data', mountPath: mount }],
            livenessProbe: livenessProbe(config.engine, port),
            readinessProbe: livenessProbe(config.engine, port),
          }],
        },
      },
      volumeClaimTemplates: [{
        metadata: { name: 'data' },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: `${config.storageGB}Gi` } },
          ...(process.env['STORAGE_CLASS'] ? { storageClassName: process.env['STORAGE_CLASS'] } : {}),
        },
      }],
    },
  };
  await appsApi.createNamespacedStatefulSet(ns, stsSpec).catch(ignoreAlreadyExists);

  // 4. Headless service (for StatefulSet DNS)
  await coreApi.createNamespacedService(ns, {
    metadata: { name: `${app}-headless`, namespace: ns },
    spec: {
      clusterIP: 'None',
      selector: { app, role: 'primary' },
      ports: [{ port, targetPort: port as unknown as k8s.IntOrString }],
    },
  }).catch(ignoreAlreadyExists);

  // 5. ClusterIP service (stable endpoint for apps)
  await coreApi.createNamespacedService(ns, {
    metadata: { name: `${app}-svc`, namespace: ns },
    spec: {
      selector: { app, role: 'primary' },
      ports: [{ port, targetPort: port as unknown as k8s.IntOrString, protocol: 'TCP' }],
      type: 'ClusterIP',
    },
  }).catch(ignoreAlreadyExists);

  // 6. Read replica Deployment (if requested)
  if (config.readReplicas > 0 && config.engine === 'postgresql') {
    const replicaEnvs: k8s.V1EnvVar[] = [
      ...envs,
      { name: 'PGUSER', value: username },
      { name: 'POSTGRES_PRIMARY', value: `${app}-primary-0.${app}-headless.${ns}.svc.cluster.local` },
      { name: 'POSTGRES_REPLICA', value: 'true' },
    ];
    await appsApi.createNamespacedDeployment(ns, {
      metadata: { name: `${app}-replica`, namespace: ns, labels },
      spec: {
        replicas: config.readReplicas,
        selector: { matchLabels: { app, role: 'replica' } },
        template: {
          metadata: { labels: { ...labels, role: 'replica' } },
          spec: {
            containers: [{
              name: `${config.engine}-replica`,
              image,
              ports: [{ containerPort: port }],
              env: replicaEnvs,
              resources: {
                requests: { cpu: `${Math.floor(config.cpuMillicores * 0.5)}m`, memory: `${Math.floor(config.memoryMB * 0.5)}Mi` },
                limits: { cpu: `${config.cpuMillicores}m`, memory: `${config.memoryMB}Mi` },
              },
            }],
          },
        },
      },
    }).catch(ignoreAlreadyExists);

    // Read replica service
    await coreApi.createNamespacedService(ns, {
      metadata: { name: `${app}-replica-svc`, namespace: ns },
      spec: {
        selector: { app, role: 'replica' },
        ports: [{ port, targetPort: port as unknown as k8s.IntOrString }],
        type: 'ClusterIP',
      },
    }).catch(ignoreAlreadyExists);
  }

  // 7. HPA for autoscaling
  if (config.autoscaling && config.readReplicas > 0) {
    await autoApi.createNamespacedHorizontalPodAutoscaler(ns, {
      metadata: { name: `${app}-hpa`, namespace: ns },
      spec: {
        scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: `${app}-replica` },
        minReplicas: config.replicas,
        maxReplicas: config.maxReplicas,
        metrics: [
          { type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } },
          { type: 'Resource', resource: { name: 'memory', target: { type: 'Utilization', averageUtilization: 80 } } },
        ],
      },
    }).catch(ignoreAlreadyExists);
  }

  // The internal hostname — apps inside the cluster use this
  const host = `${app}-svc.${ns}.svc.cluster.local`;

  return { host, port, namespace: ns, deploymentName: `${app}-primary` };
}

// ── Tear down: delete the entire namespace ────────────────
export async function deprovisionDatabase(namespace: string): Promise<void> {
  await coreApi.deleteNamespace(namespace, undefined, undefined, 0).catch((e) => {
    if (e?.response?.statusCode !== 404) throw e;
  });
}

// ── Pause: scale StatefulSet to 0 ────────────────────────
export async function pauseDatabase(namespace: string, deploymentName: string): Promise<void> {
  await appsApi.patchNamespacedStatefulSet(
    deploymentName, namespace,
    [{ op: 'replace', path: '/spec/replicas', value: 0 }],
    undefined, undefined, undefined, undefined, undefined,
    { headers: { 'Content-Type': 'application/json-patch+json' } }
  );
}

// ── Resume: scale StatefulSet back to 1 ──────────────────
export async function resumeDatabase(namespace: string, deploymentName: string): Promise<void> {
  await appsApi.patchNamespacedStatefulSet(
    deploymentName, namespace,
    [{ op: 'replace', path: '/spec/replicas', value: 1 }],
    undefined, undefined, undefined, undefined, undefined,
    { headers: { 'Content-Type': 'application/json-patch+json' } }
  );
}

// ── Scale replicas ────────────────────────────────────────
export async function scaleReplicas(namespace: string, app: string, replicas: number): Promise<void> {
  const deployName = `${app}-replica`;
  await appsApi.patchNamespacedDeployment(
    deployName, namespace,
    [{ op: 'replace', path: '/spec/replicas', value: replicas }],
    undefined, undefined, undefined, undefined, undefined,
    { headers: { 'Content-Type': 'application/json-patch+json' } }
  );
}

// ── Get pod metrics (requires metrics-server in cluster) ─
export async function getPodMetrics(namespace: string): Promise<{
  cpuUsagePercent: number; memoryUsageMB: number; connectionsActive: number;
  queriesPerSecond: number; replicationLagMs: number; storageUsedGB: number; uptime: number;
}> {
  // Try to get real metrics from metrics-server, fall back to zeros
  try {
    const metricsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    const res = await metricsApi.listNamespacedCustomObject(
      'metrics.k8s.io', 'v1beta1', namespace, 'pods'
    )
    const metrics = res.body as PodMetrics;
    const pods = metrics.items ?? [];
    let totalCpuNano = 0;
    let totalMemKi = 0;

    for (const pod of pods) {
      for (const container of pod.containers) {
        const cpu = container.usage.cpu;     // e.g. "125m" or "1250000n"
        const mem = container.usage.memory;  // e.g. "256Mi"

        if (cpu.endsWith('n')) totalCpuNano += parseInt(cpu) / 1e6;
        else if (cpu.endsWith('m')) totalCpuNano += parseInt(cpu);
        else totalCpuNano += parseInt(cpu) * 1000;

        if (mem.endsWith('Ki')) totalMemKi += parseInt(mem);
        else if (mem.endsWith('Mi')) totalMemKi += parseInt(mem) * 1024;
        else if (mem.endsWith('Gi')) totalMemKi += parseInt(mem) * 1024 * 1024;
        else totalMemKi += parseInt(mem) / 1024;
      }
    }

    return {
      cpuUsagePercent: Math.min(parseFloat((totalCpuNano / 1000).toFixed(1)), 100),
      memoryUsageMB: Math.round(totalMemKi / 1024),
      connectionsActive: 0,
      queriesPerSecond: 0,
      replicationLagMs: 0,
      storageUsedGB: 0,
      uptime: 0,
    };
  } catch {
    // metrics-server not installed or no permission — return zeros
    return {
      cpuUsagePercent: 0, memoryUsageMB: 0, connectionsActive: 0,
      queriesPerSecond: 0, replicationLagMs: 0, storageUsedGB: 0, uptime: 0,
    };
  }
}

// ── Check if StatefulSet pods are ready ──────────────────
export async function getDeploymentStatus(namespace: string, stsName: string): Promise<'provisioning' | 'running' | 'error'> {
  try {
    const res = await appsApi.readNamespacedStatefulSet(stsName, namespace);
    const sts = res.body;
    const desired = sts.spec?.replicas ?? 1;
    const ready = sts.status?.readyReplicas ?? 0;
    if (sts.spec?.replicas === 0) return 'provisioning'; // paused
    if (ready >= desired) return 'running';
    return 'provisioning';
  } catch {
    return 'error';
  }
}

// ── Generate manifests for display (does not apply) ──────
export function generateManifestsForDisplay(
  instanceId: string, config: DatabaseConfig, username: string, password: string, dbName: string
): Record<string, unknown> {
  const ns = `dbcloud-${instanceId.substring(0, 8)}`;
  const app = `db-${instanceId.substring(0, 8)}`;
  const port = ENGINE_PORTS[config.engine];
  const image = ENGINE_IMAGES[config.engine](config.version);

  return {
    Namespace: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: ns, labels: { 'dbcloud/managed': 'true' } } },
    Secret: { apiVersion: 'v1', kind: 'Secret', metadata: { name: `${app}-secret`, namespace: ns }, type: 'Opaque', stringData: { username, password: '[REDACTED]', database: dbName } },
    StatefulSet: {
      apiVersion: 'apps/v1', kind: 'StatefulSet',
      metadata: { name: `${app}-primary`, namespace: ns },
      spec: {
        serviceName: `${app}-headless`, replicas: 1,
        selector: { matchLabels: { app, role: 'primary' } },
        template: {
          metadata: { labels: { app, role: 'primary' } },
          spec: { containers: [{ name: config.engine, image, ports: [{ containerPort: port }], resources: { requests: { cpu: `${config.cpuMillicores}m`, memory: `${config.memoryMB}Mi` }, limits: { cpu: `${config.cpuMillicores * 2}m`, memory: `${Math.floor(config.memoryMB * 1.5)}Mi` } } }] },
        },
        volumeClaimTemplates: [{ metadata: { name: 'data' }, spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: `${config.storageGB}Gi` } } } }],
      },
    },
    Service: { apiVersion: 'v1', kind: 'Service', metadata: { name: `${app}-svc`, namespace: ns }, spec: { selector: { app, role: 'primary' }, ports: [{ port, targetPort: port }], type: 'ClusterIP' } },
    HeadlessService: { apiVersion: 'v1', kind: 'Service', metadata: { name: `${app}-headless`, namespace: ns }, spec: { clusterIP: 'None', selector: { app }, ports: [{ port }] } },
    ...(config.autoscaling && config.readReplicas > 0 ? {
      HPA: { apiVersion: 'autoscaling/v2', kind: 'HorizontalPodAutoscaler', metadata: { name: `${app}-hpa`, namespace: ns }, spec: { scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: `${app}-replica` }, minReplicas: config.replicas, maxReplicas: config.maxReplicas, metrics: [{ type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } }] } },
    } : {}),
  };
}

function ignoreAlreadyExists(err: unknown) {
  const e = err as { response?: { statusCode?: number } };
  if (e?.response?.statusCode !== 409) throw err;
}
