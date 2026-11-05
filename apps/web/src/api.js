const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const fieldErrors = data.details?.fieldErrors;
    const detail = fieldErrors
      ? Object.entries(fieldErrors)
        .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
        .join('; ')
      : '';
    const err = new Error([data.error || 'Request failed', detail].filter(Boolean).join(': '));
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

export const api = {
  signup: (body) => request('/api/v1/auth/signup', { method: 'POST', body }),
  login: (body) => request('/api/v1/auth/login', { method: 'POST', body }),
  logout: () => request('/api/v1/auth/logout', { method: 'POST' }),
  me: () => request('/api/v1/auth/me'),
  members: () => request('/api/v1/auth/members'),

  providers: () => request('/api/v1/social/providers'),
  setProviderCredentials: (provider, body) => request(`/api/v1/social/providers/${provider}/credentials`, { method: 'POST', body }),
  deleteProviderCredentials: (provider) => request(`/api/v1/social/providers/${provider}/credentials`, { method: 'DELETE' }),
  connections: () => request('/api/v1/social/connections'),
  startOAuth: (provider) => request(`/api/v1/social/connections/${provider}/oauth/start`, { method: 'POST' }),
  connectDirect: (body) => request('/api/v1/social/connections/connect-direct', { method: 'POST', body }),
  deleteConnection: (id) => request(`/api/v1/social/connections/${id}`, { method: 'DELETE' }),

  accounts: () => request('/api/v1/social/accounts'),
  accountCapabilities: (id) => request(`/api/v1/social/accounts/${id}/capabilities`),
  updateAccountSettings: (id, body) => request(`/api/v1/social/accounts/${id}/settings`, { method: 'PATCH', body }),
  testAccount: (id) => request(`/api/v1/social/accounts/${id}/test`, { method: 'POST' }),
  activateAccount: (id) => request(`/api/v1/social/accounts/${id}/activate`, { method: 'POST' }),
  pauseAccount: (id) => request(`/api/v1/social/accounts/${id}/pause`, { method: 'POST' }),
  disconnectAccount: (id) => request(`/api/v1/social/accounts/${id}/disconnect`, { method: 'POST' }),
  accountActivity: (id) => request(`/api/v1/social/accounts/${id}/activity`),

  events: () => request('/api/v1/calendar'),
  createEvent: (body) => request('/api/v1/calendar', { method: 'POST', body }),
  updateEvent: (id, body) => request(`/api/v1/calendar/${id}`, { method: 'PUT', body }),
  deleteEvent: (id) => request(`/api/v1/calendar/${id}`, { method: 'DELETE' }),

  suggestions: (body) => request('/api/v1/content/suggestions', { method: 'POST', body }),
  monthSuggestionsPreview: (year, month) => request(`/api/v1/content/suggestions/month-preview?year=${year}&month=${month}`),
  generateMedia: (body) => request('/api/v1/content/generate-media', { method: 'POST', body }),
  posts: () => request('/api/v1/content'),
  createPost: (body) => request('/api/v1/content', { method: 'POST', body }),
  updatePost: (id, body) => request(`/api/v1/content/${id}`, { method: 'PUT', body }),
  deletePost: (id) => request(`/api/v1/content/${id}`, { method: 'DELETE' }),
  schedulePost: (id, body) => request(`/api/v1/content/${id}/schedule`, { method: 'POST', body }),
  scheduledPosts: () => request('/api/v1/content/scheduled'),
  cancelPublication: (publicationId) => request(`/api/v1/content/scheduled/${publicationId}`, { method: 'DELETE' }),
  postPublications: (id) => request(`/api/v1/content/${id}/publications`),

  moderationCases: (status = 'pending') => request(`/api/v1/moderation/cases?status=${status}`),
  resolveCase: (id, body) => request(`/api/v1/moderation/cases/${id}/resolve`, { method: 'POST', body }),

  overview: () => request('/api/v1/dashboard/overview'),
  emergencyStop: (enable) => request('/api/v1/dashboard/emergency-stop', { method: 'POST', body: { enable } }),
  audit: () => request('/api/v1/dashboard/audit'),
};