import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Plus, BookOpen, Settings, LogOut, Cpu } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const NAV = [
  { to:'/', icon:LayoutDashboard, label:'Dashboard' },
  { to:'/new', icon:Plus, label:'New Database' },
  { to:'/docs', icon:BookOpen, label:'Docs' },
  { to:'/settings', icon:Settings, label:'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside style={{ width:220, minHeight:'100vh', background:'var(--bg-1)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'16px 0', position:'fixed', top:0, left:0, zIndex:100 }}>
      {/* Logo */}
      <div style={{ padding:'0 16px 16px', borderBottom:'1px solid var(--border)', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse-glow 2s infinite' }}>
            <Cpu size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>DBCloud</div>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>k8s-native</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'0 8px', display:'flex', flexDirection:'column', gap:2 }}>
        {NAV.map(({ to, icon:Icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
            display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:6,
            fontSize:12, color:isActive?'var(--accent)':'var(--text-muted)',
            background:isActive?'var(--accent-dim)':'transparent',
            border:`1px solid ${isActive?'rgba(0,255,157,0.2)':'transparent'}`,
            transition:'all 0.15s',
          })}>
            <Icon size={14} />{label}
          </NavLink>
        ))}
      </nav>

      {/* User + Cluster */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
        {/* Cluster status */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:9, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Cluster</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 5px var(--green)', display:'inline-block' }} />
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Healthy</span>
          </div>
          <div style={{ fontSize:10, color:'var(--text-dim)' }}>k8s 1.30 · metrics-server</div>
        </div>

        {/* User */}
        {user && (
          <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:1 }}>{user.username}</div>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
            <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-dim)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
              <LogOut size={11} /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
