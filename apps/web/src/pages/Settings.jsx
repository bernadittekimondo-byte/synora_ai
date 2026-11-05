import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

const PROVIDER_METADATA = {
  facebook: {
    label: 'Meta / Facebook',
    icon: '📘',
    keyHelp: 'Enter your Meta App ID and App Secret from developers.facebook.com.',
    idLabel: 'Meta App ID (Client ID)',
    secretLabel: 'Meta App Secret (Client Secret)',
    defaultRedirect: 'http://localhost:4000/api/v1/social/connections/facebook/oauth/callback',
  },
  instagram: {
    label: 'Instagram Graph',
    icon: '📸',
    keyHelp: 'Enter your Meta Instagram App ID and App Secret.',
    idLabel: 'Instagram App ID',
    secretLabel: 'Instagram App Secret',
    defaultRedirect: 'http://localhost:4000/api/v1/social/connections/instagram/oauth/callback',
  },
  linkedin: {
    label: 'LinkedIn Marketing',
    icon: '💼',
    keyHelp: 'Obtain from developer.linkedin.com (Auth tab).',
    idLabel: 'LinkedIn Client ID',
    secretLabel: 'LinkedIn Primary Client Secret',
    defaultRedirect: 'http://localhost:4000/api/v1/social/connections/linkedin/oauth/callback',
  },
  x: {
    label: 'X (formerly Twitter)',
    icon: '𝕏',
    keyHelp: 'OAuth 2.0 Client ID and Client Secret from developer.x.com.',
    idLabel: 'OAuth 2.0 Client ID',
    secretLabel: 'OAuth 2.0 Client Secret',
    defaultRedirect: 'http://localhost:4000/api/v1/social/connections/x/oauth/callback',
  },
  youtube: {
    label: 'YouTube / Google API',
    icon: '▶️',
    keyHelp: 'OAuth 2.0 Client ID and Secret from console.cloud.google.com.',
    idLabel: 'Google Client ID',
    secretLabel: 'Google Client Secret',
    defaultRedirect: 'http://localhost:4000/api/v1/social/connections/youtube/oauth/callback',
  },
  tiktok: {
    label: 'TikTok for Developers',
    icon: '🎵',
    keyHelp: 'Client Key and Client Secret from developers.tiktok.com.',
    idLabel: 'TikTok Client Key',
    secretLabel: 'TikTok Client Secret',
    defaultRedirect: 'http://localhost:4000/api/v1/social/connections/tiktok/oauth/callback',
  },
};

export default function Settings() {
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [members, setMembers] = useState([]);
  const [params] = useSearchParams();
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // API Key Management Modal State
  const [configModalProvider, setConfigModalProvider] = useState(null);
  const [apiKeyForm, setApiKeyForm] = useState({ clientId: '', clientSecret: '' });
  const [savingKeys, setSavingKeys] = useState(false);

  const load = async () => {
    try {
      const [p, c, m] = await Promise.all([
        api.providers(),
        api.connections(),
        api.members().catch(() => ({ members: [] })),
      ]);
      setProviders(p.providers || []);
      setConnections(c.connections || []);
      setMembers(m.members || []);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const openConfigModal = (p) => {
    setConfigModalProvider(p);
    setApiKeyForm({
      clientId: p.customClientId || '',
      clientSecret: '',
    });
    setError(null);
  };

  const handleSaveApiKeys = async (e) => {
    e.preventDefault();
    if (!configModalProvider) return;
    setSavingKeys(true);
    setError(null);
    try {
      await api.setProviderCredentials(configModalProvider.name, {
        clientId: apiKeyForm.clientId,
        clientSecret: apiKeyForm.clientSecret,
      });
      setMessage(`Successfully saved API Keys for ${configModalProvider.name.toUpperCase()}. OAuth connection is now unlocked!`);
      setConfigModalProvider(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKeys(false);
    }
  };

  const handleDeleteApiKeys = async (providerName) => {
    if (!confirm(`Are you sure you want to remove custom API keys for ${providerName.toUpperCase()}?`)) return;
    try {
      await api.deleteProviderCredentials(providerName);
      setMessage(`Removed custom API keys for ${providerName.toUpperCase()}`);
      setConfigModalProvider(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const connect = async (providerName) => {
    setError(null);
    try {
      const { authorizationUrl } = await api.startOAuth(providerName);
      window.location.href = authorizationUrl;
    } catch (e) { 
      setError(e.message); 
    }
  };

  const disconnect = async (id) => {
    if (!confirm('Disconnect this OAuth provider connection? Linked social accounts will be set to disconnected.')) return;
    await api.deleteConnection(id);
    await load();
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="brand-badge">ENTERPRISE SECURITY & GOVERNANCE</span>
        </div>
        <h2 style={{ margin: 0, fontSize: '26px' }}>Settings, Social API Keys & OAuth</h2>
        <p className="muted" style={{ margin: '4px 0 0 0' }}>
          Configure custom social media API Keys, authorize official OAuth connectors, and manage tenant members.
        </p>
      </div>

      {params.get('oauth') === 'success' && (
        <div className="info">
          ✓ Verified OAuth handshake: Successfully connected provider <strong>{params.get('provider')}</strong>.
        </div>
      )}
      {params.get('oauth') === 'error' && (
        <div className="error">OAuth authorization handshake failed. Verify corporate client ID and secrets.</div>
      )}
      {params.get('oauth') === 'expired' && (
        <div className="error">OAuth state authorization timed out. Please initiate handshake again.</div>
      )}
      {message && (
        <div className="info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{message}</span>
          <button className="btn-ghost small" onClick={() => setMessage(null)} style={{ border: 'none', padding: '2px 8px' }}>✕</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {/* Corporate Team Members & RBAC */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Organization Team & Access Control</span>
          <span className="brand-badge">{members.length} Members</span>
        </h3>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Corporate Email</th>
                <th>Access Role</th>
                <th>Role Privileges</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading organization roster…
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'white' }}>{m.name}</span>
                    </td>
                    <td>{m.email}</td>
                    <td>
                      <span className="tag" style={{ textTransform: 'uppercase', color: m.role === 'owner' ? 'var(--brand-secondary)' : 'var(--text-primary)' }}>
                        {m.role}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: '12px' }}>
                      {m.role === 'owner' && 'Full Organization, Billing & Safety Control'}
                      {m.role === 'admin' && 'Manage Connections, Settings & Automation Policies'}
                      {m.role === 'editor' && 'Draft Posts, Events & Schedule Approved Content'}
                      {m.role === 'moderator' && 'Review Escalations & Moderate Comments'}
                      {m.role === 'viewer' && 'Read-Only Access'}
                    </td>
                    <td className="muted">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Available Platform Providers with API Key Management */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <span>Social Media Integrations & API Keys</span>
              <span className="brand-badge">{providers.length} Platforms</span>
            </h3>
            <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
              Add your corporate App Client IDs and Secrets to allow Synora to authenticate and post on your behalf.
            </p>
          </div>
        </div>

        <div className="grid">
          {providers.map((p) => {
            const meta = PROVIDER_METADATA[p.name] || {
              label: p.name,
              icon: '🔗',
              keyHelp: 'Client ID and Secret',
              idLabel: 'Client ID',
              secretLabel: 'Client Secret',
            };

            return (
              <div className="card" key={p.name} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0, padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{meta.icon}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', color: '#ffffff' }}>{meta.label}</h4>
                        <span className="muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>{p.name}</span>
                      </div>
                    </div>

                    <span className={`status ${p.configured ? 'status-active' : 'status-paused'}`} style={{ fontSize: '9px' }}>
                      {p.configured ? 'Configured' : 'Needs API Keys'}
                    </span>
                  </div>

                  <p className="muted" style={{ fontSize: '12px', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                    {p.supportedCapabilities.length} autonomous capabilities certified
                  </p>

                  {p.hasCustomKeys && (
                    <div style={{ marginBottom: '14px', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                        🔑 Custom App Keys Active
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ID: {p.customClientId?.slice(0, 14)}…
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <button
                    disabled={!p.configured}
                    onClick={() => connect(p.name)}
                    className={p.configured ? '' : 'btn-ghost'}
                    style={{ width: '100%' }}
                  >
                    {p.configured ? 'Authenticate via OAuth ↗' : 'Setup API Keys First'}
                  </button>

                  <button
                    type="button"
                    className="btn-ghost small"
                    onClick={() => openConfigModal(p)}
                    style={{ width: '100%', fontSize: '11px' }}
                  >
                    ⚙️ {p.hasCustomKeys ? 'Manage API Keys' : 'Configure API Keys'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Established Connections */}
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Active Vault Connections</span>
          <span className="brand-badge">{connections.length} Authorized</span>
        </h3>

        {connections.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
            No OAuth connections active. Authorize one of the corporate providers above.
          </div>
        ) : (
          <div className="grid">
            {connections.map((c) => (
              <div className="card" key={c.id} style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ textTransform: 'capitalize', margin: 0, fontSize: '15px' }}>{c.provider}</h4>
                    <span className={`status status-${c.status}`}>{c.status}</span>
                  </div>
                  <p className="muted" style={{ fontSize: '12px', margin: '4px 0' }}>
                    Account ID: <span style={{ color: 'white', fontFamily: 'var(--font-mono)' }}>{c.external_user_id}</span>
                  </p>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <button className="btn-danger small" style={{ width: '100%' }} onClick={() => disconnect(c.id)}>
                    Revoke & Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configure Provider API Keys Modal */}
      {configModalProvider && (
        <div className="modal-backdrop" onClick={() => setConfigModalProvider(null)}>
          <div className="modal card" style={{ maxWidth: '540px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-corp)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>
                  {PROVIDER_METADATA[configModalProvider.name]?.icon || '🔑'}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>
                    Configure {PROVIDER_METADATA[configModalProvider.name]?.label || configModalProvider.name} API Keys
                  </h3>
                  <span className="muted" style={{ fontSize: '12px' }}>
                    Encrypted tenant-level credential vault
                  </span>
                </div>
              </div>
              <button className="btn-ghost small" onClick={() => setConfigModalProvider(null)} style={{ border: 'none' }}>✕</button>
            </div>

            <form onSubmit={handleSaveApiKeys}>
              <div style={{ padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '16px', fontSize: '12px', color: '#cbd5e1' }}>
                💡 <strong>Setup Guidance:</strong> {PROVIDER_METADATA[configModalProvider.name]?.keyHelp}
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                  OAuth Redirect URL to register:
                  <div style={{ fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', marginTop: '3px', wordBreak: 'break-all', color: '#38bdf8' }}>
                    {PROVIDER_METADATA[configModalProvider.name]?.defaultRedirect}
                  </div>
                </div>
              </div>

              <label>
                {PROVIDER_METADATA[configModalProvider.name]?.idLabel || 'Client ID / App Key'}
                <input
                  placeholder="e.g. 1092837465..."
                  value={apiKeyForm.clientId}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, clientId: e.target.value })}
                  required
                />
              </label>

              <label>
                {PROVIDER_METADATA[configModalProvider.name]?.secretLabel || 'Client Secret'}
                <input
                  type="password"
                  placeholder={configModalProvider.hasCustomKeys ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter Client Secret from developer console'}
                  value={apiKeyForm.clientSecret}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, clientSecret: e.target.value })}
                  required={!configModalProvider.hasCustomKeys}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                {configModalProvider.hasCustomKeys ? (
                  <button
                    type="button"
                    className="btn-danger small"
                    onClick={() => handleDeleteApiKeys(configModalProvider.name)}
                  >
                    Delete Custom Keys
                  </button>
                ) : <span />}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-ghost" onClick={() => setConfigModalProvider(null)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingKeys}>
                    {savingKeys ? 'Encrypting & Saving…' : 'Save & Unlock Provider'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}