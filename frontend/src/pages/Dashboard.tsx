import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Database } from 'lucide-react';
import { api } from '../lib/api';
import type { DatabaseInstance } from '../types';
import { StatusBadge, EngineIcon, Card, Btn, Spinner } from '../components/ui';

export default function Dashboard() {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const { databases } = await api.getDatabases();
      setDatabases(databases);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const hasActive = databases.some(d => d.status === 'provisioning' || d.status === 'scaling');
    if (!hasActive) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [databases]);

  const stats = [
    { label:'Total',       value:databases.length,                                   color:'var(--accent)' },
    { label:'Running',     value:databases.filter(d=>d.status==='running').length,    color:'var(--green)' },
    { label:'Provisioning',value:databases.filter(d=>['provisioning','scaling'].includes(d.status)).length, color:'var(--yellow)' },
    { label:'Paused',      value:databases.filter(d=>d.status==='paused').length,     color:'var(--text-muted)' },
  ];

  return (
    <div className="animate-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, marginBottom:3 }}>Databases</h1>
          <p style={{ color:'var(--text-muted)', fontSize:12 }}>{databases.length} instance{databases.length!==1?'s':''} on your cluster</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="outline" onClick={()=>load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation:refreshing?'spin 0.7s linear infinite':'none' }} />
            Refresh
          </Btn>
          <Link to="/new"><Btn variant="primary"><Plus size={13} />New Database</Btn></Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:22 }}>
        {stats.map(s=>(
          <div key={s.label} style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:s.color, fontFamily:'var(--font-display)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32} /></div>
      ) : databases.length === 0 ? (
        <Card style={{ textAlign:'center', padding:'60px 20px' }}>
          <Database size={40} color="var(--text-dim)" style={{ margin:'0 auto 14px' }} />
          <div style={{ fontSize:15, fontFamily:'var(--font-display)', fontWeight:600, marginBottom:7 }}>No databases yet</div>
          <p style={{ color:'var(--text-muted)', fontSize:12, marginBottom:18 }}>Deploy your first managed Kubernetes database</p>
          <Link to="/new"><Btn variant="primary"><Plus size={13} />Create Database</Btn></Link>
        </Card>
      ) : (
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Name','Engine','Region','Plan','Status','Replicas','Storage',''].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {databases.map((db, i) => (
                <tr key={db.id}
                  style={{ borderBottom:i<databases.length-1?'1px solid var(--border)':'none', transition:'background 0.1s', cursor:'pointer' }}
                  onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-3)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                >
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <EngineIcon engine={db.config.engine} size={26} />
                      <div>
                        <Link to={`/db/${db.id}`} style={{ fontWeight:600, fontSize:13 }}>{db.name}</Link>
                        <div style={{ fontSize:10, color:'var(--text-dim)' }}>{db.id.substring(0,8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)', textTransform:'capitalize' }}>{db.config.engine} <span style={{ color:'var(--text-dim)' }}>v{db.config.version}</span></td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>{db.config.region}</td>
                  <td style={{ padding:'12px 14px' }}><span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'var(--bg-3)', color:'var(--text-muted)', textTransform:'capitalize' }}>{db.config.plan}</span></td>
                  <td style={{ padding:'12px 14px' }}><StatusBadge status={db.status} /></td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>{db.config.replicas}× + {db.config.readReplicas} read</td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>{db.config.storageGB} GB</td>
                  <td style={{ padding:'12px 14px' }}><Link to={`/db/${db.id}`}><Btn variant="outline" size="sm">View →</Btn></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
