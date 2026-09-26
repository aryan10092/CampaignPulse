require('dotenv').config();

// const connection = {
//   host: process.env.REDIS_HOST || '127.0.0.1',
//   port: parseInt(process.env.REDIS_PORT || '6379', 10),
//   ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
//   maxRetriesPerRequest: null,
// };

const Redis = require('ioredis');
const connection = new Redis(
  process.env.REDIS_URL,
  {
    maxRetriesPerRequest: null,
  }
);

module.exports = { connection };
