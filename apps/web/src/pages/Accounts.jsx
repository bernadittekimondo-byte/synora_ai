import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Link New Channel Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({
    provider: 'facebook',
    displayName: '',
    pageHandle: '',
    accountType: 'page',
  });
  const [linkBusy, setLinkBusy] = useState(false);

  const load = () => api.accounts().then((d) => setAccounts(d.accounts));
  useEffect(() => { load(); }, []);

  const openAccount = async (account) => {
    setSelected(account);
    const caps = await api.accountCapabilities(account.id);
    setCapabilities(caps.capabilities);
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const fresh = (await api.accounts()).accounts.find((a) => a.id === selected.id);
    setSelected(fresh);
    const caps = await api.accountCapabilities(selected.id);
    setCapabilities(caps.capabilities);
  };

  const run = async (fn, label) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(`${label} verified successfully`); await load(); await refreshSelected(); }
    catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setBusy(false); }
  };

  const updateSetting = async (key, value) => {
    await api.updateAccountSettings(selected.id, { [key]: value });
    await refreshSelected();
  };

  const handleLinkChannel = async (e) => {
    e.preventDefault();
    setLinkBusy(true);
    setMsg(null);
    try {
      const res = await api.connectDirect(linkForm);
      setMsg(`Successfully authorized and linked ${linkForm.displayName} on ${linkForm.provider.toUpperCase()}`);
      setShowLinkModal(false);
      setLinkForm({ provider: 'facebook', displayName: '', pageHandle: '', accountType: 'page' });
      await load();
      if (res.account) {
        openAccount(res.account);
      }
    } catch (err) {
      setMsg(`Failed to link channel: ${err.message}`);
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <div>
      {/* Executive Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="brand-badge">CONTROL CENTER</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Multi-Platform Governance & Autonomy Matrix</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '26px' }}>Social Accounts & Autonomous Controls</h2>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>
            Per-account permissions, independent capability grants, rate caps, and quiet-hour governance.
          </p>
        </div>

        <button onClick={() => setShowLinkModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Connect Corporate Page
        </button>
      </div>

      {msg && (
        <div className="info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{msg}</span>
          <button className="btn-ghost small" onClick={() => setMsg(null)} style={{ border: 'none', padding: '2px 8px' }}>✕</button>
        </div>
      )}

      <div className="accounts-layout">
        {/* Left Column: Account Directory */}
        <div className="accounts-list card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px' }}>
            <h4 style={{ margin: 0, fontSize: '13px' }}>Connected Channels</h4>
            <span className="brand-badge">{accounts.length} Active</span>
          </div>

          {accounts.length === 0 && (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
                No enterprise accounts linked yet.
              </p>
              <button className="small" onClick={() => setShowLinkModal(true)}>
                + Connect First Channel
              </button>
            </div>
          )}

          {accounts.map((a) => (
            <button
              key={a.id}
              className={`account-row ${selected && selected.id === a.id ? 'active' : ''}`}
              onClick={() => openAccount(a)}
            >
              <span className={`status status-${a.status}`}>{a.status}</span>
              <span className="account-name">{a.display_name}</span>
              <span className="provider">{a.provider}</span>
            </button>
          ))}
        </div>

        {/* Right Column: Account Configuration & Governance */}
        {selected ? (
          <div className="card account-detail">
            {/* Top Identity & Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selected.display_name}
                  <span className={`status status-${selected.status}`}>{selected.status}</span>
                </h3>
                <p className="muted" style={{ margin: '6px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  Platform: <strong style={{ color: 'var(--brand-secondary)', textTransform: 'uppercase' }}>{selected.provider}</strong> · Account ID: {selected.provider_account_id}
                </p>
              </div>

              <div className="actions" style={{ margin: 0 }}>
                <button disabled={busy} onClick={() => run(() => api.testAccount(selected.id), 'Connectivity Test')} className="btn-ghost small">
                  Test Connection
                </button>
                <button disabled={busy} onClick={() => run(() => api.activateAccount(selected.id), 'Agent Activation')} className="small">
                  Activate Automation
                </button>
                <button disabled={busy} className="btn-ghost small" onClick={() => run(() => api.pauseAccount(selected.id), 'Account Pause')}>
                  Pause Account
                </button>
                <button disabled={busy} className="btn-danger small" onClick={() => run(() => api.disconnectAccount(selected.id), 'Secure Disconnect')}>
                  Disconnect
                </button>
              </div>
            </div>

            {/* Section 1: Verified Capabilities Matrix */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-platinum)' }}>Verified Platform Capabilities</h4>
                <span className="muted" style={{ fontSize: '11px' }}>Enforced Fail-Closed Architecture</span>
              </div>
              <ul className="caps">
                {capabilities.map((c) => (
                  <li key={c.capability}>
                    <span className={c.granted && c.verified ? 'ok' : 'no'}>
                      {c.granted && c.verified ? '✓' : '✗'}
                    </span>
                    <span style={{ textTransform: 'capitalize' }}>{c.capability.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 2: Autonomous Engine Settings */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--text-platinum)', marginBottom: '10px' }}>Autonomous Engine Controls</h4>
              <div className="settings-grid">
                <Toggle label="Autonomous Publishing" value={selected.publishing_enabled} onChange={(v) => updateSetting('publishingEnabled', v)} />
                <Toggle label="Comment Moderation" value={selected.moderation_enabled} onChange={(v) => updateSetting('moderationEnabled', v)} />
                <Toggle label="Automatic Brand Replies" value={selected.replies_enabled} onChange={(v) => updateSetting('repliesEnabled', v)} />
                <Toggle label="Analytics & Performance" value={selected.analytics_enabled} onChange={(v) => updateSetting('analyticsEnabled', v)} />
                <Toggle label="Calendar Event Automation" value={selected.calendar_automation_enabled} onChange={(v) => updateSetting('calendarAutomationEnabled', v)} />
              </div>
            </div>

            {/* Section 3: Governance, Rate Limits & Quiet Hours */}
            <div>
              <h4 style={{ color: 'var(--text-platinum)', marginBottom: '10px' }}>Corporate Safeguards & Operational Windows</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <label style={{ margin: 0 }}>
                  Daily Dispatch Cap (Posts/day)
                  <input
                    type="number" 
                    min="0" 
                    max="1000"
                    defaultValue={selected.daily_limit}
                    onBlur={(e) => updateSetting('dailyLimit', Number(e.target.value))}
                  />
                </label>

                <label style={{ margin: 0 }}>
                  Quiet Hours Start (HH:MM UTC)
                  <input 
                    type="text" 
                    placeholder="22:00" 
                    defaultValue={selected.quiet_hours_start || ''}
                    onBlur={(e) => updateSetting('quietHoursStart', e.target.value || null)} 
                  />
                </label>

                <label style={{ margin: 0 }}>
                  Quiet Hours End (HH:MM UTC)
                  <input 
                    type="text" 
                    placeholder="07:00" 
                    defaultValue={selected.quiet_hours_end || ''}
                    onBlur={(e) => updateSetting('quietHoursEnd', e.target.value || null)} 
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px' }}>Select an account from the directory to review capabilities, automation controls, and safety bounds.</p>
            <button className="btn-ghost small" onClick={() => setShowLinkModal(true)} style={{ marginTop: '10px' }}>
              + Link a Corporate Social Page
            </button>
          </div>
        )}
      </div>

      {/* Corporate Connect Modal */}
      {showLinkModal && (
        <div className="modal-backdrop" onClick={() => setShowLinkModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Connect Corporate Channel</h3>
              <button className="btn-ghost small" onClick={() => setShowLinkModal(false)} style={{ border: 'none' }}>✕</button>
            </div>

            <form onSubmit={handleLinkChannel}>
              <label>
                Enterprise Platform
                <select 
                  value={linkForm.provider} 
                  onChange={(e) => setLinkForm({ ...linkForm, provider: e.target.value })}
                >
                  <option value="facebook">Facebook (Pages & Business)</option>
                  <option value="instagram">Instagram (Creator & Business)</option>
                  <option value="x">X / Twitter (Corporate Handle)</option>
                  <option value="linkedin">LinkedIn (Company Page)</option>
                  <option value="youtube">YouTube (Official Channel)</option>
                  <option value="tiktok">TikTok (Business Account)</option>
                </select>
              </label>

              <label>
                Page / Profile Display Name
                <input 
                  placeholder="e.g. Acme Corp Global"
                  value={linkForm.displayName}
                  onChange={(e) => setLinkForm({ ...linkForm, displayName: e.target.value })}
                  required
                />
              </label>

              <label>
                Platform Handle or Page Identifier
                <input 
                  placeholder="e.g. @acmecorp or 982341924"
                  value={linkForm.pageHandle}
                  onChange={(e) => setLinkForm({ ...linkForm, pageHandle: e.target.value })}
                />
              </label>

              <div style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '12px', color: '#cbd5e1' }}>
                💡 <strong>Enterprise OAuth:</strong> Want official OAuth app tokens? Configure your company's API Keys in <a href="/settings" style={{ color: '#38bdf8', fontWeight: 600 }}>Settings → API Keys</a>.
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowLinkModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={linkBusy}>
                  {linkBusy ? 'Authorizing…' : 'Authorize Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}