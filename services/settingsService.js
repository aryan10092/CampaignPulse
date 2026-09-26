const db = require('../config/db');
const { encrypt, decrypt } = require('./cryptoService');

/**
 * Returns the decrypted email config for a specific user.
 * Falls back to global app_settings / env if no user row exists.
 */
async function getEmailConfig(userId = null) {
  let settings = null;

  if (userId) {
    try {
      const res = await db.query(
        'SELECT * FROM user_email_settings WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        settings = {
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
  }

  // Fallback: global app_settings + env
  if (!settings) {
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

    let defaultProvider = 'simulation';
    if (smtpUser && smtpPass) defaultProvider = 'nodemailer';
    else if (resendApiKey) defaultProvider = 'resend';

    const provider = dbSettings.email_provider || process.env.EMAIL_PROVIDER || defaultProvider;
    const fromEmail = dbSettings.from_email || process.env.EMAIL_FROM || smtpUser || 'onboarding@resend.dev';
    const fromName = dbSettings.from_name || process.env.EMAIL_FROM_NAME || 'CampaignPulse';

    settings = { provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName };
  }

  return settings;
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
    provider: config.provider,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    smtpUser: config.smtpUser,
    hasSmtpPass: Boolean(config.smtpPass),
    maskedSmtpPass,
    hasApiKey: Boolean(config.resendApiKey),
    maskedApiKey: maskedResendKey,
  };
}

/**
 * Upserts per-user email settings, encrypting secrets.
 */
async function updateSettings({ provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName }, userId = null) {
  if (!userId) {
    // Legacy global upsert for backward compatibility
    const updates = [];
    if (provider) updates.push(['email_provider', provider.trim()]);
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

  // Fetch current user settings to preserve existing secrets if not updating
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
      provider || 'simulation',
      smtpUser?.trim() || '',
      encryptedSmtpPass,
      encryptedResendKey,
      fromEmail?.trim() || smtpUser?.trim() || '',
      fromName?.trim() || 'CampaignPulse',
    ]
  );

  return getPublicSettings(userId);
}

module.exports = {
  getEmailConfig,
  getPublicSettings,
  updateSettings,
};
