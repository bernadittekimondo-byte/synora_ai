const axios = require('axios');

function getCredentials(p, overrides = {}) {
  const envMap = {
    facebook: { clientIdKey: 'FACEBOOK_CLIENT_ID', clientSecretKey: 'FACEBOOK_CLIENT_SECRET' },
    instagram: { clientIdKey: 'INSTAGRAM_CLIENT_ID', clientSecretKey: 'INSTAGRAM_CLIENT_SECRET' },
    youtube: { clientIdKey: 'YOUTUBE_CLIENT_ID', clientSecretKey: 'YOUTUBE_CLIENT_SECRET' },
    tiktok: { clientIdKey: 'TIKTOK_CLIENT_KEY', clientSecretKey: 'TIKTOK_CLIENT_SECRET' },
    x: { clientIdKey: 'X_CLIENT_ID', clientSecretKey: 'X_CLIENT_SECRET' },
    linkedin: { clientIdKey: 'LINKEDIN_CLIENT_ID', clientSecretKey: 'LINKEDIN_CLIENT_SECRET' },
  };

  const mapping = envMap[p];
  if (!mapping) throw new Error(`Unknown provider: ${p}`);

  const clientId = overrides.clientId || process.env[mapping.clientIdKey];
  const clientSecret = overrides.clientSecret || process.env[mapping.clientSecretKey];

  if (!clientId) throw new Error(`Missing Client ID / Key for provider ${p}`);
  return { clientId, clientSecret };
}

// ---------- Facebook ----------
const facebook = {
  name: 'facebook',
  supportedCapabilities: [
    'generate_content', 'schedule_posts', 'publish_posts',
    'moderate_comments', 'automatic_replies', 'analytics', 'calendar_automation',
  ],
  buildAuthorizationUrl({ redirectUri, state, credentials }) {
    const { clientId } = getCredentials('facebook', credentials);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: [
        'pages_show_list', 'pages_read_engagement', 'pages_manage_posts',
        'pages_manage_engagement', 'read_insights', 'business_management',
      ].join(','),
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },
  async exchangeCode({ code, redirectUri, credentials }) {
    const { clientId, clientSecret } = getCredentials('facebook', credentials);
    const GRAPH = 'https://graph.facebook.com/v19.0';
    const t = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code },
    });
    const long = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: clientId, client_secret: clientSecret,
        fb_exchange_token: t.data.access_token,
      },
    });
    const me = await axios.get(`${GRAPH}/me`, { params: { access_token: long.data.access_token } });
    return {
      externalUserId: me.data.id,
      accessToken: long.data.access_token,
      expiresAt: Date.now() + ((long.data.expires_in || 60 * 24 * 3600) * 1000),
      scopes: ['pages_show_list','pages_read_engagement','pages_manage_posts','pages_manage_engagement','read_insights'],
    };
  },
  async discoverAccounts(accessToken) {
    const GRAPH = 'https://graph.facebook.com/v19.0';
    const r = await axios.get(`${GRAPH}/me/accounts`, { params: { access_token: accessToken } });
    return (r.data.data || []).map((p) => ({
      providerAccountId: p.id,
      displayName: p.name,
      accountType: 'page',
      metadata: { category: p.category, tasks: p.tasks, pageToken: p.access_token },
    }));
  },
  async testConnection(accessToken, providerAccountId) {
    const GRAPH = 'https://graph.facebook.com/v19.0';
    try {
      await axios.get(`${GRAPH}/${providerAccountId}`, { params: { access_token: accessToken } });
      return { ok: true, capabilities: { publish_posts: true, moderate_comments: true, analytics: true } };
    } catch (e) {
      return { ok: false, capabilities: {}, error: e.message };
    }
  },
  async publish({ providerAccountId, accessToken, text, mediaUrls }) {
    const GRAPH = 'https://graph.facebook.com/v19.0';
    if (mediaUrls && mediaUrls.length) {
      const ids = [];
      for (const url of mediaUrls) {
        const r = await axios.post(`${GRAPH}/${providerAccountId}/photos`, null, {
          params: { url, published: false, access_token: accessToken },
        });
        ids.push(r.data.id);
      }
      const r = await axios.post(`${GRAPH}/${providerAccountId}/feed`, null, {
        params: { message: text, attached_media: ids.map((id) => ({ media_fbid: id })), access_token: accessToken },
      });
      return { providerPostId: r.data.id, raw: r.data };
    }
    const r = await axios.post(`${GRAPH}/${providerAccountId}/feed`, null, {
      params: { message: text, access_token: accessToken },
    });
    return { providerPostId: r.data.id, raw: r.data };
  },
};

// ---------- Instagram ----------
const instagram = {
  name: 'instagram',
  supportedCapabilities: [
    'generate_content', 'schedule_posts', 'publish_posts',
    'moderate_comments', 'automatic_replies', 'analytics', 'calendar_automation',
  ],
  buildAuthorizationUrl({ redirectUri, state, credentials }) {
    const { clientId } = getCredentials('instagram', credentials);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list',
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },
  async exchangeCode({ code, redirectUri, credentials }) {
    const { clientId, clientSecret } = getCredentials('instagram', credentials);
    const t = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code },
    });
    const me = await axios.get(`https://graph.facebook.com/v19.0/me`, {
      params: { access_token: t.data.access_token },
    });
    return {
      externalUserId: me.data.id,
      accessToken: t.data.access_token,
      expiresAt: Date.now() + ((t.data.expires_in || 60 * 24 * 3600) * 1000),
      scopes: ['instagram_basic','instagram_content_publish','instagram_manage_comments','instagram_manage_insights'],
    };
  },
  async discoverAccounts(accessToken) {
    const pages = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
      params: { access_token: accessToken },
    });
    const out = [];
    for (const p of pages.data.data || []) {
      const ig = await axios.get(`https://graph.facebook.com/v19.0/${p.id}`, {
        params: { fields: 'instagram_business_account', access_token: accessToken },
      }).catch(() => null);
      if (ig && ig.data && ig.data.instagram_business_account) {
        const igId = ig.data.instagram_business_account.id;
        const info = await axios.get(`https://graph.facebook.com/v19.0/${igId}`, {
          params: { fields: 'username,name', access_token: accessToken },
        }).catch(() => ({ data: {} }));
        out.push({
          providerAccountId: igId,
          displayName: info.data.username || info.data.name || igId,
          accountType: 'instagram_business',
          metadata: { pageId: p.id, pageToken: p.access_token },
        });
      }
    }
    return out;
  },
  async testConnection(accessToken, providerAccountId) {
    try {
      await axios.get(`https://graph.facebook.com/v19.0/${providerAccountId}`, {
        params: { fields: 'id,username', access_token: accessToken },
      });
      return { ok: true, capabilities: { publish_posts: true, moderate_comments: true, analytics: true } };
    } catch (e) {
      return { ok: false, capabilities: {}, error: e.message };
    }
  },
  async publish({ providerAccountId, accessToken, text, mediaUrls }) {
    if (!mediaUrls || !mediaUrls.length) throw new Error('Instagram requires at least one media URL');
    const container = await axios.post(
      `https://graph.facebook.com/v19.0/${providerAccountId}/media`, null,
      { params: { image_url: mediaUrls[0], caption: text, access_token: accessToken } }
    );
    const pub = await axios.post(
      `https://graph.facebook.com/v19.0/${providerAccountId}/media_publish`, null,
      { params: { creation_id: container.data.id, access_token: accessToken } }
    );
    return { providerPostId: pub.data.id, raw: pub.data };
  },
};

// ---------- YouTube (read-only by default) ----------
const youtube = {
  name: 'youtube',
  supportedCapabilities: ['generate_content', 'analytics', 'calendar_automation'],
  buildAuthorizationUrl({ redirectUri, state, credentials }) {
    const { clientId } = getCredentials('youtube', credentials);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  async exchangeCode({ code, redirectUri, credentials }) {
    const { clientId, clientSecret } = getCredentials('youtube', credentials);
    const r = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }));
    const me = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet', mine: true },
      headers: { Authorization: `Bearer ${r.data.access_token}` },
    });
    const channelId = (me.data.items && me.data.items[0] && me.data.items[0].id) || 'me';
    return {
      externalUserId: channelId,
      accessToken: r.data.access_token,
      refreshToken: r.data.refresh_token,
      expiresAt: Date.now() + (r.data.expires_in * 1000),
      scopes: (r.data.scope || '').split(' '),
    };
  },
  async discoverAccounts(accessToken) {
    const me = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (me.data.items || []).map((c) => ({
      providerAccountId: c.id,
      displayName: c.snippet.title,
      accountType: 'channel',
      metadata: { thumbnail: c.snippet.thumbnails && c.snippet.thumbnails.default && c.snippet.thumbnails.default.url },
    }));
  },
  async testConnection(accessToken, providerAccountId) {
    try {
      await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'id', id: providerAccountId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { ok: true, capabilities: { analytics: true } };
    } catch (e) {
      return { ok: false, capabilities: {}, error: e.message };
    }
  },
  async publish() {
    throw Object.assign(new Error('YouTube publishing requires resumable upload; not enabled'), { code: 'NOT_IMPLEMENTED' });
  },
};

// ---------- TikTok (read-only default) ----------
const tiktok = {
  name: 'tiktok',
  supportedCapabilities: ['generate_content', 'analytics', 'calendar_automation'],
  buildAuthorizationUrl({ redirectUri, state, codeVerifier, credentials }) {
    const { clientId: clientKey } = getCredentials('tiktok', credentials);
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: 'user.info.basic,video.list',
      redirect_uri: redirectUri,
      state,
      code_challenge: codeVerifier || '',
      code_challenge_method: 'S256',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },
  async exchangeCode({ code, redirectUri, codeVerifier, credentials }) {
    const { clientId: clientKey, clientSecret } = getCredentials('tiktok', credentials);
    const r = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
      client_key: clientKey, client_secret: clientSecret, code,
      grant_type: 'authorization_code', redirect_uri: redirectUri,
      code_verifier: codeVerifier || '',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const user = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: { fields: 'open_id,union_id,avatar_url,display_name' },
      headers: { Authorization: `Bearer ${r.data.access_token}` },
    });
    return {
      externalUserId: user.data.data.user.open_id,
      accessToken: r.data.access_token,
      refreshToken: r.data.refresh_token,
      expiresAt: Date.now() + (r.data.expires_in * 1000),
      scopes: (r.data.scope || '').split(','),
    };
  },
  async discoverAccounts(accessToken) {
    const user = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: { fields: 'open_id,display_name,avatar_url' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = user.data.data.user;
    return [{
      providerAccountId: u.open_id,
      displayName: u.display_name || 'TikTok Account',
      accountType: 'tiktok_user',
      metadata: { avatar: u.avatar_url },
    }];
  },
  async testConnection(accessToken) {
    try {
      await axios.get('https://open.tiktokapis.com/v2/user/info/', {
        params: { fields: 'open_id' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { ok: true, capabilities: { analytics: true } };
    } catch (e) {
      return { ok: false, capabilities: {}, error: e.message };
    }
  },
  async publish() { throw new Error('TikTok publishing requires a reviewed app; not enabled'); },
};

// ---------- X ----------
const x = {
  name: 'x',
  supportedCapabilities: [
    'generate_content', 'schedule_posts', 'publish_posts',
    'moderate_comments', 'analytics', 'calendar_automation',
  ],
  buildAuthorizationUrl({ redirectUri, state, codeVerifier, credentials }) {
    const { clientId } = getCredentials('x', credentials);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeVerifier || '',
      code_challenge_method: 'S256',
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  },
  async exchangeCode({ code, redirectUri, codeVerifier, credentials }) {
    const { clientId, clientSecret } = getCredentials('x', credentials);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const r = await axios.post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
      code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: codeVerifier || '',
    }), { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    const me = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${r.data.access_token}` },
    });
    return {
      externalUserId: me.data.data.id,
      accessToken: r.data.access_token,
      refreshToken: r.data.refresh_token,
      expiresAt: Date.now() + (r.data.expires_in * 1000),
      scopes: (r.data.scope || '').split(' '),
    };
  },
  async discoverAccounts(accessToken) {
    const me = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return [{
      providerAccountId: me.data.data.id,
      displayName: me.data.data.name,
      accountType: 'x_user',
      metadata: { username: me.data.data.username },
    }];
  },
  async testConnection(accessToken) {
    try {
      await axios.get('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      return { ok: true, capabilities: { publish_posts: true, analytics: true } };
    } catch (e) {
      return { ok: false, capabilities: {}, error: e.message };
    }
  },
  async publish({ text, accessToken }) {
    const r = await axios.post('https://api.twitter.com/2/tweets', { text }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    return { providerPostId: r.data.data.id, raw: r.data };
  },
};

// ---------- LinkedIn ----------
const linkedin = {
  name: 'linkedin',
  supportedCapabilities: [
    'generate_content', 'schedule_posts', 'publish_posts', 'analytics', 'calendar_automation',
  ],
  buildAuthorizationUrl({ redirectUri, state, credentials }) {
    const { clientId } = getCredentials('linkedin', credentials);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'openid profile w_member_social r_organization_social w_organization_social rw_organization_admin',
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },
  async exchangeCode({ code, redirectUri, credentials }) {
    const { clientId, clientSecret } = getCredentials('linkedin', credentials);
    const r = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      client_id: clientId, client_secret: clientSecret,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const me = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${r.data.access_token}` },
    });
    return {
      externalUserId: me.data.sub,
      accessToken: r.data.access_token,
      expiresAt: Date.now() + (r.data.expires_in * 1000),
      scopes: (r.data.scope || '').split(' '),
    };
  },
  async discoverAccounts(accessToken) {
    const acls = await axios.get('https://api.linkedin.com/v2/organizationalEntityAcls', {
      params: { q: 'roleAssignee' },
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    const out = [];
    for (const el of acls.data.elements || []) {
      const urn = el.organizationalTarget;
      const orgId = urn.split(':').pop();
      const info = await axios.get(`https://api.linkedin.com/v2/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null);
      out.push({
        providerAccountId: orgId,
        displayName: info && info.data && info.data.localizedName ? info.data.localizedName : `LinkedIn Org ${orgId}`,
        accountType: 'linkedin_organization',
        metadata: { urn },
      });
    }
    return out;
  },
  async testConnection(accessToken) {
    try {
      await axios.get('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
      return { ok: true, capabilities: { publish_posts: true, analytics: true } };
    } catch (e) {
      return { ok: false, capabilities: {}, error: e.message };
    }
  },
  async publish({ providerAccountId, accessToken, text }) {
    const author = `urn:li:organization:${providerAccountId}`;
    const r = await axios.post('https://api.linkedin.com/v2/ugcPosts', {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' },
    });
    return { providerPostId: r.data.id, raw: r.data };
  },
};

// ---------- Registry ----------
const registry = { facebook, instagram, youtube, tiktok, x, linkedin };

function getAdapter(provider) {
  const adapter = registry[provider];
  if (!adapter) throw new Error(`Unknown provider: ${provider}`);
  return adapter;
}

const ENV_KEYS = {
  facebook: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'],
  instagram: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
};

function isConfigured(p, configuredProviders = {}) {
  if (configuredProviders[p]) return true;
  const keys = ENV_KEYS[p] || [];
  return keys.length > 0 && keys.every((k) => !!process.env[k]);
}

function listProviders(configuredOverrides = {}) {
  return Object.keys(registry).map((name) => ({
    name,
    supportedCapabilities: registry[name].supportedCapabilities,
    configured: isConfigured(name, configuredOverrides),
  }));
}

module.exports = { getAdapter, listProviders, getCredentials, isConfigured, ENV_KEYS };