const { z } = require('zod');

const ROLES = ['owner', 'admin', 'editor', 'moderator', 'viewer'];
const PROVIDERS = ['facebook', 'instagram', 'youtube', 'tiktok', 'x', 'linkedin'];
const CAPABILITIES = [
  'generate_content', 'schedule_posts', 'publish_posts',
  'moderate_comments', 'automatic_replies', 'direct_messages',
  'analytics', 'calendar_automation',
];

const ROLE_RANK = { owner: 5, admin: 4, editor: 3, moderator: 2, viewer: 1 };
function hasRole(role, required) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[required] || 0);
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(120),
  organizationName: z.string().min(1).max(200),
  organizationSlug: z.string().min(2).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createEventSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().min(1).max(64),
  eligibleForContent: z.boolean().default(true),
});

const accountSettingsSchema = z.object({
  publishingEnabled: z.boolean().optional(),
  moderationEnabled: z.boolean().optional(),
  repliesEnabled: z.boolean().optional(),
  analyticsEnabled: z.boolean().optional(),
  calendarAutomationEnabled: z.boolean().optional(),
  dailyLimit: z.number().int().min(0).max(1000).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  tone: z.string().max(500).optional(),
});

const suggestionSchema = z.object({
  eventId: z.string().uuid().optional(),
  prompt: z.string().max(2000).optional(),
  platform: z.enum(PROVIDERS).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  companyDescription: z.string().max(2000).optional(),
  country: z.string().max(100).optional(),
  generateMedia: z.enum(['none', 'image', 'video', 'both']).optional(),
});

const generateMediaSchema = z.object({
  prompt: z.string().min(1).max(2000),
  type: z.enum(['image', 'video']).default('image'),
  platform: z.enum(PROVIDERS).optional(),
  title: z.string().max(300).optional(),
});

const createPostSchema = z.object({
  title: z.string().max(300).optional(),
  body: z.string().min(1).max(10000),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  campaignId: z.string().uuid().optional(),
});

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  accountIds: z.array(z.string().uuid()).min(1),
});

const resolveModerationSchema = z.object({
  action: z.enum(['approve', 'reject', 'escalate', 'resolve']),
  notes: z.string().max(2000).optional(),
});

module.exports = {
  ROLES, PROVIDERS, CAPABILITIES, ROLE_RANK, hasRole,
  signupSchema, loginSchema, createEventSchema, accountSettingsSchema,
  suggestionSchema, generateMediaSchema, createPostSchema, scheduleSchema, resolveModerationSchema,
};