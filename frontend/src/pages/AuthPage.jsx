import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function AuthPage() {
  const [mode, setMode] = useState('register');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { authenticate } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault(); setError(''); setSubmitting(true);
    try { await authenticate(mode, form); navigate('/'); }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark light">O</span>orbit</div>
        <div className="story-copy">
          <span className="eyebrow"><Sparkles size={15} /> Beyond busywork</span>
          <h1>Turn scattered ideas into <em>steady momentum.</em></h1>
          <p>A thoughtful workspace where every task has context, every teammate knows their role, and progress feels obvious.</p>
          <div className="feature-pills"><span><Check size={15} />Flexible boards</span><span><Check size={15} />Clear permissions</span><span><Check size={15} />Focused collaboration</span></div>
        </div>
        <div className="auth-preview">
          <div className="preview-top"><i></i><i></i><i></i><b>Website refresh</b></div>
          <div className="preview-cols">
            <div><small>IDEAS <b>3</b></small><article><span className="mini-label coral"></span><strong>Refresh visual language</strong><p>Explore a warmer, more editorial direction.</p></article><article><span className="mini-label teal"></span><strong>Customer interviews</strong></article></div>
            <div><small>IN PROGRESS <b>2</b></small><article><span className="mini-label purple"></span><strong>Homepage prototype</strong><div className="mini-progress"><i></i></div></article><article className="ghost-card"></article></div>
            <div><small>DONE <b>4</b></small><article><span className="mini-label green"></span><strong>Content inventory</strong><p className="complete">✓ Complete</p></article></div>
          </div>
        </div>
        <p className="testimonial">“Orbit gives our work just enough structure — without getting in the way.” <b>— Jhon Paul M. Noquiana, Product Owner</b></p>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="mobile-brand"><span className="brand-mark">O</span>orbit</div>
          <h2>{mode === 'register' ? 'Create your workspace' : 'Welcome back'}</h2>
          <p>{mode === 'register' ? 'Start organizing better work in under a minute.' : 'Pick up right where your team left off.'}</p>
          <div className="auth-tabs"><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Sign up</button><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button></div>
          <form onSubmit={submit}>
            {mode === 'register' && <><label>Your name<input required autoComplete="name" placeholder="Ada Lovelace" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Workspace name <span>optional</span><input placeholder="Acme Studio" value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} /></label></>}
            <label>Email address<input required type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Password<div className="password-field"><input required minLength="8" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button auth-submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'register' ? 'Create my workspace' : 'Log in'}<ArrowRight size={18} /></button>
          </form>
          <small className="terms">By continuing, you agree to Orbit's Terms and Privacy Policy.</small>
        </div>
      </section>
    </div>
  );
}
