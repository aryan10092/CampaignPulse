const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { connection } = require('../config/redis');
const db = require('../config/db');
const { emitCampaignProgressThrottled, emitRecipientUpdate } = require('../services/socketService');
const { getEmailConfig } = require('../services/settingsService');

// Cached Nodemailer transporter pool
let cachedTransporter = null;
let lastTransporterKey = '';

function getOrCreateTransporter(user, pass) {
  const key = `${user}:${pass}`;
  if (cachedTransporter && lastTransporterKey === key) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true, // Reuse persistent SMTP socket connections across batch jobs
    maxConnections: 5,
    maxMessages: 100,
    auth: { user, pass },
  });

  lastTransporterKey = key;
  return cachedTransporter;
}

/**
 * Dispatches an email using Nodemailer (Gmail), Resend, or simulation fallback
 */
async function sendCampaignEmail({ email, name, subject, body }) {
  const config = await getEmailConfig();

  const recipientName = name || 'Customer';
  const personalizedText = body.replace(/{name}/gi, recipientName);
  const personalizedHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px;">
      <div style="font-size: 16px; line-height: 1.6;">
        ${personalizedText.replace(/\n/g, '<br/>')}
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Sent via CampaignPulse Bulk Email Manager &bull; 
        <a href="#" style="color: #6366f1; text-decoration: none;">Unsubscribe</a>
      </p>
    </div>
  `;

  const fromAddress = config.fromName
    ? `"${config.fromName}" <${config.fromEmail || config.smtpUser}>`
    : (config.fromEmail || config.smtpUser);

  // 1. Nodemailer (Gmail SMTP)
  if (config.provider === 'nodemailer' && config.smtpUser && config.smtpPass) {
    const transporter = getOrCreateTransporter(config.smtpUser, config.smtpPass);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: subject,
      text: personalizedText,
      html: personalizedHtml,
    });

    console.log(`📨 [Nodemailer] Successfully sent email to ${email} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, mode: 'nodemailer' };
  }

  // 2. Resend Delivery
  if (config.provider === 'resend' && config.resendApiKey) {
    const resend = new Resend(config.resendApiKey);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: subject,
      text: personalizedText,
      html: personalizedHtml,
    });

    if (error) {
      throw new Error(`Resend Error: ${error.message || JSON.stringify(error)}`);
    }

    console.log(`📨 [Resend] Successfully sent email to ${email} (ID: ${data?.id})`);
    return { success: true, id: data?.id, mode: 'resend' };
  }

  // 3. Simulation Sandbox (if neither is configured or provider is set to simulation)
  const latency = Math.floor(Math.random() * 200) + 100;
  await new Promise((resolve) => setTimeout(resolve, latency));

  if (Math.random() < 0.03) {
    throw new Error(`Simulated SMTP Error: 550 Mailbox unavailable <${email}>`);
  }

  console.log(`📨 [Simulation] Simulated sending email to ${email}`);
  return { success: true, mode: 'simulation' };
}

// Create worker with concurrency and rate limiting
const emailWorker = new Worker(
  'emailQueue',
  async (job) => {
    const { campaignId, recipientId, email, name, subject, body } = job.data;

    try {
      // 1. Process email dispatch
      await sendCampaignEmail({ email, name, subject, body });

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
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    limiter: {
      max: parseInt(process.env.WORKER_RATE_LIMIT || '5', 10), // Safe rate limit for Gmail & Resend
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
