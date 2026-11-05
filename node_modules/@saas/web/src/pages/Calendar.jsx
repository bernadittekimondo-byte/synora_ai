import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Calendar() {
  // Calendar View State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'ai' | 'events' | 'posts'

  // Selected Day & Modal States
  const [selectedDate, setSelectedDate] = useState(null); // string 'YYYY-MM-DD'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'dailyAi' | 'newPost' | 'newEvent'

  // Daily AI Suggestions State
  const [dailyAiSuggestions, setDailyAiSuggestions] = useState([]);
  const [dailyCalendarContext, setDailyCalendarContext] = useState([]);
  const [companyDescription, setCompanyDescription] = useState('Leading enterprise provider delivering reliable digital solutions, customer excellence, and market innovation.');
  const [targetCountry, setTargetCountry] = useState('Worldwide');
  const [dailyAiBusy, setDailyAiBusy] = useState(false);

  // Month-Wide Previews State (AI Suggestion headings & worldwide events per day)
  const [monthPreviews, setMonthPreviews] = useState({});

  // Edit states
  const [editingEvent, setEditingEvent] = useState(null);

  // Forms
  const [eventForm, setEventForm] = useState({
    title: '', description: '', location: '',
    startAt: '', endAt: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    eligibleForContent: true,
  });

  const [postForm, setPostForm] = useState({
    title: '', body: '', hashtags: '',
    scheduledTime: '12:00', accountIds: [],
    generateMedia: false, // Checkbox: instruct AI to generate image or video
    generateMediaType: 'image', // 'image' | 'video'
    mediaUrls: [],
    mediaAsset: null,
  });

  // Media Generation State
  const [aiSuggestionMediaType, setAiSuggestionMediaType] = useState('both'); // 'none' | 'image' | 'video' | 'both'
  const [generatingMedia, setGeneratingMedia] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState(null); // Storyboard or video modal preview

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    try {
      const [evRes, schRes, accRes] = await Promise.all([
        api.events(),
        api.scheduledPosts().catch(() => ({ scheduled: [] })),
        api.accounts().catch(() => ({ accounts: [] })),
      ]);
      setEvents(evRes.events || []);
      setScheduledPosts(schRes.scheduled || []);
      setAccounts(accRes.accounts || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadMonthPreviews = async (y = year, m = month + 1) => {
    try {
      const res = await api.monthSuggestionsPreview(y, m);
      setMonthPreviews(res.previews || {});
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadData();
    loadMonthPreviews();
  }, []);

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    const next = new Date(year, month - 1, 1);
    setCurrentDate(next);
    loadMonthPreviews(next.getFullYear(), next.getMonth() + 1);
  };
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    setCurrentDate(next);
    loadMonthPreviews(next.getFullYear(), next.getMonth() + 1);
  };
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    loadMonthPreviews(now.getFullYear(), now.getMonth() + 1);
  };

  // Generate matrix for Month view
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // Trailing days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dateObj = new Date(year, month - 1, d);
    calendarDays.push({
      dateNumber: d,
      dateString: dateObj.toISOString().slice(0, 10),
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    calendarDays.push({
      dateNumber: d,
      dateString: `${year}-${monthStr}-${dayStr}`,
      isCurrentMonth: true,
      isToday: new Date().toISOString().slice(0, 10) === `${year}-${monthStr}-${dayStr}`,
    });
  }

  // Next month leading days to complete full 5 or 6 weeks (35 or 42 grid cells)
  const totalTarget = calendarDays.length > 35 ? 42 : 35;
  const needNext = totalTarget - calendarDays.length;
  for (let d = 1; d <= needNext; d++) {
    const dateObj = new Date(year, month + 1, d);
    calendarDays.push({
      dateNumber: d,
      dateString: dateObj.toISOString().slice(0, 10),
      isCurrentMonth: false,
      isToday: false,
    });
  }

  const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getDayLabel = (d) => {
    if (d.dateNumber === 1) {
      const parts = d.dateString.split('-');
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthShortNames[mIdx]} 1`;
    }
    return d.dateNumber;
  };

  // Filter items for a specific date
  const getDayItems = (dateString) => {
    const dayEvents = events.filter((ev) => ev.start_at && ev.start_at.slice(0, 10) === dateString);
    const dayPosts = scheduledPosts.filter((sp) => sp.scheduled_at && sp.scheduled_at.slice(0, 10) === dateString);
    return { dayEvents, dayPosts };
  };

  const getDayEventItems = (d) => {
    const { dayEvents, dayPosts } = getDayItems(d.dateString);
    const preview = monthPreviews[d.dateString];
    const hasObservance = Boolean(preview?.eventTitle);
    const hasAiIdea = Boolean(preview?.suggestionHeading);

    const items = [];

    // 1. Worldwide / National Observance
    if ((previewFilter === 'all' || previewFilter === 'ai') && hasObservance) {
      items.push({
        id: `obs-${d.dateString}`,
        type: 'observance',
        title: preview.eventTitle,
        icon: '🌍',
        onClick: (e) => {
          e.stopPropagation();
          handleDayClick(d.dateString);
          setActiveTab('dailyAi');
        },
      });
    }

    // 2. AI Daily Content Suggestion
    if ((previewFilter === 'all' || previewFilter === 'ai') && hasAiIdea) {
      items.push({
        id: `ai-${d.dateString}`,
        type: 'ai',
        title: preview.suggestionHeading.replace(/^AI:\s*/, ''),
        icon: '⚡',
        onClick: (e) => {
          e.stopPropagation();
          handleDayClick(d.dateString);
          setActiveTab('dailyAi');
        },
      });
    }

    // 3. Company Milestone / Event
    if (previewFilter === 'all' || previewFilter === 'events') {
      dayEvents.forEach((ev) => {
        const timeStr = ev.start_at
          ? new Date(ev.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '';
        items.push({
          id: `ev-${ev.id}`,
          type: 'event',
          title: timeStr ? `${timeStr} ${ev.title}` : ev.title,
          icon: '📅',
          onClick: (e) => {
            e.stopPropagation();
            handleEditEvent(ev);
          },
        });
      });
    }

    // 4. Scheduled Social Post
    if (previewFilter === 'all' || previewFilter === 'posts') {
      dayPosts.forEach((sp) => {
        const providerTag = sp.provider ? sp.provider.toUpperCase() : 'POST';
        const postLabel = sp.post_title || sp.post_body?.slice(0, 24) || 'Post';
        items.push({
          id: `post-${sp.id}`,
          type: sp.status === 'published' ? 'post-published' : 'post',
          title: `${providerTag}: ${postLabel}`,
          icon: sp.status === 'published' ? '✓' : '🚀',
          onClick: (e) => {
            e.stopPropagation();
            handleDayClick(d.dateString);
            setActiveTab('overview');
          },
        });
      });
    }

    return items;
  };

  // Open Day View / Drawer
  const handleDayClick = (dateString) => {
    setSelectedDate(dateString);
    setActiveTab('overview');
    setEditingEvent(null);
    setDailyAiSuggestions([]);
    setDailyCalendarContext([]);

    // Initialize forms with selected date
    setEventForm({
      title: '', description: '', location: '',
      startAt: `${dateString}T09:00`,
      endAt: `${dateString}T17:00`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      eligibleForContent: true,
    });

    setPostForm({
      title: '', body: '', hashtags: '',
      scheduledTime: '12:00',
      accountIds: accounts.map((a) => a.id),
      generateMedia: false,
      generateMediaType: 'image',
      mediaUrls: [],
      mediaAsset: null,
    });

    // Automatically trigger AI Daily Post Suggestions for this day
    fetchDailySuggestions(dateString, aiSuggestionMediaType);
  };

  // Fetch Daily AI suggestions based on company description & Worldwide/Country events
  const fetchDailySuggestions = async (targetDay = selectedDate, mediaMode = aiSuggestionMediaType) => {
    setDailyAiBusy(true);
    setError(null);
    try {
      const res = await api.suggestions({
        targetDate: targetDay,
        companyDescription,
        country: targetCountry,
        generateMedia: mediaMode,
      });
      setDailyAiSuggestions(res.suggestions || []);
      setDailyCalendarContext(res.calendarEvents || []);
    } catch (err) {
      setError(`Daily AI Suggestion notice: ${err.message}`);
    } finally {
      setDailyAiBusy(false);
    }
  };

  // Generate media for a specific suggestion item
  const handleGenerateMediaForSuggestion = async (sIndex, type) => {
    const s = dailyAiSuggestions[sIndex];
    if (!s) return;
    setGeneratingMedia(true);
    setError(null);
    try {
      const res = await api.generateMedia({
        prompt: `${s.topic} · ${s.calendarTieIn || 'Corporate Innovation'}`,
        type,
        platform: s.platform,
        title: s.topic,
      });
      const updated = [...dailyAiSuggestions];
      updated[sIndex] = { ...s, mediaAsset: res.asset };
      setDailyAiSuggestions(updated);
      setMessage(`AI ${type === 'video' ? 'Video asset package' : 'Image'} generated for "${s.topic}"`);
    } catch (err) {
      setError(`Media generation error: ${err.message}`);
    } finally {
      setGeneratingMedia(false);
    }
  };

  // Generate media for the post form
  const handleGenerateMediaForPost = async (type = postForm.generateMediaType || 'image') => {
    setGeneratingMedia(true);
    setError(null);
    try {
      const prompt = postForm.title || postForm.body || 'Corporate milestone and digital excellence';
      const res = await api.generateMedia({
        prompt,
        type,
        platform: accounts[0]?.provider || 'linkedin',
        title: postForm.title || 'Executive Dispatch',
      });
      if (res.asset) {
        setPostForm((prev) => ({
          ...prev,
          generateMedia: true,
          generateMediaType: type,
          mediaUrls: [res.asset.url],
          mediaAsset: res.asset,
        }));
        setMessage(`AI ${type === 'video' ? 'Video' : 'Image'} generated and attached!`);
      }
    } catch (err) {
      setError(`Media generation error: ${err.message}`);
    } finally {
      setGeneratingMedia(false);
    }
  };

  // Event handlers
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = {
        ...eventForm,
        startAt: new Date(eventForm.startAt).toISOString(),
        endAt: new Date(eventForm.endAt).toISOString(),
      };

      if (editingEvent) {
        await api.updateEvent(editingEvent.id, payload);
        setMessage('Milestone updated successfully');
      } else {
        await api.createEvent(payload);
        setMessage('Milestone created successfully');
      }
      setEditingEvent(null);
      setActiveTab('overview');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.deleteEvent(id);
      setMessage('Event deleted');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditEvent = (ev) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      description: ev.description || '',
      location: ev.location || '',
      startAt: ev.start_at.slice(0, 16),
      endAt: ev.end_at.slice(0, 16),
      timezone: ev.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      eligibleForContent: ev.eligible_for_content,
    });
    setActiveTab('newEvent');
  };

  // Post Scheduling Handlers for the Day
  const handleSchedulePostForDay = async (e) => {
    e.preventDefault();
    if (!postForm.accountIds || postForm.accountIds.length === 0) {
      setError('Please select at least one social media channel');
      return;
    }
    setBusy(true); setError(null);
    try {
      let finalMediaUrls = [...(postForm.mediaUrls || [])];

      // If user instructed AI to generate image/video and not generated yet, generate automatically
      if (postForm.generateMedia && finalMediaUrls.length === 0) {
        const prompt = postForm.title || postForm.body || 'Corporate innovation';
        const genRes = await api.generateMedia({
          prompt,
          type: postForm.generateMediaType || 'image',
          platform: accounts[0]?.provider || 'linkedin',
          title: postForm.title || 'Executive Dispatch',
        });
        if (genRes.asset?.url) {
          finalMediaUrls = [genRes.asset.url];
        }
      }

      const hashtags = postForm.hashtags.split(/\s+/).filter(Boolean);
      const post = await api.createPost({
        title: postForm.title || undefined,
        body: postForm.body,
        hashtags,
        mediaUrls: finalMediaUrls,
      });

      const scheduledDateTime = new Date(`${selectedDate}T${postForm.scheduledTime}:00`).toISOString();
      await api.schedulePost(post.id, {
        scheduledAt: scheduledDateTime,
        accountIds: postForm.accountIds,
      });

      setMessage(`Post scheduled successfully for ${selectedDate} at ${postForm.scheduledTime}${finalMediaUrls.length ? ' (with AI media asset)' : ''}`);
      setActiveTab('overview');
      setPostForm({
        title: '', body: '', hashtags: '',
        scheduledTime: '12:00', accountIds: [],
        generateMedia: false, generateMediaType: 'image',
        mediaUrls: [], mediaAsset: null,
      });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPublication = async (pubId) => {
    if (!confirm('Cancel this scheduled publication?')) return;
    try {
      await api.cancelPublication(pubId);
      setMessage('Publication cancelled');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Adopting a daily AI suggestion
  const adoptDailySuggestion = (s) => {
    setPostForm({
      title: s.topic,
      body: s.caption,
      hashtags: (s.hashtags || []).join(' '),
      scheduledTime: s.suggestedPublishAtOffsetHours ? `${String(Math.min(23, Math.max(0, s.suggestedPublishAtOffsetHours))).padStart(2, '0')}:00` : '12:00',
      accountIds: accounts.map((a) => a.id),
      generateMedia: Boolean(s.mediaAsset?.url),
      generateMediaType: s.mediaAsset?.mediaType || 'image',
      mediaUrls: s.mediaAsset?.url ? [s.mediaAsset.url] : [],
      mediaAsset: s.mediaAsset || null,
    });
    setActiveTab('newPost');
  };

  const selectedItems = selectedDate ? getDayItems(selectedDate) : { dayEvents: [], dayPosts: [] };

  return (
    <div>
      {/* Executive Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="brand-badge">AUTONOMOUS CONTENT SCHEDULER</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily Upload AI Engine & Global Calendar Sync</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '26px' }}>Corporate Content Calendar</h2>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>
            Month view synchronized with worldwide and regional events. Click any date to view proposals, schedule uploads, or edit posts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-ghost" onClick={goToToday}>
            Today
          </button>
          <button onClick={() => handleDayClick(new Date().toISOString().slice(0, 10))}>
            + Schedule Today
          </button>
        </div>
      </div>

      {message && (
        <div className="info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{message}</span>
          <button className="btn-ghost small" onClick={() => setMessage(null)} style={{ border: 'none', padding: '2px 8px' }}>✕</button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* Normal Month Calendar View */}
      <div className="normal-cal-container">
        {/* Navigation & Controls Bar */}
        <div className="normal-cal-header">
          <div className="normal-cal-nav">
            <button type="button" className="normal-cal-today-btn" onClick={goToToday}>
              Today
            </button>
            <div className="normal-cal-arrows">
              <button type="button" className="normal-cal-arrow-btn" onClick={prevMonth} title="Previous Month">
                ‹
              </button>
              <button type="button" className="normal-cal-arrow-btn" onClick={nextMonth} title="Next Month">
                ›
              </button>
            </div>
            <h3 className="normal-cal-month-title">
              {monthNames[month]} {year}
            </h3>
            <span className="brand-badge" style={{ fontSize: '11px', fontWeight: 600 }}>
              {events.length} Milestones · {scheduledPosts.length} Dispatches
            </span>
          </div>

          <div className="normal-cal-controls">
            <div className="normal-cal-filters">
              <button
                type="button"
                className={`normal-cal-filter-btn ${previewFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPreviewFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`normal-cal-filter-btn ${previewFilter === 'ai' ? 'active' : ''}`}
                onClick={() => setPreviewFilter('ai')}
              >
                <span className="dot ai"></span> AI Ideas
              </button>
              <button
                type="button"
                className={`normal-cal-filter-btn ${previewFilter === 'events' ? 'active' : ''}`}
                onClick={() => setPreviewFilter('events')}
              >
                <span className="dot event"></span> Milestones
              </button>
              <button
                type="button"
                className={`normal-cal-filter-btn ${previewFilter === 'posts' ? 'active' : ''}`}
                onClick={() => setPreviewFilter('posts')}
              >
                <span className="dot post"></span> Dispatches
              </button>
            </div>

            <button
              type="button"
              className="btn-primary small"
              onClick={() => {
                handleDayClick(new Date().toISOString().slice(0, 10));
                setActiveTab('newPost');
              }}
            >
              + Schedule Post
            </button>
          </div>
        </div>

        {/* Weekday Names Header */}
        <div className="normal-cal-weekdays">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((w) => (
            <div key={w} className="normal-cal-weekday">
              {w}
            </div>
          ))}
        </div>

        {/* 7-Column Day Grid (Table Layout) */}
        <div className="normal-cal-grid">
          {calendarDays.map((d, index) => {
            const isSelected = selectedDate === d.dateString;
            const items = getDayEventItems(d);

            return (
              <div
                key={index}
                onClick={() => handleDayClick(d.dateString)}
                className={`normal-cal-cell ${d.isCurrentMonth ? '' : 'other-month'} ${d.isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              >
                <div className="normal-cal-cell-top">
                  <span className={`normal-cal-day-num ${d.isToday ? 'today-badge' : ''}`}>
                    {getDayLabel(d)}
                  </span>
                </div>

                <div className="normal-cal-cell-events">
                  {items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={`normal-cal-bar ${item.type}`}
                      title={item.title}
                      onClick={item.onClick}
                    >
                      <span className="cal-bar-icon">{item.icon}</span>
                      <span className="cal-bar-text">{item.title}</span>
                    </div>
                  ))}

                  {items.length > 3 && (
                    <div
                      className="normal-cal-more"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(d.dateString);
                        setActiveTab('overview');
                      }}
                    >
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Management Modal / Drawer */}
      {selectedDate && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="modal card day-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>
                  Schedule & AI Uploads for {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <span className="muted" style={{ fontSize: '12px' }}>
                  {selectedItems.dayPosts.length} Active Dispatches · {selectedItems.dayEvents.length} Events Logged
                </span>
              </div>

              <button className="btn-ghost small" onClick={() => setSelectedDate(null)} style={{ border: 'none' }}>✕</button>
            </div>

            {/* Tab Navigation */}
            <div className="filters" style={{ marginBottom: '14px' }}>
              <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                Day Overview
              </button>
              <button className={activeTab === 'dailyAi' ? 'active' : ''} onClick={() => setActiveTab('dailyAi')}>
                ⚡ AI Daily Suggestions ({dailyAiSuggestions.length})
              </button>
              <button className={activeTab === 'newPost' ? 'active' : ''} onClick={() => { setActiveTab('newPost'); }}>
                + Schedule Post
              </button>
              <button className={activeTab === 'newEvent' ? 'active' : ''} onClick={() => { setActiveTab('newEvent'); setEditingEvent(null); }}>
                {editingEvent ? 'Edit Milestone' : '+ Add Event'}
              </button>
            </div>

            <div className="day-drawer-body">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div>
                  {/* Daily AI Prompt Highlights Card */}
                  <div style={{ background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(14, 165, 233, 0.12))', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>⚡</span>
                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>Daily AI Content Recommendation</strong>
                      </div>
                      <button className="small" onClick={() => setActiveTab('dailyAi')}>
                        View All Proposals →
                      </button>
                    </div>

                    {dailyCalendarContext.length > 0 && (
                      <p style={{ margin: '4px 0 10px 0', fontSize: '12px', color: 'var(--brand-secondary)' }}>
                        🌐 Global/National Calendar Tie-In: <strong>{dailyCalendarContext.map((c) => c.title).join(' · ')}</strong>
                      </p>
                    )}

                    {dailyAiSuggestions.length > 0 ? (
                      <div style={{ background: 'rgba(8, 12, 23, 0.75)', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{dailyAiSuggestions[0].topic}</strong>
                          <span className="tag" style={{ textTransform: 'uppercase' }}>{dailyAiSuggestions[0].platform}</span>
                        </div>
                        <p style={{ fontSize: '12px', margin: '6px 0', color: '#cbd5e1' }}>"{dailyAiSuggestions[0].caption.slice(0, 160)}..."</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                          <button className="small" onClick={() => adoptDailySuggestion(dailyAiSuggestions[0])}>
                            Adopt & Schedule for This Day
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
                        {dailyAiBusy ? 'Generating AI daily proposals based on company profile…' : 'No suggestions yet. Click "AI Daily Suggestions" to generate.'}
                      </p>
                    )}
                  </div>

                  {/* Scheduled Posts for the Day */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0 }}>Social Media Posts for this Day ({selectedItems.dayPosts.length})</h4>
                      <button className="small btn-ghost" onClick={() => setActiveTab('newPost')}>+ Schedule Post</button>
                    </div>

                    {selectedItems.dayPosts.length === 0 ? (
                      <div className="card" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No social dispatches scheduled for this day yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedItems.dayPosts.map((sp) => (
                          <div key={sp.id} className="card" style={{ margin: 0, padding: '14px', background: 'rgba(11, 16, 31, 0.7)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="tag" style={{ textTransform: 'uppercase', color: 'var(--brand-secondary)' }}>
                                  {sp.provider}
                                </span>
                                <strong style={{ color: 'white', fontSize: '14px' }}>
                                  {sp.post_title || 'Untitled Post'}
                                </strong>
                              </div>
                              <span className={`status status-${sp.status}`}>{sp.status}</span>
                            </div>

                            <p style={{ fontSize: '13px', margin: '6px 0', color: '#cbd5e1' }}>{sp.post_body}</p>

                            {/* Render Attached Media Badge or Preview if present */}
                            {sp.post_media_urls && sp.post_media_urls.length > 0 && (
                              <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                                {sp.post_media_urls.map((mUrl, mIdx) => {
                                  const isVideo = mUrl.includes('.mp4') || mUrl.includes('video') || mUrl.startsWith('data:video');
                                  return (
                                    <div key={mIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                      {isVideo ? (
                                        <>
                                          <span style={{ fontSize: '14px' }}>🎬</span>
                                          <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>AI Video Package Attached</span>
                                        </>
                                      ) : (
                                        <>
                                          <img src={mUrl} alt="Post attachment" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                          <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>AI Visual Asset Attached</span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--border-hairline)', paddingTop: '8px' }}>
                              <span className="muted" style={{ fontSize: '11px' }}>
                                ⏰ Time: {new Date(sp.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Channel: {sp.account_name}
                              </span>

                              {sp.status === 'scheduled' && (
                                <button className="btn-danger small" onClick={() => handleCancelPublication(sp.id)}>
                                  Cancel Dispatch
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calendar Events & Milestones for the Day */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0 }}>Company Milestones & Events ({selectedItems.dayEvents.length})</h4>
                      <button className="small btn-ghost" onClick={() => setActiveTab('newEvent')}>+ Add Event</button>
                    </div>

                    {selectedItems.dayEvents.length === 0 ? (
                      <div className="card" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No company milestones on this day.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedItems.dayEvents.map((ev) => (
                          <div key={ev.id} className="card" style={{ margin: 0, padding: '14px', background: 'rgba(11, 16, 31, 0.7)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '15px', color: 'white' }}>{ev.title}</h4>
                                <span className="muted" style={{ fontSize: '11px' }}>
                                  {new Date(ev.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {new Date(ev.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {ev.location && ` · 📍 ${ev.location}`}
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn-ghost small" onClick={() => handleEditEvent(ev)}>
                                  Edit
                                </button>
                                <button className="btn-danger small" onClick={() => handleDeleteEvent(ev.id)}>
                                  Delete
                                </button>
                              </div>
                            </div>

                            {ev.description && (
                              <p style={{ fontSize: '12px', margin: '6px 0', color: '#94a3b8' }}>{ev.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: AI DAILY SUGGESTIONS ENGINE */}
              {activeTab === 'dailyAi' && (
                <div>
                  {/* Brand Grounding Parameters Card */}
                  <div className="card" style={{ background: 'rgba(8, 12, 23, 0.8)', border: '1px solid var(--border-corp)', padding: '16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, color: 'var(--brand-secondary)' }}>Brand Grounding & Regional Context</h4>
                      <button 
                        className="small" 
                        disabled={dailyAiBusy}
                        onClick={() => fetchDailySuggestions()}
                      >
                        {dailyAiBusy ? 'Generating AI Proposals…' : '↻ Regenerate Suggestions'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                      <label style={{ margin: 0, fontSize: '11px' }}>
                        Company Mission & Description
                        <input 
                          value={companyDescription} 
                          onChange={(e) => setCompanyDescription(e.target.value)} 
                          placeholder="What your company does, core products, target audience..."
                        />
                      </label>

                      <label style={{ margin: 0, fontSize: '11px' }}>
                        Country / Regional Focus
                        <input 
                          value={targetCountry} 
                          onChange={(e) => setTargetCountry(e.target.value)} 
                          placeholder="Worldwide, USA, UK, Kenya, Germany..."
                        />
                      </label>
                    </div>

                    {/* Media Generation Preference Controls */}
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Default AI Media:</span>
                        <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '2px' }}>
                          {[
                            { id: 'image', label: '🖼️ Images' },
                            { id: 'video', label: '🎬 Videos' },
                            { id: 'both', label: '⚡ Both' },
                            { id: 'none', label: 'None' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              className="small"
                              style={{
                                padding: '3px 10px',
                                fontSize: '11px',
                                background: aiSuggestionMediaType === opt.id ? 'var(--brand-secondary)' : 'transparent',
                                color: aiSuggestionMediaType === opt.id ? '#ffffff' : '#94a3b8',
                                border: 'none',
                                borderRadius: '4px',
                                boxShadow: 'none',
                              }}
                              onClick={() => setAiSuggestionMediaType(opt.id)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <span className="muted" style={{ fontSize: '11px' }}>
                        AI generates production-ready visuals & reels on request
                      </span>
                    </div>

                    {dailyCalendarContext.length > 0 && (
                      <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.25)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--brand-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                          Detected Calendar Moments:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {dailyCalendarContext.map((c, i) => (
                            <span key={i} className="tag" style={{ background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.35)', color: '#67e8f9' }}>
                              ★ {c.title} ({c.scope})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Generated Post Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {dailyAiSuggestions.length === 0 ? (
                      <div className="card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        {dailyAiBusy ? 'Generating tailored proposals…' : 'No suggestions available. Click "Regenerate Suggestions" above.'}
                      </div>
                    ) : (
                      dailyAiSuggestions.map((s, idx) => (
                        <div key={idx} className="card" style={{ margin: 0, padding: '18px', background: 'rgba(13, 20, 38, 0.85)', border: '1px solid var(--border-corp)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '15px', color: '#ffffff' }}>{s.topic}</strong>
                              {s.calendarTieIn && (
                                <span className="tag" style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}>
                                  Tie-in: {s.calendarTieIn}
                                </span>
                              )}
                            </div>
                            <span className="tag" style={{ color: 'var(--brand-secondary)', textTransform: 'uppercase' }}>
                              {s.platform}
                            </span>
                          </div>

                          <p style={{ fontSize: '13px', lineHeight: '1.6', margin: '8px 0', whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
                            {s.caption}
                          </p>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                            {(s.hashtags || []).map((h, hIdx) => (
                              <span key={hIdx} style={{ fontSize: '11px', color: 'var(--brand-secondary)' }}>
                                {h}
                              </span>
                            ))}
                          </div>

                          <p className="muted" style={{ fontSize: '11px', margin: '6px 0' }}>
                            Strategic Rationale: {s.rationale}
                          </p>

                          {/* Media Asset Preview / Generation Section */}
                          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(5, 8, 18, 0.6)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>🎨</span> AI Media Asset Package
                              </span>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="small btn-ghost"
                                  style={{ fontSize: '11px', padding: '3px 8px' }}
                                  disabled={generatingMedia}
                                  onClick={() => handleGenerateMediaForSuggestion(idx, 'image')}
                                >
                                  🖼️ {s.mediaAsset?.type === 'image' ? 'Regen Image' : '+ AI Image'}
                                </button>
                                <button
                                  type="button"
                                  className="small btn-ghost"
                                  style={{ fontSize: '11px', padding: '3px 8px' }}
                                  disabled={generatingMedia}
                                  onClick={() => handleGenerateMediaForSuggestion(idx, 'video')}
                                >
                                  🎬 {s.mediaAsset?.type === 'video' ? 'Regen Video' : '+ AI Video'}
                                </button>
                              </div>
                            </div>

                            {/* Render Media Asset if present */}
                            {s.mediaAsset ? (
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px' }}>
                                {s.mediaAsset.type === 'video' ? (
                                  <div 
                                    style={{ width: '120px', height: '70px', background: '#0f172a', borderRadius: '6px', overflow: 'hidden', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                                    onClick={() => setActiveVideoModal(s.mediaAsset)}
                                  >
                                    <img src={s.mediaAsset.posterUrl || s.mediaAsset.thumbnailUrl} alt="Video preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>
                                      ▶
                                    </div>
                                    <span style={{ position: 'absolute', bottom: '2px', right: '4px', fontSize: '9px', background: 'rgba(0,0,0,0.7)', padding: '1px 3px', borderRadius: '2px', color: '#fff' }}>
                                      {s.mediaAsset.durationSeconds || 15}s
                                    </span>
                                  </div>
                                ) : (
                                  <img 
                                    src={s.mediaAsset.url} 
                                    alt="Generated visual" 
                                    style={{ width: '120px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.3)' }} 
                                  />
                                )}

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="tag" style={{ fontSize: '10px', background: s.mediaAsset.type === 'video' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(14, 165, 233, 0.15)', color: s.mediaAsset.type === 'video' ? '#f472b6' : '#38bdf8' }}>
                                      {s.mediaAsset.type === 'video' ? '🎬 AI Video Reel' : '🖼️ AI Visual Art'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                      {s.mediaAsset.aspectRatio || '16:9'} · {s.mediaAsset.format || 'Ready'}
                                    </span>
                                  </div>
                                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {s.mediaAsset.prompt}
                                  </p>
                                  {s.mediaAsset.type === 'video' && (
                                    <button 
                                      type="button" 
                                      className="small btn-ghost" 
                                      style={{ padding: '2px 6px', fontSize: '10px', marginTop: '4px' }}
                                      onClick={() => setActiveVideoModal(s.mediaAsset)}
                                    >
                                      Inspect Storyboard Scenes ({s.mediaAsset.storyboard?.length || 3}) ↗
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                No media generated yet. Click "+ AI Image" or "+ AI Video" to generate visual assets for this suggestion.
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', borderTop: '1px solid var(--border-hairline)', paddingTop: '10px' }}>
                            <button onClick={() => adoptDailySuggestion(s)}>
                              Adopt & Schedule This Post →
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SCHEDULE POST FORM */}
              {activeTab === 'newPost' && (
                <form onSubmit={handleSchedulePostForDay}>
                  <label>
                    Campaign Post Title
                    <input 
                      placeholder="e.g. Special Product Showcase"
                      value={postForm.title}
                      onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                    />
                  </label>

                  <label>
                    Post Copy / Content
                    <textarea 
                      rows={4}
                      placeholder="Write your message or adopt an AI suggestion..."
                      value={postForm.body}
                      onChange={(e) => setPostForm({ ...postForm, body: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Hashtags
                    <input 
                      placeholder="#Enterprise #Innovation #Synora"
                      value={postForm.hashtags}
                      onChange={(e) => setPostForm({ ...postForm, hashtags: e.target.value })}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label>
                      Scheduled Time for {selectedDate}
                      <input 
                        type="time"
                        value={postForm.scheduledTime}
                        onChange={(e) => setPostForm({ ...postForm, scheduledTime: e.target.value })}
                        required
                      />
                    </label>

                    <label>
                      Dispatch Date
                      <input 
                        type="date"
                        value={selectedDate}
                        disabled
                      />
                    </label>
                  </div>

                  {/* AI Media Generation Checkboxes & On-Demand Actions */}
                  <div className="card" style={{ background: 'rgba(8, 12, 23, 0.7)', border: '1px solid var(--border-corp)', padding: '14px', margin: '14px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✨</span> AI Visual & Video Generator
                      </strong>
                      <span className="muted" style={{ fontSize: '11px' }}>
                        Powered by Synora Autonomous Media Engine
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="toggle" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={postForm.generateMedia && postForm.generateMediaType === 'image'}
                          onChange={(e) => {
                            setPostForm({
                              ...postForm,
                              generateMedia: e.target.checked,
                              generateMediaType: 'image',
                            });
                          }}
                        />
                        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                          🖼️ <strong>Instruct AI to generate Image</strong> for this post
                        </span>
                      </label>

                      <label className="toggle" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={postForm.generateMedia && postForm.generateMediaType === 'video'}
                          onChange={(e) => {
                            setPostForm({
                              ...postForm,
                              generateMedia: e.target.checked,
                              generateMediaType: 'video',
                            });
                          }}
                        />
                        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                          🎬 <strong>Instruct AI to generate Video</strong> (Script, Reels/Shorts Storyboard)
                        </span>
                      </label>
                    </div>

                    {/* Instant Media Generation Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="small btn-ghost"
                        disabled={generatingMedia || (!postForm.body && !postForm.title)}
                        onClick={() => handleGenerateMediaForPost('image')}
                      >
                        {generatingMedia ? 'Generating Visual…' : '✨ Generate Image Preview Now'}
                      </button>
                      <button
                        type="button"
                        className="small btn-ghost"
                        disabled={generatingMedia || (!postForm.body && !postForm.title)}
                        onClick={() => handleGenerateMediaForPost('video')}
                      >
                        {generatingMedia ? 'Compiling Video…' : '🎬 Generate Video Preview Now'}
                      </button>
                    </div>

                    {/* Preview of Attached or Generated Media */}
                    {(postForm.mediaUrls?.length > 0 || postForm.mediaAsset) && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {postForm.mediaAsset?.type === 'video' ? (
                          <div 
                            style={{ width: '100px', height: '60px', background: '#0f172a', borderRadius: '6px', overflow: 'hidden', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setActiveVideoModal(postForm.mediaAsset)}
                          >
                            <img src={postForm.mediaAsset.posterUrl || postForm.mediaAsset.thumbnailUrl} alt="Attached video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>
                              ▶
                            </div>
                          </div>
                        ) : (
                          <img 
                            src={postForm.mediaUrls?.[0] || postForm.mediaAsset?.url} 
                            alt="Attached preview" 
                            style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} 
                          />
                        )}

                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>
                            {postForm.mediaAsset?.type === 'video' ? '🎬 AI Video Attached' : '🖼️ AI Visual Attached'}
                          </span>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {postForm.mediaAsset?.title || 'Ready for scheduled dispatch'}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-danger small"
                          onClick={() => setPostForm({ ...postForm, mediaUrls: [], mediaAsset: null, generateMedia: false })}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <fieldset>
                    <legend>Target Corporate Channels</legend>
                    {accounts.length === 0 && <p className="muted">No accounts connected yet.</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                      {accounts.map((a) => (
                        <label key={a.id} className="toggle" style={{ margin: 0 }}>
                          <input 
                            type="checkbox"
                            checked={postForm.accountIds.includes(a.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...postForm.accountIds, a.id]
                                : postForm.accountIds.filter((id) => id !== a.id);
                              setPostForm({ ...postForm, accountIds: next });
                            }}
                          />
                          <span>{a.display_name} ({a.provider.toUpperCase()})</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="modal-actions">
                    <button type="button" className="btn-ghost" onClick={() => setActiveTab('overview')}>
                      Cancel
                    </button>
                    <button type="submit" disabled={busy}>
                      {busy ? 'Scheduling…' : `Schedule for ${selectedDate}`}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 4: CREATE OR EDIT EVENT */}
              {activeTab === 'newEvent' && (
                <form onSubmit={handleSaveEvent}>
                  <label>
                    Milestone Title
                    <input 
                      placeholder="e.g. Q4 Global Partner Summit"
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Description & Grounding Material
                    <textarea 
                      rows={2}
                      placeholder="Official talking points for Synora AI generation..."
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    />
                  </label>

                  <label>
                    Location or Virtual URL
                    <input 
                      placeholder="New York / YouTube Live"
                      value={eventForm.location}
                      onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label>
                      Start Timestamp
                      <input 
                        type="datetime-local"
                        value={eventForm.startAt}
                        onChange={(e) => setEventForm({ ...eventForm, startAt: e.target.value })}
                        required
                      />
                    </label>

                    <label>
                      End Timestamp
                      <input 
                        type="datetime-local"
                        value={eventForm.endAt}
                        onChange={(e) => setEventForm({ ...eventForm, endAt: e.target.value })}
                        required
                      />
                    </label>
                  </div>

                  <label className="toggle" style={{ marginTop: '12px' }}>
                    <input 
                      type="checkbox"
                      checked={eventForm.eligibleForContent}
                      onChange={(e) => setEventForm({ ...eventForm, eligibleForContent: e.target.checked })}
                    />
                    <span>Eligible for autonomous AI campaign generation</span>
                  </label>

                  <div className="modal-actions">
                    <button type="button" className="btn-ghost" onClick={() => setActiveTab('overview')}>
                      Cancel
                    </button>
                    <button type="submit" disabled={busy}>
                      {busy ? 'Saving…' : editingEvent ? 'Update Milestone' : 'Save Milestone'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Video Storyboard & Script Breakdown Modal */}
      {activeVideoModal && (
        <div className="modal-backdrop" onClick={() => setActiveVideoModal(null)}>
          <div className="modal card" style={{ maxWidth: '680px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-corp)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎬</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{activeVideoModal.title || 'AI Autonomous Video Reel'}</h3>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    {activeVideoModal.aspectRatio || '9:16'} · {activeVideoModal.durationSeconds || 15}s Duration · Corporate Ready
                  </span>
                </div>
              </div>
              <button className="btn-ghost small" onClick={() => setActiveVideoModal(null)} style={{ border: 'none' }}>✕</button>
            </div>

            {/* Poster / Playback Mockup */}
            <div style={{ position: 'relative', width: '100%', height: '220px', background: '#090d1a', borderRadius: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
              <img src={activeVideoModal.posterUrl || activeVideoModal.thumbnailUrl} alt="Video poster" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
              <div style={{ position: 'absolute', width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                ▶
              </div>
              <div style={{ position: 'absolute', bottom: '10px', left: '12px', right: '12px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#e2e8f0' }}>
                🎙️ <strong>Narration Hook:</strong> "{activeVideoModal.script || activeVideoModal.narration || 'The future of enterprise technology begins today.'}"
              </div>
            </div>

            {/* Storyboard Breakdown */}
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--brand-secondary)' }}>
              Scene Storyboard Sequence ({activeVideoModal.storyboard?.length || 3} Scenes)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              {(activeVideoModal.storyboard || [
                { scene: 1, duration: '0-5s', title: 'Hook & Problem', description: 'Attention-grabbing visual with market trend' },
                { scene: 2, duration: '5-10s', title: 'Value & Innovation', description: 'Showcasing corporate solution & velocity' },
                { scene: 3, duration: '10-15s', title: 'Call To Action', description: 'Executive signature and enterprise link' },
              ]).map((sc, scIdx) => (
                <div key={scIdx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-corp)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>SCENE {sc.scene || scIdx + 1}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{sc.duration || `${scIdx * 5}-${(scIdx + 1) * 5}s`}</span>
                  </div>
                  <strong style={{ fontSize: '12px', color: '#ffffff', display: 'block', marginBottom: '4px' }}>{sc.title}</strong>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>{sc.description}</p>
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ marginTop: '12px' }}>
              <button className="btn-ghost" onClick={() => setActiveVideoModal(null)}>
                Close Preview
              </button>
              <button onClick={() => {
                // If opening from Calendar, set as current postForm media
                setPostForm((prev) => ({
                  ...prev,
                  generateMedia: true,
                  generateMediaType: 'video',
                  mediaUrls: [activeVideoModal.url || activeVideoModal.posterUrl],
                  mediaAsset: activeVideoModal,
                }));
                setActiveVideoModal(null);
                setActiveTab('newPost');
              }}>
                Attach Video & Go To Post Form →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}