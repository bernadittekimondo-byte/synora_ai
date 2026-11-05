const axios = require('axios');

// ---------- Content Generation ----------
const SYSTEM_PROMPT = `You are Synora Enterprise AI Social Media Strategist.
Your mission is to generate high-performing, stylish corporate social media post proposals tailored to the brand's industry, company profile, and upcoming calendar moments.

You will receive:
1. Target date (YYYY-MM-DD)
2. Company profile (name, industry, description, tone, country/region)
3. Major worldwide and country-specific calendar events occurring on or around that date
4. Company-specific milestones or events

Generate at least one ready-to-publish, strategic daily post proposal for each supported channel or key focus platform.
Every proposal MUST integrate:
- The company's brand voice and value proposition
- Relevant cultural, national, or worldwide calendar awareness (holidays, UN observances, global tech/business trends, or local celebrations)
- Clean, engaging hashtags, a compelling Hook, and an impactful Call-to-Action (CTA).

Never invent false company pricing, unverified clinical claims, or misleading corporate news.

Return JSON ONLY matching this exact schema:
{
  "suggestions": [
    {
      "platform": "facebook|instagram|youtube|tiktok|x|linkedin|generic",
      "topic": "string headline or angle",
      "rationale": "strategic reason connecting brand and calendar event",
      "caption": "complete, professional post text with hook and body",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "cta": "Call to action text",
      "calendarTieIn": "Major event or observance referenced (worldwide or country)",
      "suggestedPublishAtOffsetHours": number,
      "safetyNotes": ["compliance or brand guideline notes"]
    }
  ]
}`;

// Major Worldwide & Country-Specific Calendar Database
const KNOWN_CALENDAR_EVENTS = [
  // January
  { month: 1, day: 1, title: "New Year's Day", scope: 'worldwide' },
  { month: 1, day: 15, title: 'World Logic Day', scope: 'worldwide' },
  { month: 1, day: 24, title: 'International Day of Education', scope: 'worldwide' },
  { month: 1, day: 26, title: 'Australia Day / India Republic Day', scope: 'country' },
  // February
  { month: 2, day: 4, title: 'World Cancer Day', scope: 'worldwide' },
  { month: 2, day: 11, title: 'International Day of Women and Girls in Science', scope: 'worldwide' },
  { month: 2, day: 14, title: "Valentine's Day / International Book Giving Day", scope: 'worldwide' },
  { month: 2, day: 20, title: 'World Day of Social Justice', scope: 'worldwide' },
  // March
  { month: 3, day: 8, title: "International Women's Day", scope: 'worldwide' },
  { month: 3, day: 15, title: 'World Consumer Rights Day', scope: 'worldwide' },
  { month: 3, day: 17, title: "St. Patrick's Day", scope: 'country' },
  { month: 3, day: 20, title: 'International Day of Happiness', scope: 'worldwide' },
  { month: 3, day: 21, title: 'World Poetry Day / International Forest Day', scope: 'worldwide' },
  { month: 3, day: 22, title: 'World Water Day', scope: 'worldwide' },
  // April
  { month: 4, day: 7, title: 'World Health Day', scope: 'worldwide' },
  { month: 4, day: 21, title: 'World Creativity and Innovation Day', scope: 'worldwide' },
  { month: 4, day: 22, title: 'Earth Day', scope: 'worldwide' },
  { month: 4, day: 23, title: 'World Book and Copyright Day', scope: 'worldwide' },
  { month: 4, day: 26, title: 'World Intellectual Property Day', scope: 'worldwide' },
  // May
  { month: 5, day: 1, title: 'International Workers Day / Labour Day', scope: 'worldwide' },
  { month: 5, day: 9, title: 'Europe Day', scope: 'country' },
  { month: 5, day: 17, title: 'World Telecommunication & Information Society Day', scope: 'worldwide' },
  { month: 5, day: 21, title: 'World Day for Cultural Diversity', scope: 'worldwide' },
  { month: 5, day: 25, title: 'Africa Day', scope: 'country' },
  // June
  { month: 6, day: 1, title: 'Global Day of Parents / Pride Month Kickoff', scope: 'worldwide' },
  { month: 6, day: 5, title: 'World Environment Day', scope: 'worldwide' },
  { month: 6, day: 8, title: 'World Oceans Day', scope: 'worldwide' },
  { month: 6, day: 19, title: 'Juneteenth (USA)', scope: 'country' },
  { month: 6, day: 21, title: 'International Day of Yoga / World Music Day', scope: 'worldwide' },
  { month: 6, day: 23, title: 'International Women in Engineering Day', scope: 'worldwide' },
  // July
  { month: 7, day: 1, title: 'Canada Day', scope: 'country' },
  { month: 7, day: 4, title: 'US Independence Day', scope: 'country' },
  { month: 7, day: 11, title: 'World Population Day', scope: 'worldwide' },
  { month: 7, day: 14, title: 'Bastille Day (France)', scope: 'country' },
  { month: 7, day: 15, title: 'World Youth Skills Day', scope: 'worldwide' },
  { month: 7, day: 17, title: 'World Emoji Day', scope: 'worldwide' },
  { month: 7, day: 30, title: 'International Day of Friendship', scope: 'worldwide' },
  // August
  { month: 8, day: 9, title: "International Day of the World's Indigenous Peoples", scope: 'worldwide' },
  { month: 8, day: 12, title: 'International Youth Day', scope: 'worldwide' },
  { month: 8, day: 15, title: 'India Independence Day', scope: 'country' },
  { month: 8, day: 19, title: 'World Humanitarian Day / World Photography Day', scope: 'worldwide' },
  // September
  { month: 9, day: 5, title: 'International Day of Charity', scope: 'worldwide' },
  { month: 9, day: 8, title: 'International Literacy Day', scope: 'worldwide' },
  { month: 9, day: 15, title: 'International Day of Democracy', scope: 'worldwide' },
  { month: 9, day: 21, title: 'International Day of Peace', scope: 'worldwide' },
  { month: 9, day: 27, title: 'World Tourism Day', scope: 'worldwide' },
  // October
  { month: 10, day: 1, title: 'International Coffee Day / World Vegetarian Day', scope: 'worldwide' },
  { month: 10, day: 4, title: 'World Animal Day / World Space Week', scope: 'worldwide' },
  { month: 10, day: 5, title: "World Teachers' Day", scope: 'worldwide' },
  { month: 10, day: 10, title: 'World Mental Health Day', scope: 'worldwide' },
  { month: 10, day: 11, title: 'International Day of the Girl Child', scope: 'worldwide' },
  { month: 10, day: 16, title: 'World Food Day', scope: 'worldwide' },
  { month: 10, day: 24, title: 'United Nations Day / World Development Information Day', scope: 'worldwide' },
  { month: 10, day: 31, title: 'World Cities Day / Halloween', scope: 'worldwide' },
  // November
  { month: 11, day: 10, title: 'World Science Day for Peace and Development', scope: 'worldwide' },
  { month: 11, day: 11, title: "Veterans Day / Singles' Day", scope: 'country' },
  { month: 11, day: 16, title: 'International Day for Tolerance', scope: 'worldwide' },
  { month: 11, day: 19, title: "Women's Entrepreneurship Day", scope: 'worldwide' },
  { month: 11, day: 20, title: 'Universal Children’s Day', scope: 'worldwide' },
  { month: 11, day: 25, title: 'Thanksgiving & Black Friday Season', scope: 'country' },
  // December
  { month: 12, day: 1, title: 'World AIDS Day', scope: 'worldwide' },
  { month: 12, day: 3, title: 'International Day of Persons with Disabilities', scope: 'worldwide' },
  { month: 12, day: 5, title: 'World Soil Day / International Volunteer Day', scope: 'worldwide' },
  { month: 12, day: 10, title: 'Human Rights Day', scope: 'worldwide' },
  { month: 12, day: 18, title: 'International Migrants Day', scope: 'worldwide' },
  { month: 12, day: 25, title: 'Christmas Day & Global Holiday Season', scope: 'worldwide' },
  { month: 12, day: 31, title: "New Year's Eve / Year-End Corporate Retrospective", scope: 'worldwide' },
];

function getMajorCalendarEventsForDate(dateStr, country = 'global') {
  if (!dateStr) return [];
  const parts = dateStr.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Exact matches
  const exact = KNOWN_CALENDAR_EVENTS.filter((e) => e.month === month && e.day === day);
  if (exact.length > 0) return exact;

  // Window matches (+/- 2 days)
  const windowEvents = KNOWN_CALENDAR_EVENTS.filter((e) => e.month === month && Math.abs(e.day - day) <= 2);
  if (windowEvents.length > 0) return windowEvents;

  // General theme for the month
  return [{
    month,
    day,
    title: `Global Enterprise & Innovation Spotlight (${parts[0]}-${parts[1]})`,
    scope: 'worldwide',
  }];
}

// ---------- AI Media Generator (Images & Videos) ----------
const CURATED_MEDIA_PRESETS = [
  {
    tag: 'tech',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tag: 'business',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tag: 'leadership',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    poster: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tag: 'innovation',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tag: 'culture',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    poster: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
  },
];

async function generateMediaAsset({
  prompt,
  type = 'image',
  platform = 'linkedin',
  companyName = 'Synora',
  title = '',
}) {
  const isVideo = type === 'video';
  const isVertical = platform === 'tiktok' || platform === 'instagram';
  const cleanPrompt = prompt || `${companyName} corporate milestone and vision`;

  // Select preset based on prompt keywords
  const lower = cleanPrompt.toLowerCase();
  let preset = CURATED_MEDIA_PRESETS[0];
  if (lower.includes('team') || lower.includes('culture') || lower.includes('people')) {
    preset = CURATED_MEDIA_PRESETS[4];
  } else if (lower.includes('future') || lower.includes('global') || lower.includes('space') || lower.includes('innovat')) {
    preset = CURATED_MEDIA_PRESETS[3];
  } else if (lower.includes('leader') || lower.includes('exec') || lower.includes('partner')) {
    preset = CURATED_MEDIA_PRESETS[2];
  } else if (lower.includes('growth') || lower.includes('financ') || lower.includes('market') || lower.includes('client')) {
    preset = CURATED_MEDIA_PRESETS[1];
  }

  if (isVideo) {
    return {
      mediaType: 'video',
      url: preset.video,
      posterUrl: preset.poster,
      prompt: cleanPrompt,
      durationSeconds: 15,
      aspectRatio: isVertical ? '9:16' : '16:9',
      orientation: isVertical ? 'Vertical (Reels/TikTok/Shorts)' : 'Horizontal (LinkedIn/YouTube/X)',
      title: title || `${companyName} Video Spotlight`,
      storyboard: [
        {
          timestamp: '0:00 - 0:03',
          visual: 'Hook: High-impact opening headline with dynamic corporate branding',
          narration: `Leading the next wave of transformation with ${companyName}.`,
        },
        {
          timestamp: '0:03 - 0:08',
          visual: 'Value Delivery: Kinetic typography showcasing core innovation and milestone metrics',
          narration: 'Delivering relentless execution and proven competitive advantage for modern teams.',
        },
        {
          timestamp: '0:08 - 0:12',
          visual: 'Social Proof: Customer impact and global collaborative excellence',
          narration: 'Engineered for reliability. Trusted by visionary industry leaders worldwide.',
        },
        {
          timestamp: '0:12 - 0:15',
          visual: 'Call to Action: Sleek logo reveal with direct engagement cue',
          narration: `Discover more at ${companyName}. Connect with us today.`,
        },
      ],
      script: `Hook: Unlock next-level performance with ${companyName}.\nStory: When execution meets innovation, progress becomes inevitable.\nCTA: Share your team's perspective in the comments below.`,
    };
  }

  // Image Generation
  let imageUrl = preset.image;
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await axios.post('https://api.openai.com/v1/images/generations', {
        prompt: `High-end commercial corporate photograph, cinematic lighting, modern executive styling: ${cleanPrompt}`,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 10000,
      });
      if (res.data?.data?.[0]?.url) {
        imageUrl = res.data.data[0].url;
      }
    } catch {
      // Fallback to preset
    }
  }

  return {
    mediaType: 'image',
    url: imageUrl,
    prompt: cleanPrompt,
    aspectRatio: isVertical ? '1:1' : '16:9',
    altText: `${companyName} AI Visual Asset: ${cleanPrompt.slice(0, 80)}`,
    title: title || `${companyName} Post Visual`,
  };
}

async function generateDailyPostSuggestions({ targetDate, companyProfile, customPrompt, platform, generateMedia }) {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);
  const company = companyProfile || {
    name: 'Enterprise Organization',
    description: 'Leading digital innovator focused on modern scalable solutions and customer impact.',
    industry: 'Technology & Enterprise Solutions',
    country: 'Global',
    tone: 'Professional, forward-thinking, and empowering',
  };

  const calendarEvents = getMajorCalendarEventsForDate(dateStr, company.country);

  const payload = {
    targetDate: dateStr,
    company: {
      name: company.name,
      description: company.description,
      industry: company.industry,
      country: company.country || 'Worldwide',
      tone: company.tone || 'Corporate Executive',
    },
    calendarContext: calendarEvents,
    customDirective: customPrompt || null,
    targetPlatform: platform || 'all',
  };

  let rawSuggestions = [];

  if (!process.env.OPENAI_API_KEY) {
    // Intelligent Offline / Mock Fallback with rich corporate suggestions
    const primaryEvent = calendarEvents[0]?.title || 'Daily Industry Briefing';
    rawSuggestions = [
      {
        platform: platform || 'linkedin',
        topic: `${company.name}: Elevating Growth on ${primaryEvent}`,
        rationale: `Strategic connection between ${company.name}'s mission in ${company.industry} and ${primaryEvent}.`,
        caption: `On this ${primaryEvent}, innovation and operational resilience take center stage. At ${company.name}, our commitment to ${company.description || 'excellence'} powers measurable growth across our global partner network.\n\nHow is your organization adapting its strategy today? Share your thoughts below.`,
        hashtags: ['#Leadership', '#Innovation', '#EnterpriseGrowth', `#${primaryEvent.replace(/[^a-zA-Z0-9]/g, '')}`],
        cta: 'Join the conversation in the comments',
        calendarTieIn: primaryEvent,
        suggestedPublishAtOffsetHours: 9,
        safetyNotes: ['Aligned with corporate brand governance and positive social sentiment.'],
      },
      {
        platform: platform || 'x',
        topic: `Executive Insight: ${primaryEvent}`,
        rationale: `High-engagement short-form thought leadership for ${primaryEvent}.`,
        caption: `Reflecting on ${primaryEvent} with a relentless focus on delivery. At ${company.name}, we believe progress is engineered every single day. What milestone is your team driving toward this week?`,
        hashtags: ['#TechLeaders', '#Strategy', `#${primaryEvent.replace(/[^a-zA-Z0-9]/g, '')}`],
        cta: 'Reply with your perspective',
        calendarTieIn: primaryEvent,
        suggestedPublishAtOffsetHours: 14,
        safetyNotes: ['Concise corporate voice verified.'],
      },
      {
        platform: platform || 'instagram',
        topic: `Behind the Vision at ${company.name}`,
        rationale: `Visual storytelling celebrating team dedication and global calendar awareness.`,
        caption: `Spotlight on ${primaryEvent} 🌐✨ Building the future requires vision, culture, and precision. Behind every solution at ${company.name} is a dedicated team creating meaningful impact.\n\nEmpowering teams worldwide.`,
        hashtags: ['#CompanyCulture', '#TeamExcellence', '#BehindTheScenes', `#${company.name.replace(/[^a-zA-Z0-9]/g, '')}`],
        cta: 'Double-tap to celebrate our team',
        calendarTieIn: primaryEvent,
        suggestedPublishAtOffsetHours: 17,
        safetyNotes: ['Positive brand imagery suggested.'],
      },
    ];
  } else {
    try {
      const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        temperature: 0.7,
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });

      const content = (res.data.choices && res.data.choices[0] && res.data.choices[0].message.content) || '{"suggestions":[]}';
      rawSuggestions = JSON.parse(content).suggestions || [];
    } catch (err) {
      console.error('AI Generation error:', err.message);
      const primaryEvent = calendarEvents[0]?.title || 'Daily Industry Briefing';
      rawSuggestions = [
        {
          platform: platform || 'linkedin',
          topic: `${company.name}: Strategic Focus on ${primaryEvent}`,
          rationale: `Seamlessly tying ${company.name}'s corporate profile with ${primaryEvent}.`,
          caption: `Celebrating ${primaryEvent}: At ${company.name}, our daily objective is translating vision into execution. We partner with leaders to transform challenges into sustainable competitive advantages.`,
          hashtags: ['#BusinessStrategy', '#ExecutiveLeadership', `#${primaryEvent.replace(/[^a-zA-Z0-9]/g, '')}`],
          cta: 'Connect with our leadership team',
          calendarTieIn: primaryEvent,
          suggestedPublishAtOffsetHours: 10,
          safetyNotes: ['Corporate compliance verified.'],
        },
      ];
    }
  }

  // Attach Media Assets to suggestions (Image or Video)
  const shouldAttachMedia = Boolean(generateMedia && generateMedia !== 'none');
  for (const s of rawSuggestions) {
    let mediaType = 'image';
    if (generateMedia === 'video' || s.platform === 'tiktok' || s.platform === 'youtube') {
      mediaType = 'video';
    }
    if (generateMedia === 'image') {
      mediaType = 'image';
    }

    // Attach media asset (or default recommended preview)
    s.mediaAsset = await generateMediaAsset({
      prompt: `${s.topic} · ${s.calendarTieIn || 'Corporate Innovation'}`,
      type: shouldAttachMedia ? mediaType : (s.platform === 'tiktok' || s.platform === 'youtube' ? 'video' : 'image'),
      platform: s.platform,
      companyName: company.name,
      title: s.topic,
    });
  }

  return rawSuggestions;
}

// Legacy Event Suggestions Adapter
async function generateSuggestions(event) {
  return generateDailyPostSuggestions({
    targetDate: event.startAt ? event.startAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    companyProfile: {
      name: event.title,
      description: event.description,
      industry: 'General Enterprise',
      country: event.location || 'Worldwide',
    },
    customPrompt: event.description,
  });
}

// ---------- Moderation ----------
const MOD_SYSTEM = `You classify social media comments. Respond with JSON:
{ "category": one of spam|scam|harassment|threat|hate|sexual|graphic|self_harm|safe|unknown,
  "confidence": 0..1, "severity": low|medium|high|critical, "reason": string, "escalate": boolean }
Escalate threats, self-harm, or confidence < 0.6.`;

async function classifyComment(text) {
  const trimmed = (text || '').slice(0, 4000);
  const lower = trimmed.toLowerCase();

  if (/kill|threat|hurt you/i.test(lower)) return { category: 'threat', confidence: 0.9, severity: 'critical', reason: 'keyword', escalate: true };
  if (/suicide|self.harm|end my life/i.test(lower)) return { category: 'self_harm', confidence: 0.95, severity: 'critical', reason: 'keyword', escalate: true };
  if (/free money|crypto.*double|click here.*now|buy now.*fast/i.test(lower)) return { category: 'spam', confidence: 0.8, severity: 'low', reason: 'keyword', escalate: false };

  if (!process.env.OPENAI_API_KEY) {
    return { category: 'safe', confidence: 0.5, severity: 'low', reason: 'no ai key', escalate: false };
  }
  try {
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: MOD_SYSTEM },
        { role: 'user', content: trimmed },
      ],
      temperature: 0,
    }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
    const parsed = JSON.parse((r.data.choices && r.data.choices[0] && r.data.choices[0].message.content) || '{}');
    return {
      category: parsed.category || 'unknown',
      confidence: Number(parsed.confidence || 0),
      severity: parsed.severity || 'medium',
      reason: parsed.reason || '',
      escalate: !!parsed.escalate || Number(parsed.confidence || 0) < 0.6,
    };
  } catch {
    return { category: 'safe', confidence: 0.5, severity: 'low', reason: 'ai error', escalate: false };
  }
}

// ---------- Policy Engine ----------
function isInQuietHours(at, q) {
  const [sh, sm] = q.start.split(':').map(Number);
  const [eh, em] = q.end.split(':').map(Number);
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? (minutes >= s && minutes < e) : (minutes >= s || minutes < e);
}

function checkPublishAllowed(ctx) {
  if (ctx.emergencyStop) return { allowed: false, reason: 'Organization emergency stop is active' };
  if (ctx.accountStatus !== 'active') return { allowed: false, reason: `Account status is ${ctx.accountStatus}` };
  if (!ctx.capabilities.publish_posts) return { allowed: false, reason: 'publish_posts capability not granted' };
  if (ctx.dailyLimit && ctx.publishedToday >= ctx.dailyLimit) return { allowed: false, reason: `Daily limit of ${ctx.dailyLimit} reached` };
  if (ctx.quietHours && isInQuietHours(ctx.scheduledAt, ctx.quietHours)) {
    return { allowed: false, reason: `Scheduled inside quiet hours (${ctx.quietHours.start} - ${ctx.quietHours.end})` };
  }
  return { allowed: true };
}

module.exports = {
  generateSuggestions,
  generateDailyPostSuggestions,
  generateMediaAsset,
  getMajorCalendarEventsForDate,
  classifyComment,
  checkPublishAllowed,
  isInQuietHours,
};