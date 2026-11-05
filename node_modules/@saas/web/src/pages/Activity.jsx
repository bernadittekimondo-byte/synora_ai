import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Activity() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.audit().then((d) => setEntries(d.audit)).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>System Telemetry & Audit Logs</h2>
        <p className="muted" style={{ margin: '6px 0 0 0' }}>
          Cryptographically tracked execution timeline, automated triggers, and human operator interventions.
        </p>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Operator / Actor</th>
              <th>Action Executed</th>
              <th>Outcome</th>
              <th>Telemetry Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No telemetry logged yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'white' }}>{e.actor_type}</span>
                    {e.actor_id && (
                      <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: '6px' }}>
                        :{e.actor_id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="tag" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border-glass)', color: 'var(--text-main)' }}>
                      {e.action}
                    </span>
                  </td>
                  <td>
                    <span className={`outcome outcome-${e.outcome}`}>
                      ● {e.outcome}
                    </span>
                  </td>
                  <td className="details">
                    {JSON.stringify(e.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}