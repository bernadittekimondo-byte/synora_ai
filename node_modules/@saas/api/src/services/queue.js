const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const publishingQueue = new Queue('publishing', { connection });
const moderationQueue = new Queue('moderation', { connection });

module.exports = { publishingQueue, moderationQueue, connection };