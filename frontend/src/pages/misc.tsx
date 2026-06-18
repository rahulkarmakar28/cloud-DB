import { useAuth } from '../lib/AuthContext';
import { Card } from '../components/ui';

export function Docs() {
  return (
    <div style={{ maxWidth:680 }} className="animate-in">
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, marginBottom:4 }}>Documentation</h1>
      <p style={{ color:'var(--text-muted)', fontSize:12, marginBottom:22 }}>Kubernetes-native database platform reference</p>
      {[
        ['Quick Start',`1. Register an account and sign in
2. Click "New Database" → choose engine, plan, replicas
3. Configure scaling and backup policies  
4. Click Deploy — DBCloud creates real K8s resources in your cluster
5. Use kubectl port-forward or the internal host to connect`],
        ['Kubernetes Architecture',`Each database creates a dedicated k8s namespace (dbcloud-<id>):

• StatefulSet     — primary node with PVC persistent storage
• Deployment      — read replicas (horizontally scalable)
• HPA             — HorizontalPodAutoscaler (if autoscaling enabled)
• ClusterIP Svc   — stable internal endpoint
• Headless Svc    — StatefulSet DNS resolution
• Secret          — encrypted credentials
• ConfigMap       — engine-specific configuration`],
        ['Connecting to Your Database',`Internal (within cluster):
  Host: <name>-svc.<namespace>.svc.cluster.local

External (from your machine):
  kubectl port-forward svc/<name>-svc <port>:<port> -n <namespace>
  Then connect to localhost:<port>

The connection string on the Connect tab contains the internal hostname.
For local development, use the port-forward command shown on the Connect tab.`],
        ['Real Metrics',`Metrics require metrics-server installed in your cluster:

kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

For local clusters (minikube):
  minikube addons enable metrics-server

For k3s:
  k3s already includes a compatible metrics API`],
        ['Backups',`Automated backups run as Kubernetes CronJobs.
Data is stored in S3-compatible object storage (configure S3_BUCKET env var).

• Encryption: AES-256 at rest
• Retention: configurable 1–30 days
• Schedule: daily at 02:00 UTC`],
      ].map(([title, content]) => (
        <Card key={title} style={{ marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>{title}</div>
          <pre style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', whiteSpace:'pre-wrap', lineHeight:1.9, margin:0 }}>{content}</pre>
        </Card>
      ))}
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth:560 }} className="animate-in">
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, marginBottom:4 }}>Settings</h1>
      <p style={{ color:'var(--text-muted)', fontSize:12, marginBottom:22 }}>Account and cluster configuration</p>
      <Card style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Account</div>
        {[
          ['User ID',   user?.id ?? '—'],
          ['Username',  user?.username ?? '—'],
          ['Email',     user?.email ?? '—'],
          ['Member since', user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'],
        ].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{k}</span>
            <code style={{ fontSize:12, color:'var(--text)', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</code>
          </div>
        ))}
      </Card>
      <Card>
        <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Cluster</div>
        {[
          ['Provider',       'Kubernetes (via @kubernetes/client-node)'],
          ['Config',         'KUBECONFIG or in-cluster ServiceAccount'],
          // ['Storage Class',  import.meta.env.VITE_STORAGE_CLASS ?? 'default'],
          ['Storage Class',  'default'],
          ['Metrics',        'metrics-server (optional)'],
        ].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{k}</span>
            <code style={{ fontSize:12, color:'var(--text)' }}>{v}</code>
          </div>
        ))}
      </Card>
    </div>
  );
}
