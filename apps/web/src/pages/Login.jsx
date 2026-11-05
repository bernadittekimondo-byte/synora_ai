import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-glow-1"></div>
      <div className="auth-glow-2"></div>
      
      <form className="card" onSubmit={submit}>
        <div className="auth-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-gradient)', marginBottom: '14px', boxShadow: 'var(--glow-indigo)' }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="brand-title">SYNORA</h1>
          <p>Autonomous AI Social Media Operations</p>
        </div>

        {error && (
          <div className="error">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <label>
          Operator Email
          <input 
            type="email" 
            placeholder="operator@synora.ai"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </label>
        
        <label>
          Access Key / Password
          <input 
            type="password" 
            placeholder="••••••••••••"
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </label>

        <button 
          disabled={busy} 
          type="submit" 
          style={{ width: '100%', marginTop: '14px', padding: '12px' }}
        >
          {busy ? 'Authenticating…' : 'Enter Synora Control'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Need access credentials? <Link to="/signup" style={{ color: 'var(--synora-cyan)', fontWeight: '600' }}>Register Workspace</Link>
        </p>
      </form>
    </div>
  );
}