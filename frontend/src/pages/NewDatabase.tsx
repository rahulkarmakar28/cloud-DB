import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Zap, Check } from 'lucide-react';
import { api } from '../lib/api';
import type { CreateDatabaseForm, PlanConfig } from '../types';
import { Input, Select, Toggle, RangeInput, Btn, Spinner } from '../components/ui';

const STEPS = ['Engine', 'Resources', 'Scaling', 'Backups', 'Review'];

const DEFAULT: CreateDatabaseForm = {
  name:'', engine:'postgresql', version:'16', region:'ap-south-1',
  plan:'starter', replicas:1, storageGB:10, autoscaling:false, maxReplicas:3,
  connectionPooling:true, maxConnections:100, backupEnabled:true,
  backupRetentionDays:7, highAvailability:false, readReplicas:1,
};

const ENGINE_INFO = {
  postgresql: { icon:'🐘', label:'PostgreSQL', desc:'Advanced open source RDBMS' },
  mysql:      { icon:'🐬', label:'MySQL',      desc:"World's most popular RDBMS" },
  redis:      { icon:'⚡', label:'Redis',      desc:'In-memory data store & cache' },
  mongodb:    { icon:'🍃', label:'MongoDB',    desc:'Flexible document database' },
};
const ENGINE_VERSIONS: Record<string, string[]> = {
  postgresql:['16','15','14','13'], mysql:['8.4','8.0','5.7'], redis:['7.2','7.0','6.2'], mongodb:['7.0','6.0','5.0'],
};
const REGIONS = [
  {id:'us-east-1',label:'US East (Virginia)',flag:'🇺🇸'},
  {id:'us-west-2',label:'US West (Oregon)',flag:'🇺🇸'},
  {id:'eu-west-1',label:'EU West (Ireland)',flag:'🇪🇺'},
  {id:'ap-south-1',label:'AP South (Mumbai)',flag:'🇮🇳'},
  {id:'ap-southeast-1',label:'AP Southeast (Singapore)',flag:'🇸🇬'},
];

export default function NewDatabase() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<CreateDatabaseForm>({...DEFAULT});
  const [plans, setPlans]   = useState<PlanConfig[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { api.getPlans().then(r => setPlans(r.plans)).catch(()=>{}); }, []);

  const set = <K extends keyof CreateDatabaseForm>(k: K, v: CreateDatabaseForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const plan = plans.find(p => p.tier === form.plan);

  const submit = async () => {
    if (!form.name) { setError('Database name is required'); return; }
    setError(''); setSubmitting(true);
    try {
      const { database } = await api.createDatabase(form);
      navigate(`/db/${database.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create database');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth:680 }} className="animate-in">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, marginBottom:3 }}>New Database</h1>
        <p style={{ color:'var(--text-muted)', fontSize:12 }}>Deploy a real Kubernetes-managed database</p>
      </div>

      {/* Step indicator */}
      <div style={{ display:'flex', gap:2, background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:5, marginBottom:24, width:'fit-content' }}>
        {STEPS.map((s,i) => (
          <div key={s} onClick={()=>i<step&&setStep(i)} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, cursor:i<step?'pointer':'default', background:i===step?'var(--accent)':'transparent', color:i===step?'#000':i<step?'var(--accent)':'var(--text-dim)', fontWeight:i===step?700:400, display:'flex', alignItems:'center', gap:5 }}>
            {i < step && <Check size={10} />}{s}
          </div>
        ))}
      </div>

      {/* Step panels */}
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12, padding:26 }}>

        {/* Step 0: Engine */}
        {step === 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <Input label="Database Name" placeholder="my-production-db" value={form.name}
              onChange={e=>set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
              hint="Lowercase letters, numbers, and hyphens only" />
            <div>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Engine</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                {Object.entries(ENGINE_INFO).map(([k,v]) => (
                  <div key={k} onClick={()=>{set('engine',k as CreateDatabaseForm['engine']);set('version',ENGINE_VERSIONS[k][0]);}}
                    style={{ padding:'12px 14px', borderRadius:8, cursor:'pointer', border:`1px solid ${form.engine===k?'var(--accent)':'var(--border)'}`, background:form.engine===k?'var(--accent-dim)':'var(--bg-1)', transition:'all 0.15s' }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{v.icon}</div>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>{v.label}</div>
                    <div style={{ fontSize:10, color:'var(--text-dim)' }}>{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <Select label="Version" value={form.version} onChange={e=>set('version',e.target.value)}>
                {ENGINE_VERSIONS[form.engine].map(v=><option key={v}>{v}</option>)}
              </Select>
              <Select label="Region" value={form.region} onChange={e=>set('region',e.target.value as CreateDatabaseForm['region'])}>
                {REGIONS.map(r=><option key={r.id} value={r.id}>{r.flag} {r.label}</option>)}
              </Select>
            </div>
          </div>
        )}

        {/* Step 1: Resources */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Plan</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                {plans.map(p => (
                  <div key={p.tier} onClick={()=>set('plan',p.tier)}
                    style={{ padding:'12px 14px', borderRadius:8, cursor:'pointer', border:`1px solid ${form.plan===p.tier?'var(--accent)':'var(--border)'}`, background:form.plan===p.tier?'var(--accent-dim)':'var(--bg-1)', transition:'all 0.15s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontWeight:700, fontSize:13, fontFamily:'var(--font-display)' }}>{p.label}</span>
                      <span style={{ fontSize:12, color:p.pricePerHour===0?'var(--accent)':'var(--text-muted)' }}>{p.pricePerHour===0?'Free':`$${p.pricePerHour}/hr`}</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-dim)' }}>{p.cpuMillicores}m CPU · {p.memoryMB>=1024?`${p.memoryMB/1024}GB`:`${p.memoryMB}MB`} RAM</div>
                  </div>
                ))}
              </div>
            </div>
            <RangeInput label="Storage" min={1} max={plan?.storageGB??100} value={Math.min(form.storageGB,plan?.storageGB??100)} onChange={v=>set('storageGB',v)} unit=" GB" />
            <RangeInput label="Max Connections" min={5} max={plan?.maxConnections??500} value={Math.min(form.maxConnections,plan?.maxConnections??500)} onChange={v=>set('maxConnections',v)} />
            <Toggle label="Connection Pooling (PgBouncer)" checked={form.connectionPooling} onChange={v=>set('connectionPooling',v)} />
            <Toggle label="High Availability (Multi-AZ)" checked={form.highAvailability} onChange={v=>set('highAvailability',v)} />
          </div>
        )}

        {/* Step 2: Scaling */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ padding:'8px 12px', background:'rgba(0,255,157,0.06)', border:'1px solid rgba(0,255,157,0.15)', borderRadius:6, fontSize:11, color:'var(--accent)' }}>
              ⚡ HPA (HorizontalPodAutoscaler) will be created in Kubernetes to manage replica scaling
            </div>
            <RangeInput label="Write Replicas (StatefulSet)" min={1} max={plan?.maxReplicas??5} value={form.replicas} onChange={v=>set('replicas',v)} />
            <RangeInput label="Read Replicas (Deployment)" min={0} max={Math.min(10,plan?.maxReplicas??5)} value={form.readReplicas} onChange={v=>set('readReplicas',v)} />
            <Toggle label="Enable Autoscaling (HPA)" checked={form.autoscaling} onChange={v=>set('autoscaling',v)} />
            {form.autoscaling && <RangeInput label="HPA Max Replicas" min={form.replicas} max={plan?.maxReplicas??20} value={Math.max(form.maxReplicas,form.replicas)} onChange={v=>set('maxReplicas',v)} />}
            <div style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, padding:12, fontSize:11 }}>
              <div style={{ color:'var(--text-muted)', marginBottom:8 }}>K8s Resources Summary</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, color:'var(--text-dim)' }}>
                {[['CPU/pod',`${plan?.cpuMillicores}m`],['Memory/pod',`${plan?.memoryMB}Mi`],['Write pods',`${form.replicas}×`],['Read pods',`${form.readReplicas}×`],['HPA max',form.autoscaling?`${Math.max(form.maxReplicas,form.replicas)}×`:'—'],['Storage','fast-ssd']].map(([k,v])=>(
                  <span key={k}>{k}: <b style={{ color:'var(--accent)' }}>{v}</b></span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Backups */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <Toggle label="Enable Automated Backups (CronJob)" checked={form.backupEnabled} onChange={v=>set('backupEnabled',v)} />
            {form.backupEnabled && <RangeInput label="Retention Period" min={1} max={30} value={form.backupRetentionDays} onChange={v=>set('backupRetentionDays',v)} unit=" days" />}
            <div style={{ padding:'10px 12px', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:6, fontSize:11, color:'var(--text-muted)', lineHeight:1.7 }}>
              Backups run as Kubernetes CronJobs, stored in S3-compatible object storage, encrypted at rest (AES-256).
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15, marginBottom:14 }}>Review & Deploy</div>
            {[
              ['Name',         form.name || '—'],
              ['Engine',       `${form.engine} v${form.version}`],
              ['Region',       form.region],
              ['Plan',         `${form.plan}${plan?` ($${plan.pricePerHour}/hr)`:''}` ],
              ['Storage',      `${form.storageGB} GB`],
              ['Write Replicas',`${form.replicas}×`],
              ['Read Replicas', `${form.readReplicas}×`],
              ['Autoscaling',  form.autoscaling?`Yes (max ${form.maxReplicas}×)`:'Disabled'],
              ['Conn. Pooling', form.connectionPooling?'Enabled':'Disabled'],
              ['High Avail.',  form.highAvailability?'Enabled':'Disabled'],
              ['Backups',      form.backupEnabled?`${form.backupRetentionDays}d retention`:'Disabled'],
            ].map(([k,v])=>(
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{k}</span>
                <span style={{ fontSize:12, color:'var(--text)', fontWeight:500 }}>{v}</span>
              </div>
            ))}
            {error && <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)', borderRadius:6, color:'var(--red)', fontSize:12 }}>{error}</div>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
        <Btn variant="outline" onClick={()=>step>0?setStep(s=>s-1):navigate('/')} disabled={submitting}>
          <ChevronLeft size={13} />{step===0?'Cancel':'Back'}
        </Btn>
        {step < STEPS.length - 1
          ? <Btn variant="primary" onClick={()=>setStep(s=>s+1)} disabled={step===0&&!form.name}>
              Next <ChevronRight size={13} />
            </Btn>
          : <Btn variant="primary" onClick={submit} disabled={submitting||!form.name}>
              {submitting?<><Spinner size={13} color="#000" /> Deploying…</>:<><Zap size={13} /> Deploy Database</>}
            </Btn>
        }
      </div>
    </div>
  );
}
