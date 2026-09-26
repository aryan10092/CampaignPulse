const db = require('../config/db');
const { encrypt, decrypt } = require('./cryptoService');

const ALLOWED_PROVIDERS = ['nodemailer', 'resend'];

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function emptyConfig() {
  return {
    provider: '',
    smtpUser: '',
    smtpPass: '',
    resendApiKey: '',
    fromEmail: '',
    fromName: 'CampaignPulse',
  };
}

function isDeliveryConfigured(config) {
  if (!config) return false;
  if (config.provider === 'nodemailer') {
    return Boolean(config.smtpUser && config.smtpPass);
  }
  if (config.provider === 'resend') {
    return Boolean(config.resendApiKey && (config.fromEmail || config.smtpUser));
  }
  return false;
}

/**
 * Returns the decrypted email config for a specific user.
 * Campaign sends use only that user's saved Nodemailer/Resend credentials.
 */
async function getEmailConfig(userId = null) {
  if (userId) {
    try {
      const res = await db.query(
        'SELECT * FROM user_email_settings WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          provider: row.provider,
          smtpUser: row.smtp_user,
          smtpPass: decrypt(row.smtp_pass),
          resendApiKey: decrypt(row.resend_api_key),
          fromEmail: row.from_email,
          fromName: row.from_name,
        };
      }
    } catch (err) {
      console.warn(`Could not read user_email_settings for user ${userId}:`, err.message);
    }
    return emptyConfig();
  }

  // Legacy global lookup (no authenticated user)
  let dbSettings = {};
  try {
    const res = await db.query('SELECT key, value FROM app_settings');
    for (const row of res.rows) {
      dbSettings[row.key] = row.value;
    }
  } catch (err) {
    console.warn('Could not read app_settings from DB:', err.message);
  }

  const smtpUser = dbSettings.smtp_user || process.env.SMTP_USER || '';
  const smtpPass = dbSettings.smtp_pass || process.env.SMTP_PASS || '';
  const resendApiKey = dbSettings.resend_api_key || process.env.RESEND_API_KEY || '';

  let provider = dbSettings.email_provider || process.env.EMAIL_PROVIDER || '';
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    if (smtpUser && smtpPass) provider = 'nodemailer';
    else if (resendApiKey) provider = 'resend';
    else provider = '';
  }

  const fromEmail = dbSettings.from_email || process.env.EMAIL_FROM || smtpUser || '';
  const fromName = dbSettings.from_name || process.env.EMAIL_FROM_NAME || 'CampaignPulse';

  return { provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName };
}

async function assertUserCanSend(userId) {
  const config = await getEmailConfig(userId);
  if (!isDeliveryConfigured(config)) {
    throw httpError(
      400,
      'Email delivery is not configured. Save Gmail SMTP or a Resend API key in Settings before launching a campaign.'
    );
  }
  return config;
}

/**
 * Returns masked settings for a specific user (safe to send to frontend).
 */
async function getPublicSettings(userId = null) {
  const config = await getEmailConfig(userId);

  const maskedResendKey = config.resendApiKey
    ? config.resendApiKey.slice(0, 5) + '••••••••••••' + config.resendApiKey.slice(-4)
    : '';

  const maskedSmtpPass = config.smtpPass ? '••••••••••••••••' : '';

  return {
    provider: ALLOWED_PROVIDERS.includes(config.provider) ? config.provider : 'nodemailer',
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    smtpUser: config.smtpUser,
    hasSmtpPass: Boolean(config.smtpPass),
    maskedSmtpPass,
    hasApiKey: Boolean(config.resendApiKey),
    maskedApiKey: maskedResendKey,
    configured: isDeliveryConfigured(config),
  };
}

/**
 * Upserts per-user email settings, encrypting secrets.
 */
async function updateSettings({ provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName }, userId = null) {
  const nextProvider = (provider || '').trim();
  if (!ALLOWED_PROVIDERS.includes(nextProvider)) {
    throw httpError(400, 'Provider must be Gmail SMTP (nodemailer) or Resend.');
  }

  if (!userId) {
    const updates = [];
    updates.push(['email_provider', nextProvider]);
    if (smtpUser !== undefined) updates.push(['smtp_user', smtpUser.trim()]);
    if (smtpPass && !smtpPass.includes('••••')) updates.push(['smtp_pass', smtpPass.trim().replace(/\s+/g, '')]);
    if (resendApiKey && !resendApiKey.includes('••••')) updates.push(['resend_api_key', resendApiKey.trim()]);
    if (fromEmail) updates.push(['from_email', fromEmail.trim()]);
    if (fromName) updates.push(['from_name', fromName.trim()]);

    for (const [key, value] of updates) {
      await db.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    }
    return getPublicSettings(null);
  }

  let current = { smtp_pass: '', resend_api_key: '' };
  const existing = await db.query('SELECT smtp_pass, resend_api_key FROM user_email_settings WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) {
    current = existing.rows[0];
  }

  const encryptedSmtpPass =
    smtpPass && !smtpPass.includes('••••')
      ? encrypt(smtpPass.trim().replace(/\s+/g, ''))
      : current.smtp_pass;

  const encryptedResendKey =
    resendApiKey && !resendApiKey.includes('••••')
      ? encrypt(resendApiKey.trim())
      : current.resend_api_key;

  const nextSmtpUser = smtpUser?.trim() || '';
  const nextFromEmail = fromEmail?.trim() || nextSmtpUser;
  const nextFromName = fromName?.trim() || 'CampaignPulse';

  if (nextProvider === 'nodemailer') {
    if (!nextSmtpUser) {
      throw httpError(400, 'Gmail address is required for SMTP delivery.');
    }
    if (!encryptedSmtpPass) {
      throw httpError(400, 'Gmail App Password is required for SMTP delivery.');
    }
  }

  if (nextProvider === 'resend') {
    if (!encryptedResendKey) {
      throw httpError(400, 'Resend API key is required.');
    }
    if (!nextFromEmail) {
      throw httpError(400, 'A verified From email address is required for Resend.');
    }
  }

  await db.query(
    `INSERT INTO user_email_settings (user_id, provider, smtp_user, smtp_pass, resend_api_key, from_email, from_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       smtp_user = EXCLUDED.smtp_user,
       smtp_pass = EXCLUDED.smtp_pass,
       resend_api_key = EXCLUDED.resend_api_key,
       from_email = EXCLUDED.from_email,
       from_name = EXCLUDED.from_name,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      nextProvider,
      nextSmtpUser,
      encryptedSmtpPass,
      encryptedResendKey,
      nextFromEmail,
      nextFromName,
    ]
  );

  return getPublicSettings(userId);
}

module.exports = {
  getEmailConfig,
  getPublicSettings,
  updateSettings,
  isDeliveryConfigured,
  assertUserCanSend,
};
