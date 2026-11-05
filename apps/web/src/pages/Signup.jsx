import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Step 1: Account info, Step 2: Social media linking
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: '', email: '', password: '', organizationName: '', organizationSlug: '',
  });

  // Providers & Channel Linking State
  const [providers, setProviders] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [channelDetails, setChannelDetails] = useState({
    facebook: { handle: '', pageName: '' },
    instagram: { handle: '', pageName: '' },
    x: { handle: '', pageName: '' },
    linkedin: { handle: '', pageName: '' },
    youtube: { handle: '', pageName: '' },
    tiktok: { handle: '', pageName: '' },
  });

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState([]);

  useEffect(() => {
    api.providers()
      .then((res) => setProviders(res.providers || []))
      .catch(() => {
        // Fallback default supported list if not yet authenticated
        setProviders([
          { name: 'facebook', configured: false, supportedCapabilities: ['publish_posts'] },
          { name: 'instagram', configured: false, supportedCapabilities: ['publish_posts'] },
          { name: 'x', configured: false, supportedCapabilities: ['publish_posts'] },
          { name: 'linkedin', configured: false, supportedCapabilities: ['publish_posts'] },
          { name: 'youtube', configured: false, supportedCapabilities: ['publish_posts'] },
          { name: 'tiktok', configured: false, supportedCapabilities: ['publish_posts'] },
        ]);
      });
  }, []);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Step 1: Create Organization & User
  const handleAccountCreation = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(form);
      // Move to Step 2: Link Social Media Channels
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleChannel = (pName) => {
    if (selectedChannels.includes(pName)) {
      setSelectedChannels(selectedChannels.filter((c) => c !== pName));
    } else {
      setSelectedChannels([...selectedChannels, pName]);
    }
  };

  const updateChannelDetail = (provider, field, val) => {
    setChannelDetails((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: val,
      },
    }));
  };

  // Step 2: Link selected channels and proceed to dashboard
  const handleLinkChannelsAndFinish = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const provider of selectedChannels) {
        const detail = channelDetails[provider] || {};
        const displayName = detail.pageName?.trim() || `${form.organizationName} on ${provider.toUpperCase()}`;
        const handle = detail.handle?.trim() || form.organizationSlug;

        await api.connectDirect({
          provider,
          displayName,
          pageHandle: handle,
          accountType: provider === 'youtube' ? 'channel' : 'page',
        });
      }
      navigate('/accounts');
    } catch (err) {
      setError(`Channel linking notice: ${err.message}. You can also connect them under Accounts.`);
      setTimeout(() => navigate('/accounts'), 2500);
    } finally {
      setBusy(false);
    }
  };

  const providerIcons = {
    facebook: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    x: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    linkedin: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
      </svg>
    ),
    youtube: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    tiktok: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12.525.02c1.31 0 2.6.35 3.73 1.01a7.48 7.48 0 0 0 2.76 3.73 7.84 7.84 0 0 0 4.96.99V9.5a11.53 11.53 0 0 1-4.99-.95v7.69a7.74 7.74 0 1 1-7.74-7.74c.43 0 .86.04 1.28.11v3.91a3.83 3.83 0 1 0 2.56 3.63V.02h-2.56z"/>
      </svg>
    ),
  };

  return (
    <div className="auth">
      <div className="auth-glow-1"></div>
      <div className="auth-glow-2"></div>

      <div className="card" style={{ maxWidth: step === 1 ? '480px' : '720px', width: '100%' }}>
        {/* Progress Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              width: '26px', height: '26px', borderRadius: '50%', 
              background: step === 1 ? 'var(--synora-indigo)' : 'var(--synora-emerald)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '12px', fontWeight: 'bold' 
            }}>
              {step > 1 ? '✓' : '1'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: step === 1 ? 'white' : 'var(--text-muted)' }}>
              Create Account
            </span>
          </div>

          <div style={{ width: '40px', height: '2px', background: step > 1 ? 'var(--synora-emerald)' : 'rgba(255,255,255,0.1)' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              width: '26px', height: '26px', borderRadius: '50%', 
              background: step === 2 ? 'var(--synora-indigo)' : 'rgba(255,255,255,0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '12px', fontWeight: 'bold', color: step === 2 ? 'white' : 'var(--text-muted)' 
            }}>
              2
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: step === 2 ? 'white' : 'var(--text-muted)' }}>
              Link Social Channels
            </span>
          </div>
        </div>

        {/* Brand Header */}
        <div className="auth-header" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent-gradient)', marginBottom: '10px', boxShadow: 'var(--glow-indigo)' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="brand-title" style={{ fontSize: '24px' }}>SYNORA</h1>
          <p style={{ margin: '4px 0 0 0' }}>
            {step === 1 ? 'Initialize AI Autonomous Workspace' : `Welcome, ${form.name}! Connect your brand's social media presence.`}
          </p>
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

        {/* STEP 1: Registration Form */}
        {step === 1 && (
          <form onSubmit={handleAccountCreation}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label>
                Operator Name
                <input 
                  placeholder="e.g. Alex Vance" 
                  value={form.name} 
                  onChange={update('name')} 
                  required 
                />
              </label>
              <label>
                Organization Name
                <input 
                  placeholder="e.g. Acme Media Group" 
                  value={form.organizationName} 
                  onChange={update('organizationName')} 
                  required 
                />
              </label>
            </div>

            <label>
              Workspace Slug (Unique identifier)
              <input 
                placeholder="acme-media" 
                value={form.organizationSlug} 
                onChange={update('organizationSlug')} 
                minLength={2} 
                maxLength={200} 
                required 
              />
            </label>

            <label>
              Operator Email
              <input 
                type="email" 
                placeholder="alex@acme.com" 
                value={form.email} 
                onChange={update('email')} 
                required 
              />
            </label>

            <label>
              Password
              <input 
                type="password" 
                placeholder="At least 6 characters" 
                value={form.password} 
                onChange={update('password')} 
                minLength={6} 
                maxLength={200} 
                required 
              />
            </label>

            <button 
              disabled={busy} 
              type="submit" 
              style={{ width: '100%', marginTop: '16px', padding: '12px' }}
            >
              {busy ? 'Setting up Workspace…' : 'Continue to Link Social Media →'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Already registered? <Link to="/login" style={{ color: 'var(--synora-cyan)', fontWeight: '600' }}>Sign In</Link>
            </p>
          </form>
        )}

        {/* STEP 2: Link Social Media Channels */}
        {step === 2 && (
          <div>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, color: '#c7d2fe', fontSize: '14px' }}>⚡ Connect Synora to your Brand Channels</h4>
              <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                Select the platforms you manage. You can link your official business pages, creator accounts, or handle names directly to enable immediate AI dispatching and monitoring.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {providers.map((p) => {
                const isSelected = selectedChannels.includes(p.name);
                return (
                  <div 
                    key={p.name}
                    onClick={() => toggleChannel(p.name)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '12px',
                      padding: '14px',
                      border: isSelected ? '1px solid var(--synora-cyan)' : '1px solid var(--border-glass)',
                      background: isSelected ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(99, 102, 241, 0.15))' : 'rgba(15, 23, 42, 0.5)',
                      boxShadow: isSelected ? 'var(--glow-cyan)' : 'none',
                      transition: 'var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ color: isSelected ? 'var(--synora-cyan)' : '#94a3b8' }}>
                      {providerIcons[p.name] || '🌐'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '14px', color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '10px', color: isSelected ? 'var(--synora-cyan)' : 'var(--text-muted)' }}>
                        {isSelected ? '✓ Selected to link' : 'Click to select'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom page configuration inputs for selected channels */}
            {selectedChannels.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '12px', color: '#ffffff' }}>Page Details for Selected Channels</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                  {selectedChannels.map((pName) => (
                    <div key={pName} style={{ background: 'rgba(11, 17, 33, 0.7)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--synora-cyan)' }}>{providerIcons[pName]}</span>
                        <strong style={{ textTransform: 'capitalize', fontSize: '13px' }}>{pName} Channel Configuration</strong>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <label style={{ margin: 0, fontSize: '11px' }}>
                          Page / Brand Display Name
                          <input 
                            placeholder={`${form.organizationName || 'Brand'} ${pName}`}
                            value={channelDetails[pName]?.pageName || ''}
                            onChange={(e) => updateChannelDetail(pName, 'pageName', e.target.value)}
                          />
                        </label>
                        <label style={{ margin: 0, fontSize: '11px' }}>
                          Handle / Page URL Identifier
                          <input 
                            placeholder={`@${form.organizationSlug || 'brand'}`}
                            value={channelDetails[pName]?.handle || ''}
                            onChange={(e) => updateChannelDetail(pName, 'handle', e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button 
                type="button" 
                className="btn-ghost" 
                onClick={() => navigate('/accounts')}
                disabled={busy}
              >
                Skip for now
              </button>

              <button 
                type="button" 
                onClick={handleLinkChannelsAndFinish}
                disabled={busy}
                style={{ padding: '10px 22px' }}
              >
                {busy ? 'Linking Channels…' : selectedChannels.length > 0 ? `Link ${selectedChannels.length} Channel(s) & Enter Synora →` : 'Enter Synora →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}