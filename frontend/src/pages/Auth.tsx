import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Input, Btn, Spinner } from '../components/ui';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:20 }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse-glow 2s infinite', fontSize:20 }}>☸</div>
            <span style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--text)' }}>DBCloud</span>
          </div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{title}</div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>{subtitle}</div>
        </div>

        {/* Card */}
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:14, padding:28 }}>
          {children}
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'var(--text-dim)' }}>
          Kubernetes-native · Enterprise-grade · Open source
        </div>
      </div>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ email:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your DBCloud account">
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <Input label="Email" type="email" placeholder="you@example.com" value={form.email}
          onChange={e=>setForm(f=>({...f,email:e.target.value}))} required autoFocus />
        <Input label="Password" type="password" placeholder="••••••••" value={form.password}
          onChange={e=>setForm(f=>({...f,password:e.target.value}))} required />

        {error && (
          <div style={{ padding:'10px 14px', background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)', borderRadius:6, color:'var(--red)', fontSize:12 }}>
            {error}
          </div>
        )}

        <Btn variant="primary" type="submit" disabled={loading} style={{ justifyContent:'center', padding:'10px' }}>
          {loading ? <><Spinner size={14} color="#000" /> Signing in...</> : 'Sign In'}
        </Btn>
      </form>

      <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid var(--border)', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ color:'var(--accent)' }}>Create one →</Link>
      </div>
    </AuthLayout>
  );
}

// ── Register ───────────────────────────────────────────────────
export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ username:'', email:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="Start deploying databases in seconds">
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <Input label="Username" placeholder="johndoe" value={form.username}
          onChange={e=>setForm(f=>({...f,username:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')}))}
          hint="Letters, numbers, underscores only" required autoFocus />
        <Input label="Email" type="email" placeholder="you@example.com" value={form.email}
          onChange={e=>setForm(f=>({...f,email:e.target.value}))} required />
        <Input label="Password" type="password" placeholder="Min 8 characters" value={form.password}
          onChange={e=>setForm(f=>({...f,password:e.target.value}))} required />
        <Input label="Confirm Password" type="password" placeholder="Repeat password" value={form.confirm}
          onChange={e=>setForm(f=>({...f,confirm:e.target.value}))} required />

        {error && (
          <div style={{ padding:'10px 14px', background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)', borderRadius:6, color:'var(--red)', fontSize:12 }}>
            {error}
          </div>
        )}

        <Btn variant="primary" type="submit" disabled={loading} style={{ justifyContent:'center', padding:'10px', marginTop:4 }}>
          {loading ? <><Spinner size={14} color="#000" /> Creating account...</> : 'Create Account'}
        </Btn>
      </form>

      <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid var(--border)', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color:'var(--accent)' }}>Sign in →</Link>
      </div>
    </AuthLayout>
  );
}
