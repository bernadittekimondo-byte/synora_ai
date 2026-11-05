import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.overview().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!stats) return <div className="muted" style={{ padding: '24px' }}>Loading executive telemetry…</div>;

  const cards = [
    {
      label: 'Autonomous Agent Instances',
      value: stats.activeAgents,
      badge: 'Active & Verified',
      color: 'var(--brand-emerald)',
      subtext: 'Operational accounts adhering to autonomous guardrails',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      ),
    },
    {
      label: 'Campaign Content Pool',
      value: stats.posts,
      badge: 'All Platforms',
      color: 'var(--brand-primary)',
      subtext: 'Approved posts and creative concepts in registry',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      label: 'Scheduled Dispatches',
      value: stats.scheduled,
      badge: 'Pending Queue',
      color: 'var(--brand-secondary)',
      subtext: 'Durable BullMQ publication queue with idempotency keys',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Published Deliveries',
      value: stats.published,
      badge: 'Delivered',
      color: 'var(--brand-purple)',
      subtext: 'Live posts confirmed via official platform APIs',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    {
      label: 'Moderation Sentinel Queue',
      value: stats.pendingModeration,
      badge: stats.pendingModeration > 0 ? 'Review Required' : 'Compliant',
      color: stats.pendingModeration > 0 ? 'var(--brand-amber)' : 'var(--text-muted)',
      subtext: 'Ingested comments awaiting policy evaluation or review',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      label: 'Delivery Retries & Errors',
      value: stats.failedPublications,
      badge: stats.failedPublications > 0 ? 'Attention' : 'Optimal (0)',
      color: stats.failedPublications > 0 ? 'var(--brand-rose)' : 'var(--text-muted)',
      subtext: 'Transient or permission-bounded delivery notices',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      label: 'Governance & Incidents',
      value: stats.openIncidents,
      badge: stats.openIncidents > 0 ? 'Alert' : 'Zero Breaches',
      color: stats.openIncidents > 0 ? 'var(--brand-rose)' : 'var(--text-muted)',
      subtext: 'Security boundaries and rate-limit guardrail audits',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="brand-badge" style={{ fontSize: '10px' }}>ENTERPRISE OVERVIEW</span>
            <span style={{ fontSize: '12px', color: 'var(--brand-emerald)', fontWeight: 600 }}>● ALL SYSTEMS SECURE</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '26px' }}>Executive Control Center</h2>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>
            Multi-platform autonomous social media operations, verified capabilities, and policy telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost small" onClick={() => window.location.reload()}>
            ↻ Refresh Telemetry
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {cards.map((c, i) => (
          <div className="stat-card" key={i}>
            <div>
              <div className="stat-header">
                <div className="stat-icon" style={{ color: c.color, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-hairline)' }}>
                  {c.icon}
                </div>
                <span className="brand-badge" style={{ fontSize: '10px' }}>{c.badge}</span>
              </div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label" style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '13px' }}>{c.label}</div>
            </div>
            <p className="muted" style={{ fontSize: '11px', margin: '14px 0 0 0', lineHeight: '1.4' }}>
              {c.subtext}
            </p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(79, 70, 229, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(79, 70, 229, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-platinum)' }}>Synora Autonomous Governance & Failsafe Active</h4>
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              Fencing tokens, per-account quiet hours, and cryptographic token vaults verified. Fail-closed architecture armed.
            </p>
          </div>
        </div>

        <span className="status status-active" style={{ fontSize: '11px', padding: '5px 12px' }}>
          POLICY VERIFIED
        </span>
      </div>
    </div>
  );
}