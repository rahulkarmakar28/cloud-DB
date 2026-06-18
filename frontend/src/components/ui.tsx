import React, { useState } from 'react';
import type { DBEngine, DBStatus } from '../types';

// ── Status badge ───────────────────────────────────────────────
const STATUS_STYLE: Record<DBStatus, React.CSSProperties> = {
  running:      { color:'#3fb950', background:'rgba(63,185,80,0.1)',   border:'1px solid rgba(63,185,80,0.3)' },
  provisioning: { color:'#d29922', background:'rgba(210,153,34,0.1)',  border:'1px solid rgba(210,153,34,0.3)' },
  scaling:      { color:'#58a6ff', background:'rgba(88,166,255,0.1)',  border:'1px solid rgba(88,166,255,0.3)' },
  paused:       { color:'#7d8590', background:'rgba(125,133,144,0.1)', border:'1px solid rgba(125,133,144,0.3)' },
  error:        { color:'#f85149', background:'rgba(248,81,73,0.1)',   border:'1px solid rgba(248,81,73,0.3)' },
  terminated:   { color:'#484f58', background:'rgba(72,79,88,0.1)',    border:'1px solid rgba(72,79,88,0.3)' },
};
const DOT_COLOR: Record<DBStatus, string> = {
  running:'#3fb950', provisioning:'#d29922', scaling:'#58a6ff',
  paused:'#7d8590', error:'#f85149', terminated:'#484f58',
};

export function StatusBadge({ status }: { status: DBStatus }) {
  const dot = DOT_COLOR[status] ?? '#484f58';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:600, letterSpacing:'0.05em', ...STATUS_STYLE[status] }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:dot, ...(status==='running'?{boxShadow:`0 0 5px ${dot}`}:{}), ...(status==='provisioning'?{animation:'blink 1s infinite'}:{}) }} />
      {status}
    </span>
  );
}

// ── Engine icon ────────────────────────────────────────────────
const ENG_COLOR: Record<DBEngine, string> = { postgresql:'#336791', mysql:'#f29111', redis:'#d82c20', mongodb:'#4db33d' };
const ENG_LABEL: Record<DBEngine, string> = { postgresql:'PG', mysql:'MY', redis:'RD', mongodb:'MG' };

export function EngineIcon({ engine, size=32 }: { engine: DBEngine; size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:6, background:ENG_COLOR[engine]+'22', border:`1px solid ${ENG_COLOR[engine]}44`, display:'flex', alignItems:'center', justifyContent:'center', color:ENG_COLOR[engine], fontWeight:700, fontSize:size*0.28, flexShrink:0 }}>
      {ENG_LABEL[engine]}
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:20, ...style }}>{children}</div>;
}

// ── Button ─────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'outline';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
}
const BTN_STYLES: Record<BtnVariant, React.CSSProperties> = {
  primary: { background:'var(--accent)', color:'#000', border:'1px solid var(--accent)', fontWeight:700 },
  ghost:   { background:'transparent', color:'var(--text-muted)', border:'1px solid transparent' },
  danger:  { background:'rgba(248,81,73,0.1)', color:'var(--red)', border:'1px solid rgba(248,81,73,0.3)' },
  outline: { background:'transparent', color:'var(--text)', border:'1px solid var(--border-bright)' },
};
export function Btn({ children, variant='ghost', size='md', style, disabled, ...rest }: BtnProps) {
  return (
    <button disabled={disabled} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:size==='sm'?'4px 10px':'8px 16px', fontSize:size==='sm'?11:13, borderRadius:6, cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit', transition:'all 0.15s', opacity:disabled?0.5:1, ...BTN_STYLES[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

// ── Input ──────────────────────────────────────────────────────
export function Input({ label, hint, style, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</label>}
      <input
        style={{ width:'100%', padding:'8px 12px', background:'var(--bg-1)', border:`1px solid ${focused?'var(--accent)':'var(--border)'}`, borderRadius:6, color:'var(--text)', fontSize:13, outline:'none', transition:'border-color 0.15s', ...style }}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        {...rest}
      />
      {hint && <p style={{ fontSize:10, color:'var(--text-dim)', marginTop:3 }}>{hint}</p>}
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────
export function Select({ label, style, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</label>}
      <select style={{ width:'100%', padding:'8px 12px', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontSize:13, outline:'none', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%237d8590' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', backgroundSize:16, paddingRight:32, ...style }} {...rest}>{children}</select>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked:boolean; onChange:(v:boolean)=>void; label?:string }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }}>
      <div onClick={()=>onChange(!checked)} style={{ width:36, height:20, borderRadius:10, position:'relative', background:checked?'var(--accent)':'var(--bg-3)', border:`1px solid ${checked?'var(--accent)':'var(--border-bright)'}`, transition:'all 0.2s', cursor:'pointer' }}>
        <div style={{ position:'absolute', top:2, left:checked?17:2, width:14, height:14, borderRadius:'50%', background:checked?'#000':'var(--text-muted)', transition:'left 0.2s' }} />
      </div>
      {label && <span style={{ fontSize:13, color:'var(--text-muted)' }}>{label}</span>}
    </label>
  );
}

// ── Range ──────────────────────────────────────────────────────
export function RangeInput({ label, min, max, value, onChange, unit='' }: { label:string; min:number; max:number; value:number; onChange:(v:number)=>void; unit?:string }) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
        <span style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(+e.target.value)} style={{ width:'100%', accentColor:'var(--accent)', cursor:'pointer', height:3 }} />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-dim)', marginTop:3 }}><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────
export function StatTile({ label, value, unit, color='var(--accent)' }: { label:string; value:string|number; unit?:string; color?:string }) {
  return (
    <div style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px' }}>
      <div style={{ fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'var(--font-display)' }}>
        {value}{unit&&<span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:3 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Copy field ─────────────────────────────────────────────────
export function CopyField({ value, label, secret=false }: { value:string; label?:string; secret?:boolean }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div>
      {label && <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</div>}
      <div style={{ display:'flex', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
        <code style={{ flex:1, padding:'7px 10px', fontSize:11, color:'var(--accent)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {secret&&!show?'●'.repeat(Math.min(value.length,20)):value}
        </code>
        {secret && <button onClick={()=>setShow(s=>!s)} style={{ padding:'7px 10px', background:'var(--bg-2)', border:'none', borderLeft:'1px solid var(--border)', color:'var(--text-muted)', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{show?'hide':'show'}</button>}
        <button onClick={copy} style={{ padding:'7px 10px', background:copied?'var(--accent-dim)':'var(--bg-2)', border:'none', borderLeft:'1px solid var(--border)', color:copied?'var(--accent)':'var(--text-muted)', fontSize:11, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' }}>{copied?'✓ copied':'copy'}</button>
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────
export function Spinner({ size=20, color='var(--accent)' }: { size?:number; color?:string }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', border:`2px solid var(--border)`, borderTopColor:color, animation:'spin 0.7s linear infinite', flexShrink:0 }} />;
}
