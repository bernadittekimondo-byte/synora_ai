import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [draft, setDraft] = useState({ 
    title: '', 
    body: '', 
    hashtags: '',
    generateMedia: false,
    generateMediaType: 'image',
    mediaUrls: [],
    mediaAsset: null,
  });
  const [schedule, setSchedule] = useState({ scheduledAt: '', accountIds: [] });
  const [schedulingFor, setSchedulingFor] = useState(null);
  const [message, setMessage] = useState(null);
  const [generatingMedia, setGeneratingMedia] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState(null);

  const load = async () => {
    const [p, a] = await Promise.all([api.posts(), api.accounts()]);
    setPosts(p.posts);
    setAccounts(a.accounts);
  };
  useEffect(() => { load(); }, []);

  const handleGenerateMediaForDraft = async (type) => {
    const prompt = draft.title || draft.body || 'Corporate breakthrough innovation';
    setGeneratingMedia(true);
    setMessage(null);
    try {
      const res = await api.generateMedia({
        prompt,
        type,
        platform: accounts[0]?.provider || 'linkedin',
        title: draft.title || 'Corporate Announcement',
      });
      if (res.asset) {
        setDraft((prev) => ({
          ...prev,
          generateMedia: true,
          generateMediaType: type,
          mediaUrls: [res.asset.url],
          mediaAsset: res.asset,
        }));
        setMessage(`AI ${type === 'video' ? 'Video storyboard' : 'Visual asset'} successfully generated!`);
      }
    } catch (err) {
      setMessage(`Media generation error: ${err.message}`);
    } finally {
      setGeneratingMedia(false);
    }
  };

  const createDraft = async (e) => {
    e.preventDefault();
    const hashtags = draft.hashtags.split(/\s+/).filter(Boolean);
    let finalMediaUrls = [...(draft.mediaUrls || [])];

    // Auto-generate if user checked the box but didn't click preview
    if (draft.generateMedia && finalMediaUrls.length === 0) {
      try {
        const prompt = draft.title || draft.body || 'Corporate innovation';
        const genRes = await api.generateMedia({
          prompt,
          type: draft.generateMediaType || 'image',
          platform: accounts[0]?.provider || 'linkedin',
          title: draft.title || 'Corporate Announcement',
        });
        if (genRes.asset?.url) {
          finalMediaUrls = [genRes.asset.url];
        }
      } catch (err) {
        console.warn('Auto media generation error:', err);
      }
    }

    await api.createPost({ 
      title: draft.title || undefined, 
      body: draft.body, 
      hashtags,
      mediaUrls: finalMediaUrls,
    });
    setDraft({ 
      title: '', 
      body: '', 
      hashtags: '', 
      generateMedia: false, 
      generateMediaType: 'image', 
      mediaUrls: [], 
      mediaAsset: null 
    });
    setMessage('Draft created successfully');
    await load();
  };

  const openSchedule = (post) => {
    setSchedulingFor(post);
    setSchedule({
      scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16),
      accountIds: [],
    });
  };

  const confirmSchedule = async () => {
    if (!schedule.scheduledAt || schedule.accountIds.length === 0) {
      setMessage('Pick a time and at least one connected channel');
      return;
    }
    const res = await api.schedulePost(schedulingFor.id, {
      scheduledAt: new Date(schedule.scheduledAt).toISOString(),
      accountIds: schedule.accountIds,
    });
    const blocked = res.results.filter((r) => !r.decision.allowed);
    if (blocked.length) {
      setMessage(`Scheduled with ${blocked.length} blocked: ${blocked.map((b) => b.decision.reason).join('; ')}`);
    } else {
      setMessage('Post scheduled successfully across targeted channels');
    }
    setSchedulingFor(null);
    await load();
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Content Studio & Dispatch</h2>
        <p className="muted" style={{ margin: '6px 0 0 0' }}>
          Compose AI drafts, generate image/video assets, manage publishing lifecycle, and schedule cross-platform campaigns.
        </p>
      </div>

      {message && (
        <div className="info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{message}</span>
          <button className="btn-ghost small" onClick={() => setMessage(null)} style={{ border: 'none', padding: '2px 8px' }}>✕</button>
        </div>
      )}

      {/* Modern Composer Card */}
      <form className="card" onSubmit={createDraft} style={{ border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h3 style={{ margin: 0 }}>New Post Draft</h3>
        </div>

        <label>
          Campaign / Concept Title
          <input 
            placeholder="e.g. Q3 Autonomous Feature Showcase"
            value={draft.title} 
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} 
          />
        </label>

        <label>
          Post Body & Copy
          <textarea 
            rows={4}
            placeholder="Craft your copy or let Synora's suggestions guide you..."
            value={draft.body} 
            onChange={(e) => setDraft({ ...draft, body: e.target.value })} 
            required 
          />
        </label>

        <label>
          Hashtags & Tags
          <input 
            value={draft.hashtags} 
            placeholder="#AutonomousAI #Synora #TechInnovation" 
            onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} 
          />
        </label>

        {/* AI Media Generation Controls */}
        <div className="card" style={{ background: 'rgba(8, 12, 23, 0.7)', border: '1px solid var(--border-corp)', padding: '14px', margin: '14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✨</span> AI Visual & Video Generator
            </strong>
            <span className="muted" style={{ fontSize: '11px' }}>
              Autonomous Multimodal Asset Synthesis
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="toggle" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={draft.generateMedia && draft.generateMediaType === 'image'}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    generateMedia: e.target.checked,
                    generateMediaType: 'image',
                  });
                }}
              />
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                🖼️ <strong>Instruct AI to generate Image</strong> for this draft
              </span>
            </label>

            <label className="toggle" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={draft.generateMedia && draft.generateMediaType === 'video'}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    generateMedia: e.target.checked,
                    generateMediaType: 'video',
                  });
                }}
              />
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                🎬 <strong>Instruct AI to generate Video</strong> (Script & Reels/Shorts Storyboard)
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
            <button
              type="button"
              className="small btn-ghost"
              disabled={generatingMedia || (!draft.body && !draft.title)}
              onClick={() => handleGenerateMediaForDraft('image')}
            >
              {generatingMedia ? 'Generating…' : '✨ Generate Image Preview Now'}
            </button>
            <button
              type="button"
              className="small btn-ghost"
              disabled={generatingMedia || (!draft.body && !draft.title)}
              onClick={() => handleGenerateMediaForDraft('video')}
            >
              {generatingMedia ? 'Compiling…' : '🎬 Generate Video Preview Now'}
            </button>
          </div>

          {/* Attached Media Asset Preview */}
          {(draft.mediaUrls?.length > 0 || draft.mediaAsset) && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              {draft.mediaAsset?.type === 'video' ? (
                <div 
                  style={{ width: '100px', height: '60px', background: '#0f172a', borderRadius: '6px', overflow: 'hidden', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setActiveVideoModal(draft.mediaAsset)}
                >
                  <img src={draft.mediaAsset.posterUrl || draft.mediaAsset.thumbnailUrl} alt="Video preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>
                    ▶
                  </div>
                </div>
              ) : (
                <img 
                  src={draft.mediaUrls?.[0] || draft.mediaAsset?.url} 
                  alt="Draft attachment" 
                  style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} 
                />
              )}

              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>
                  {draft.mediaAsset?.type === 'video' ? '🎬 AI Video Reel Attached' : '🖼️ AI Visual Art Attached'}
                </span>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {draft.mediaAsset?.title || 'Attached to draft'}
                </div>
              </div>

              <button
                type="button"
                className="btn-danger small"
                onClick={() => setDraft({ ...draft, mediaUrls: [], mediaAsset: null, generateMedia: false })}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="submit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Save Draft
          </button>
        </div>
      </form>

      {/* Posts List */}
      <div style={{ marginTop: '32px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Publication Registry</span>
          <span className="brand-badge">{posts.length} Posts</span>
        </h3>

        {posts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            No posts generated yet. Create a draft above or trigger AI event suggestions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {posts.map((p) => (
              <div className="card post" key={p.id} style={{ margin: 0 }}>
                <div className="post-header">
                  <div>
                    <h4 style={{ margin: 0, color: '#ffffff' }}>{p.title || 'Untitled Draft'}</h4>
                    <span className="muted" style={{ fontSize: '11px' }}>ID: {p.id.slice(0, 8)}</span>
                  </div>
                  <span className={`status status-${p.status}`}>{p.status}</span>
                </div>

                <p style={{ whiteSpace: 'pre-wrap', margin: '14px 0', fontSize: '14px', lineHeight: '1.6' }}>
                  {p.body}
                </p>

                {/* Media Preview on Post Card */}
                {p.media_urls && p.media_urls.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    {p.media_urls.map((mUrl, mIdx) => {
                      const isVideo = mUrl.includes('.mp4') || mUrl.includes('video') || mUrl.startsWith('data:video');
                      return (
                        <div key={mIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                          {isVideo ? (
                            <>
                              <span style={{ fontSize: '15px' }}>🎬</span>
                              <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>AI Video Package</span>
                            </>
                          ) : (
                            <>
                              <img src={mUrl} alt="Post media" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px' }} />
                              <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>AI Visual Asset</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {p.hashtags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {p.hashtags.map((h, idx) => (
                      <span key={idx} className="tag" style={{ color: 'var(--synora-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => openSchedule(p)} className="btn-ghost small">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Dispatch / Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Storyboard Modal */}
      {activeVideoModal && (
        <div className="modal-backdrop" onClick={() => setActiveVideoModal(null)}>
          <div className="modal card" style={{ maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-corp)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎬</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{activeVideoModal.title || 'AI Video Package'}</h3>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    {activeVideoModal.aspectRatio || '9:16'} · {activeVideoModal.durationSeconds || 15}s Duration
                  </span>
                </div>
              </div>
              <button className="btn-ghost small" onClick={() => setActiveVideoModal(null)} style={{ border: 'none' }}>✕</button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '200px', background: '#090d1a', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <img src={activeVideoModal.posterUrl || activeVideoModal.thumbnailUrl} alt="Video poster" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
              <div style={{ position: 'absolute', width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>
                ▶
              </div>
            </div>

            <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--brand-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                🎙️ Voiceover Script & Audio Hook:
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
                "{activeVideoModal.script || activeVideoModal.narration || 'The standard in corporate intelligence.'}"
              </p>
            </div>

            <div className="modal-actions">
              <button onClick={() => setActiveVideoModal(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduling Modal */}
      {schedulingFor && (
        <div className="modal-backdrop" onClick={() => setSchedulingFor(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Schedule "{schedulingFor.title || 'Draft'}"</h3>
              <button className="btn-ghost small" onClick={() => setSchedulingFor(null)} style={{ border: 'none' }}>✕</button>
            </div>

            <label>
              Execution Timestamp
              <input 
                type="datetime-local" 
                value={schedule.scheduledAt}
                onChange={(e) => setSchedule({ ...schedule, scheduledAt: e.target.value })} 
              />
            </label>

            <fieldset>
              <legend>Target Channels & Accounts</legend>
              {accounts.length === 0 && <p className="muted">No accounts connected yet.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {accounts.map((a) => (
                  <label key={a.id} className="toggle" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={schedule.accountIds.includes(a.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...schedule.accountIds, a.id]
                          : schedule.accountIds.filter((id) => id !== a.id);
                        setSchedule({ ...schedule, accountIds: next });
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span>{a.display_name} <strong style={{ color: 'var(--synora-cyan)', textTransform: 'uppercase', fontSize: '11px' }}>({a.provider})</strong></span>
                      <span className={`status status-${a.status}`} style={{ fontSize: '10px' }}>{a.status}</span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setSchedulingFor(null)}>Cancel</button>
              <button onClick={confirmSchedule}>Confirm & Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}