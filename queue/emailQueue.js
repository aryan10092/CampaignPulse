const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

// Create email queue with retry and cleanup configuration
const emailQueue = new Queue('emailQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1500, // wait 1.5s, then 3s, etc. on failure
    },
    removeOnComplete: {
      count: 1000, // keep the last 1000 completed jobs in Redis
    },
    removeOnFail: {
      count: 5000, // retain failed jobs for debugging
    },
  },
});

module.exports = emailQueue;
