import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Moderation() {
  const [cases, setCases] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [message, setMessage] = useState(null);

  const load = () => api.moderationCases(filter).then((d) => setCases(d.cases));
  useEffect(() => { load(); }, [filter]);

  const resolve = async (id, action) => {
    await api.resolveCase(id, { action });
    setMessage(`Case marked as ${action}d`);
    await load();
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Moderation Sentinel & Safety</h2>
        <p className="muted" style={{ margin: '6px 0 0 0' }}>
          Real-time toxicity scanning, brand safety guardrails, and automated classification pipeline.
        </p>
      </div>

      {message && (
        <div className="info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{message}</span>
          <button className="btn-ghost small" onClick={() => setMessage(null)} style={{ border: 'none', padding: '2px 8px' }}>✕</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filters">
        {['pending', 'escalated', 'resolved', 'rejected'].map((f) => (
          <button 
            key={f} 
            className={filter === f ? 'active' : ''} 
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          No moderation cases matching "{filter}". Feed health is nominal.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {cases.map((c) => (
            <div className="card moderation-case" key={c.id} style={{ margin: 0 }}>
              <div className="case-header">
                <div>
                  <strong style={{ fontSize: '16px', color: 'white' }}>{c.account_name}</strong>
                  <span className="muted" style={{ marginLeft: '8px', fontSize: '12px', textTransform: 'uppercase' }}>
                    [{c.provider}]
                  </span>
                </div>
                <span className={`severity severity-${c.severity || 'low'}`}>
                  {c.severity || 'LOW'} SEVERITY
                </span>
              </div>

              <div className="comment">
                "{c.content}"
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
                  Category: <strong style={{ color: 'var(--synora-cyan)' }}>{c.classification?.category || 'General'}</strong> · 
                  AI Confidence: <strong style={{ color: 'var(--text-main)' }}>{Math.round((c.classification?.confidence || 0) * 100)}%</strong>
                </p>

                {c.status === 'pending' && (
                  <div className="actions" style={{ margin: 0 }}>
                    <button onClick={() => resolve(c.id, 'approve')} className="small btn-success">
                      ✓ Approve
                    </button>
                    <button className="btn-ghost small" onClick={() => resolve(c.id, 'reject')}>
                      ✕ Reject
                    </button>
                    <button className="btn-danger small" onClick={() => resolve(c.id, 'escalate')}>
                      ⚠ Escalate
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}