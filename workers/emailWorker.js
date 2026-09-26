const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const db = require('../config/db');
const { emitCampaignProgressThrottled, emitRecipientUpdate } = require('../services/socketService');

/**
 * Simulates email sending with configurable latency and simulated bounce/failure rate
 */
async function simulateSendEmail({ email, name, subject, body }) {
  // Simulate network/SMTP latency between 100ms and 300ms
  const latency = Math.floor(Math.random() * 200) + 100;
  await new Promise((resolve) => setTimeout(resolve, latency));

  // Simulate 3% random failure to test BullMQ retries & failure tracking
  const isSimulatedFailure = Math.random() < 0.03;
  if (isSimulatedFailure) {
    throw new Error(`SMTP Error: 550 Mailbox unavailable or rejected recipient <${email}>`);
  }

  return { success: true, timestamp: new Date() };
}

// Create worker with concurrency and rate limiting
const emailWorker = new Worker(
  'emailQueue',
  async (job) => {
    const { campaignId, recipientId, email, name, subject, body } = job.data;

    try {
      // 1. Process email dispatch
      await simulateSendEmail({ email, name, subject, body });

      // 2. Mark recipient as SENT in NeonDB
      await db.query(
        `UPDATE recipients
         SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, job_id = $1
         WHERE id = $2`,
        [job.id, recipientId]
      );

      // 3. Atomically increment campaign sent count and check completion
      await db.query(
        `UPDATE campaigns
         SET sent_count = sent_count + 1,
             processing_count = GREATEST(0, processing_count - 1),
             status = CASE WHEN (sent_count + 1 + failed_count) >= total_count THEN 'COMPLETED' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [campaignId]
      );

      // 4. Push real-time event via WebSockets
      emitRecipientUpdate(campaignId, {
        recipientId,
        email,
        name,
        status: 'SENT',
        sentAt: new Date().toISOString(),
      });
      emitCampaignProgressThrottled(campaignId);

      return { success: true };
    } catch (error) {
      console.error(`⚠️ Attempt ${job.attemptsMade + 1} failed for ${email}:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
    limiter: {
      max: 50,
      duration: 1000,
    },
  }
);

// Worker Event: When a job exhausts all retries and permanently fails
emailWorker.on('failed', async (job, err) => {
  if (!job) return;

  const { campaignId, recipientId, email, name } = job.data;

  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(`❌ Job permanently failed for ${email} (Campaign: ${campaignId}) after ${job.attemptsMade} attempts: ${err.message}`);

    try {
      // 1. Mark recipient as FAILED in NeonDB
      await db.query(
        `UPDATE recipients
         SET status = 'FAILED', error_reason = $1, job_id = $2
         WHERE id = $3`,
        [err.message, job.id, recipientId]
      );

      // 2. Atomically increment campaign failed count
      await db.query(
        `UPDATE campaigns
         SET failed_count = failed_count + 1,
             processing_count = GREATEST(0, processing_count - 1),
             status = CASE WHEN (sent_count + failed_count + 1) >= total_count THEN 'COMPLETED' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [campaignId]
      );

      // 3. Push real-time failed notification via WebSockets
      emitRecipientUpdate(campaignId, {
        recipientId,
        email,
        name,
        status: 'FAILED',
        errorReason: err.message,
      });
      emitCampaignProgressThrottled(campaignId);
    } catch (dbErr) {
      console.error('Failed to update recipient failure in DB:', dbErr);
    }
  }
});

emailWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

module.exports = emailWorker;
