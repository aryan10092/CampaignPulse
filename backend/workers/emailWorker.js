const { Worker, DelayedError } = require('bullmq');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { connection } = require('../config/redis');
const db = require('../config/db');
const { emitCampaignProgressThrottled, emitRecipientUpdate } = require('../services/socketService');
const { getEmailConfig } = require('../services/settingsService');
const { tryConsumeUserSlot } = require('../services/rateLimitService');
const {
  wasAlreadySent,
  markSentIdempotent,
  markRecipientSentOnce,
} = require('../services/idempotencyService');

// Per-user Nodemailer transporter pool cache
// Key: `userId:smtpUser:smtpPass` → transporter instance
const transporterCache = new Map();

function getOrCreateTransporter(userId, user, pass) {
  const key = `${userId || 'global'}:${user}:${pass}`;
  if (transporterCache.has(key)) {
    return transporterCache.get(key);
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    family: 4, // Force IPv4 to prevent ENETUNREACH on Render
    pool: true,
    maxConnections: 3,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporterCache.set(key, transporter);
  return transporter;
}

/**
 * Dispatches an email using the config for the given userId.
 * Falls back to global config if userId is null.
 */
async function sendCampaignEmail({ email, name, subject, body, userId }) {
  const config = await getEmailConfig(userId || null);

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

  if (config.provider === 'nodemailer') {
    if (!config.smtpUser || !config.smtpPass) {
      throw new Error('Gmail SMTP is not configured for this account. Save credentials in Settings.');
    }

    const transporter = getOrCreateTransporter(userId, config.smtpUser, config.smtpPass);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: subject,
      text: personalizedText,
      html: personalizedHtml,
    });

    console.log(`📨 [Nodemailer] Sent to ${email} (User: ${userId || 'global'}, MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, mode: 'nodemailer' };
  }

  if (config.provider === 'resend') {
    if (!config.resendApiKey) {
      throw new Error('Resend API key is not configured for this account. Save credentials in Settings.');
    }

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

    console.log(`📨 [Resend] Sent to ${email} (User: ${userId || 'global'}, ID: ${data?.id})`);
    return { success: true, id: data?.id, mode: 'resend' };
  }

  throw new Error('Email delivery is not configured. Save Gmail SMTP or a Resend API key in Settings.');
}

async function completeSuccessfulSend({ campaignId, recipientId, email, name, jobId }) {
  const firstMark = await markRecipientSentOnce(recipientId, jobId);
  if (!firstMark) {
    return { success: true, skipped: true };
  }

  await db.query(
    `UPDATE campaigns
     SET sent_count = sent_count + 1,
         processing_count = GREATEST(0, processing_count - 1),
         status = CASE WHEN (sent_count + 1 + failed_count) >= total_count THEN 'COMPLETED' ELSE status END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [campaignId]
  );

  emitRecipientUpdate(campaignId, {
    recipientId,
    email,
    name,
    status: 'SENT',
    sentAt: new Date().toISOString(),
  });
  emitCampaignProgressThrottled(campaignId);

  return { success: true };
}

const emailWorker = new Worker(
  'emailQueue',
  async (job, token) => {
    const { campaignId, recipientId, email, name, subject, body, userId } = job.data;

    try {
      if (await wasAlreadySent(recipientId)) {
        return completeSuccessfulSend({
          campaignId,
          recipientId,
          email,
          name,
          jobId: job.id,
        });
      }

      const slot = await tryConsumeUserSlot(userId);
      if (!slot.allowed) {
        await job.moveToDelayed(Date.now() + slot.retryAfterMs, token);
        throw new DelayedError();
      }

      await sendCampaignEmail({ email, name, subject, body, userId });
      await markSentIdempotent(recipientId);

      return completeSuccessfulSend({
        campaignId,
        recipientId,
        email,
        name,
        jobId: job.id,
      });
    } catch (error) {
      if (error instanceof DelayedError) {
        throw error;
      }
      console.error(`⚠️ Attempt ${job.attemptsMade + 1} failed for ${email}:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  }
);

// Worker Event: permanently failed jobs
emailWorker.on('failed', async (job, err) => {
  if (!job) return;

  const { campaignId, recipientId, email, name } = job.data;

  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(`Job permanently failed for ${email} (Campaign: ${campaignId}) after ${job.attemptsMade} attempts: ${err.message}`);

    try {
      await db.query(
        `UPDATE recipients
         SET status = 'FAILED', error_reason = $1, job_id = $2
         WHERE id = $3`,
        [err.message, job.id, recipientId]
      );

      await db.query(
        `UPDATE campaigns
         SET failed_count = failed_count + 1,
             processing_count = GREATEST(0, processing_count - 1),
             status = CASE WHEN (sent_count + failed_count + 1) >= total_count THEN 'COMPLETED' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [campaignId]
      );

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
