const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = {
  port: Number(process.env.PORT || 4000),
  env: process.env.NODE_ENV || 'development',
  webBaseUrl: process.env.WEB_BASE_URL || 'http://localhost:5173',
};

const app = express();
app.use(helmet());
app.use(cors({ origin: config.webBaseUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'api' }));

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/social/providers', require('./routes/providers'));
app.use('/api/v1/social/connections', require('./routes/connections'));
app.use('/api/v1/social/accounts', require('./routes/accounts'));
app.use('/api/v1/calendar', require('./routes/events'));
app.use('/api/v1/content', require('./routes/posts'));
app.use('/api/v1/content/suggestions', require('./routes/suggestions'));
app.use('/api/v1/moderation', require('./routes/moderation'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));

app.use(require('./middleware/error').errorHandler);

app.listen(config.port, () => console.log(`[api] listening on :${config.port}`));