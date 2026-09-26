const db = require('../config/db');

/**
 * Returns merged configuration: NeonDB app_settings takes precedence,
 * falling back to .env variables.
 */
async function getEmailConfig() {
  let dbSettings = {};
  try {
    const res = await db.query('SELECT key, value FROM app_settings');
    for (const row of res.rows) {
      dbSettings[row.key] = row.value;
    }
  } catch (err) {
    console.warn('Could not read app_settings from DB, using env fallback:', err.message);
  }

  const resendApiKey = dbSettings.resend_api_key || process.env.RESEND_API_KEY || '';
  const fromEmail = dbSettings.from_email || process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const fromName = dbSettings.from_name || process.env.EMAIL_FROM_NAME || 'CampaignPulse';
  const provider = dbSettings.email_provider || (resendApiKey ? 'resend' : 'simulation');

  return {
    provider,
    resendApiKey,
    fromEmail,
    fromName,
  };
}

/**
 * Returns safe settings object for frontend (masking secret keys)
 */
async function getPublicSettings() {
  const config = await getEmailConfig();

  const maskedKey = config.resendApiKey
    ? config.resendApiKey.slice(0, 5) + '••••••••••••' + config.resendApiKey.slice(-4)
    : '';

  return {
    provider: config.provider,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    hasApiKey: Boolean(config.resendApiKey),
    maskedApiKey: maskedKey,
  };
}

/**
 * Updates settings in database
 */
async function updateSettings({ resendApiKey, fromEmail, fromName, provider }) {
  const updates = [];

  if (resendApiKey && !resendApiKey.includes('••••')) {
    updates.push(['resend_api_key', resendApiKey.trim()]);
  }
  if (fromEmail) {
    updates.push(['from_email', fromEmail.trim()]);
  }
  if (fromName) {
    updates.push(['from_name', fromName.trim()]);
  }
  if (provider) {
    updates.push(['email_provider', provider.trim()]);
  }

  for (const [key, value] of updates) {
    await db.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  return getPublicSettings();
}

module.exports = {
  getEmailConfig,
  getPublicSettings,
  updateSettings,
};
