import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, Pause, Play, Copy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import type { DatabaseInstance, MetricPoint } from '../types';
import { StatusBadge, EngineIcon, Card, Btn, StatTile, CopyField, Spinner } from '../components/ui';

type Tab = 'overview' | 'metrics' | 'connect' | 'manifests' | 'settings';

export default function DatabaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [db, setDb] = useState<DatabaseInstance | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [metricSeries, setMetricSeries] = useState<MetricPoint[]>([]);
  const [manifests, setManifests] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadDb = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const { database } = await api.getDatabase(id);
      setDb(database);
    } catch { navigate('/'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id, navigate]);

  useEffect(() => { loadDb(); }, [loadDb]);

  // Poll while provisioning
  useEffect(() => {
    if (!db || (db.status !== 'provisioning' && db.status !== 'scaling')) return;
    const t = setInterval(() => loadDb(true), 5000);
    return () => clearInterval(t);
  }, [db?.status, loadDb]);

  useEffect(() => {
    if (tab === 'metrics' && id) {
      api.getMetrics(id).then(r => setMetricSeries(r.series)).catch(() => {});
    }
    if (tab === 'manifests' && id) {
      api.getManifests(id).then(r => setManifests(r.manifests)).catch(() => {});
    }
  }, [tab, id]);

  const handlePause = async () => {
    if (!id || !db) return;
    try {
      db.status === 'paused' ? await api.resumeDatabase(id) : await api.pauseDatabase(id);
      loadDb(true);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try { await api.deleteDatabase(id); navigate('/'); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); setDeleting(false); }
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={36} /></div>;
  if (!db) return null;

  const TABS: [Tab, string][] = [['overview','◈ Overview'],['metrics','⬡ Metrics'],['connect','⌥ Connect'],['manifests','☸ K8s Manifests'],['settings','⚙ Settings']];

  const fmtUptime = (s: number) => `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h`;

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link to="/"><Btn variant="ghost" size="sm"><ArrowLeft size={13} /></Btn></Link>
          <EngineIcon engine={db.config.engine} size={38} />
          <div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700 }}>{db.name}</h1>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
              <StatusBadge status={db.status} />
              <span style={{ fontSize:11, color:'var(--text-dim)' }}>{db.config.engine} v{db.config.version} · {db.config.region}</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="outline" size="sm" onClick={()=>loadDb(true)} disabled={refreshing}>
            <RefreshCw size={12} style={{ animation:refreshing?'spin 0.7s linear infinite':'none' }} />
          </Btn>
          <Btn variant="outline" size="sm" onClick={handlePause} disabled={db.status==='provisioning'}>
            {db.status==='paused'?<><Play size={12}/>Resume</>:<><Pause size={12}/>Pause</>}
          </Btn>
          <Btn variant="danger" size="sm" onClick={()=>setShowDelete(true)}><Trash2 size={12}/>Delete</Btn>
        </div>
      </div>

      {/* Delete modal */}
      {showDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <Card style={{ maxWidth:360, width:'90%' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--red)', marginBottom:10 }}>Delete {db.name}?</div>
            <p style={{ color:'var(--text-muted)', fontSize:12, marginBottom:18, lineHeight:1.7 }}>
              This permanently deletes all data and Kubernetes resources (namespace, StatefulSets, PVCs). Cannot be undone.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <Btn variant="outline" onClick={()=>setShowDelete(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting?<Spinner size={12}/>:<Trash2 size={12}/>} Delete Forever
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:20 }}>
        {TABS.map(([t,label]) => (
          <button key={t} onClick={()=>setTab(t)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', fontSize:11, background:'transparent', border:'none', color:tab===t?'var(--accent)':'var(--text-muted)', borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`, marginBottom:-1, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            <StatTile label="Status" value={db.status} color={db.status==='running'?'var(--green)':db.status==='error'?'var(--red)':'var(--yellow)'} />
            <StatTile label="Engine" value={`${db.config.engine} v${db.config.version}`} color="var(--blue)" />
            <StatTile label="Plan" value={db.config.plan} color="var(--purple)" />
            <StatTile label="Storage" value={db.config.storageGB} unit="GB" color="var(--orange)" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
            <Card>
              <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Configuration</div>
              {[
                ['CPU',         `${db.config.cpuMillicores}m`],
                ['Memory',      `${db.config.memoryMB} MB`],
                ['Write Replicas', `${db.config.replicas}×`],
                ['Read Replicas',  `${db.config.readReplicas}×`],
                ['Autoscaling', db.config.autoscaling?`Yes (max ${db.config.maxReplicas}×)`:'Off'],
                ['Pooling',     db.config.connectionPooling?'On':'Off'],
                ['HA',          db.config.highAvailability?'On':'Off'],
                ['Backups',     db.config.backupEnabled?`${db.config.backupRetentionDays}d`:'Off'],
              ].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:11, color:'var(--text-dim)' }}>{k}</span>
                  <span style={{ fontSize:11 }}>{v}</span>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Kubernetes</div>
              {[
                ['Namespace',   db.kubernetesNamespace],
                ['Deployment',  db.kubernetesDeploymentName],
                ['Host',        db.host],
                ['Port',        String(db.port)],
                ['Database',    db.database],
              ].map(([k,v])=>(
                <div key={k} style={{ marginBottom:9 }}>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:1 }}>{k}</div>
                  <code style={{ fontSize:10, color:'var(--accent)', wordBreak:'break-all' }}>{v}</code>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* Metrics */}
      {tab === 'metrics' && (
        <div>
          {metricSeries.length === 0
            ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={28} /></div>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { key:'cpu' as keyof MetricPoint,    label:'CPU Usage (%)',       color:'#00ff9d' },
                  { key:'connections' as keyof MetricPoint, label:'Active Connections', color:'#58a6ff' },
                  { key:'qps' as keyof MetricPoint,    label:'Queries / Second',    color:'#ffa657' },
                ].map(({ key, label, color }) => (
                  <Card key={key}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:12 }}>{label}</div>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={metricSeries.slice(-30)}>
                        <XAxis dataKey="timestamp" hide />
                        <YAxis width={36} tick={{ fill:'var(--text-dim)', fontSize:9 }} />
                        <Tooltip contentStyle={{ background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:6, fontSize:10 }} labelStyle={{ color:'var(--text-muted)' }} />
                        <Line type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                ))}
                <div style={{ fontSize:11, color:'var(--text-dim)', textAlign:'center', marginTop:4 }}>
                  ℹ️ Real metrics require <code>metrics-server</code> installed in your cluster. Install: <code>kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml</code>
                </div>
              </div>
            )
          }
        </div>
      )}

      {/* Connect */}
      {tab === 'connect' && (
        <Card>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:16 }}>Connection Details</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <CopyField label="Primary Connection String" value={db.connectionString} />
            {db.readReplicaConnectionStrings.map((cs,i)=>(
              <CopyField key={i} label={`Read Replica ${i+1}`} value={cs} />
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <CopyField label="Host"     value={db.host} />
              <CopyField label="Port"     value={String(db.port)} />
              <CopyField label="Database" value={db.database} />
              <CopyField label="Username" value={db.username} />
            </div>
            <CopyField label="Password" value={db.password} secret />

            <div style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginTop:4 }}>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8 }}>Quick Connect (port-forward from local)</div>
              <code style={{ fontSize:11, color:'var(--text-muted)', display:'block', lineHeight:1.9 }}>
                <span style={{ color:'var(--green)' }}>$ </span>
                <span style={{ color:'var(--text)' }}>kubectl port-forward svc/{db.kubernetesDeploymentName.replace('-primary','')}-svc {db.port}:{db.port} -n {db.kubernetesNamespace}</span>
                <br/>
                {db.config.engine==='postgresql' && <><span style={{ color:'var(--green)' }}>$ </span><span style={{ color:'var(--text)' }}>psql "postgresql://{db.username}:****@localhost:{db.port}/{db.database}"</span></>}
                {db.config.engine==='mysql'      && <><span style={{ color:'var(--green)' }}>$ </span><span style={{ color:'var(--text)' }}>mysql -h localhost -P {db.port} -u {db.username} -p {db.database}</span></>}
                {db.config.engine==='redis'      && <><span style={{ color:'var(--green)' }}>$ </span><span style={{ color:'var(--text)' }}>redis-cli -h localhost -p {db.port} -a ****</span></>}
                {db.config.engine==='mongodb'    && <><span style={{ color:'var(--green)' }}>$ </span><span style={{ color:'var(--text)' }}>mongosh "mongodb://{db.username}:****@localhost:{db.port}/{db.database}"</span></>}
              </code>
            </div>
          </div>
        </Card>
      )}

      {/* Manifests */}
      {tab === 'manifests' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {!manifests
            ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={28} /></div>
            : Object.entries(manifests).map(([key, value]) =>
                value ? (
                  <Card key={key}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{key}</span>
                      <Btn variant="ghost" size="sm" onClick={()=>navigator.clipboard.writeText(JSON.stringify(value,null,2)).catch(()=>{})}>
                        <Copy size={11} /> Copy
                      </Btn>
                    </div>
                    <pre style={{ fontSize:10, color:'var(--text-muted)', background:'var(--bg-1)', padding:12, borderRadius:6, overflow:'auto', maxHeight:260, border:'1px solid var(--border)', margin:0 }}>
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </Card>
                ) : null
              )
          }
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <Card>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:16 }}>Danger Zone</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{db.status==='paused'?'Resume Database':'Pause Database'}</div>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>{db.status==='paused'?'Restart k8s pods':'Scale StatefulSet to 0 replicas (data preserved)'}</div>
              </div>
              <Btn variant="outline" size="sm" onClick={handlePause}>
                {db.status==='paused'?<><Play size={12}/>Resume</>:<><Pause size={12}/>Pause</>}
              </Btn>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'rgba(248,81,73,0.05)', border:'1px solid rgba(248,81,73,0.2)', borderRadius:8 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--red)' }}>Delete Database</div>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>Deletes entire k8s namespace, all data, all PVCs</div>
              </div>
              <Btn variant="danger" size="sm" onClick={()=>setShowDelete(true)}><Trash2 size={12}/>Delete</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
