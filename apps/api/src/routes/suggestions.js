const express = require('express');
const { query } = require('@saas/database');
const { generateDailyPostSuggestions, getMajorCalendarEventsForDate } = require('@saas/ai');
const { suggestionSchema } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.post('/', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = suggestionSchema.parse(req.body);

  // Fetch organization metadata for company profile grounding
  const org = await query(
    `SELECT o.name, o.slug FROM organizations o WHERE o.id = $1`,
    [req.auth.organizationId]
  );
  const orgName = org.rows[0]?.name || 'Our Company';

  let eventCtx = null;
  if (data.eventId) {
    const ev = await query(
      `SELECT title, description, location, start_at, end_at FROM calendar_events
       WHERE id = $1 AND organization_id = $2`,
      [data.eventId, req.auth.organizationId]
    );
    if (!ev.rows[0]) return res.status(404).json({ error: 'Event not found' });
    eventCtx = ev.rows[0];
  }

  const targetDate = data.targetDate || (eventCtx ? new Date(eventCtx.start_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

  const companyProfile = {
    name: orgName,
    description: data.companyDescription || (eventCtx ? eventCtx.description : 'Enterprise social presence focused on customer value and brand excellence.'),
    industry: 'Enterprise Services & Technology',
    country: data.country || (eventCtx?.location || 'Worldwide'),
  };

  const suggestions = await generateDailyPostSuggestions({
    targetDate,
    companyProfile,
    customPrompt: data.prompt || (eventCtx ? `Milestone: ${eventCtx.title}. ${eventCtx.description || ''}` : null),
    platform: data.platform,
    generateMedia: data.generateMedia,
  });

  const calendarEvents = getMajorCalendarEventsForDate(targetDate, companyProfile.country);

  res.json({ suggestions, calendarEvents, targetDate });
}));

router.get('/month-preview', requireAuth, asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);

  const org = await query(
    `SELECT o.name FROM organizations o WHERE o.id = $1`,
    [req.auth.organizationId]
  );
  const orgName = org.rows[0]?.name || 'Enterprise';

  const daysInMonth = new Date(y, m, 0).getDate();
  const previews = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(m).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${y}-${monthStr}-${dayStr}`;

    const events = getMajorCalendarEventsForDate(dateStr, 'Worldwide');
    const primaryEvent = events[0]?.title || null;

    previews[dateStr] = {
      eventTitle: primaryEvent,
      suggestionHeading: primaryEvent ? `AI: ${orgName} on ${primaryEvent}` : `AI: Daily Growth Focus`,
    };
  }

  res.json({ year: y, month: m, previews });
}));

module.exports = router;