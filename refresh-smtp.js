const fs = require('fs');
const path = require('path');

// 1. services/settingsService.js
const settingsServiceCode = `const db = require('../config/db');

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

  const smtpUser = dbSettings.smtp_user || process.env.SMTP_USER || '';
  const smtpPass = dbSettings.smtp_pass || process.env.SMTP_PASS || '';
  const resendApiKey = dbSettings.resend_api_key || process.env.RESEND_API_KEY || '';

  // Default provider: 'nodemailer' if SMTP credentials exist, else 'resend', else 'simulation'
  let defaultProvider = 'simulation';
  if (smtpUser && smtpPass) defaultProvider = 'nodemailer';
  else if (resendApiKey) defaultProvider = 'resend';

  const provider = dbSettings.email_provider || process.env.EMAIL_PROVIDER || defaultProvider;
  const fromEmail = dbSettings.from_email || process.env.EMAIL_FROM || smtpUser || 'onboarding@resend.dev';
  const fromName = dbSettings.from_name || process.env.EMAIL_FROM_NAME || 'CampaignPulse';

  return {
    provider,
    smtpUser,
    smtpPass,
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
 * Updates settings in database
 */
async function updateSettings({ provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName }) {
  const updates = [];

  if (provider) {
    updates.push(['email_provider', provider.trim()]);
  }
  if (smtpUser !== undefined) {
    updates.push(['smtp_user', smtpUser.trim()]);
  }
  if (smtpPass && !smtpPass.includes('••••')) {
    updates.push(['smtp_pass', smtpPass.trim().replace(/\\s+/g, '')]); // Remove spaces from 16-char app pass
  }
  if (resendApiKey && !resendApiKey.includes('••••')) {
    updates.push(['resend_api_key', resendApiKey.trim()]);
  }
  if (fromEmail) {
    updates.push(['from_email', fromEmail.trim()]);
  }
  if (fromName) {
    updates.push(['from_name', fromName.trim()]);
  }

  for (const [key, value] of updates) {
    await db.query(
      \`INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP\`,
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
`;

// 2. routes/settings.js
const settingsRouteCode = `const express = require('express');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { getPublicSettings, updateSettings, getEmailConfig } = require('../services/settingsService');

const router = express.Router();

/**
 * GET /api/settings
 */
router.get('/', async (req, res) => {
  try {
    const settings = await getPublicSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * POST /api/settings
 */
router.post('/', async (req, res) => {
  try {
    const { provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName } = req.body;
    const updated = await updateSettings({ provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName });
    res.json({ message: 'Settings saved successfully', settings: updated });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * POST /api/settings/test
 * Sends a single test email using the currently configured provider (Nodemailer Gmail or Resend)
 */
router.post('/test', async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid test email address is required' });
    }

    const config = await getEmailConfig();

    const fromAddress = config.fromName
      ? \`"\${config.fromName}" <\${config.fromEmail || config.smtpUser}>\`
      : (config.fromEmail || config.smtpUser);

    const testHtml = \`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">✅ CampaignPulse Test Email</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Your email dispatcher is working properly via <strong>\${config.provider.toUpperCase()}</strong>!
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-family: monospace; color: #475569; margin: 16px 0;">
          <div><strong>Sender:</strong> \${fromAddress}</div>
          <div><strong>Recipient:</strong> \${testEmail}</div>
          <div><strong>Timestamp:</strong> \${new Date().toLocaleString()}</div>
        </div>
        <p style="font-size: 13px; color: #64748b;">
          You can now launch bulk campaigns to your customer lists with confidence.
        </p>
      </div>
    \`;

    // 1. Nodemailer / Gmail SMTP
    if (config.provider === 'nodemailer') {
      if (!config.smtpUser || !config.smtpPass) {
        return res.status(400).json({
          error: 'Gmail SMTP credentials missing. Please enter your Gmail address and 16-character App Password in Settings.',
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: testEmail,
        subject: '✅ CampaignPulse Gmail SMTP Test Email',
        text: \`Your email dispatcher is working properly via Gmail SMTP! Sent to \${testEmail} at \${new Date().toLocaleString()}\`,
        html: testHtml,
      });

      return res.json({ message: \`Test email sent to \${testEmail} via Gmail SMTP!\`, messageId: info.messageId });
    }

    // 2. Resend Delivery
    if (config.provider === 'resend') {
      if (!config.resendApiKey) {
        return res.status(400).json({ error: 'Resend API key is missing. Please enter your API key in Settings.' });
      }

      const resend = new Resend(config.resendApiKey);
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [testEmail],
        subject: '✅ CampaignPulse Resend Test Email',
        text: \`Your email dispatcher is working properly via Resend! Sent to \${testEmail} at \${new Date().toLocaleString()}\`,
        html: testHtml,
      });

      if (error) {
        return res.status(400).json({ error: error.message || 'Resend failed to deliver email.' });
      }

      return res.json({ message: \`Test email sent to \${testEmail} via Resend!\`, id: data?.id });
    }

    // 3. Simulation mode
    return res.json({ message: \`Simulation mode active: fake email sent to \${testEmail} (no real SMTP was called).\` });
  } catch (error) {
    console.error('Test email error:', error);
    let errorMessage = error.message || 'Internal server error sending test email.';
    if (errorMessage.includes('Invalid login') || errorMessage.includes('535-5.7.8')) {
      errorMessage = 'Gmail SMTP Authentication Failed: Please verify that you are using a 16-character Google App Password (not your account login password).';
    }
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;
`;

// Write both synchronously
fs.writeFileSync(path.join(__dirname, 'services/settingsService.js'), settingsServiceCode, 'utf8');
fs.writeFileSync(path.join(__dirname, 'routes/settings.js'), settingsRouteCode, 'utf8');

console.log('✅ Synchronously refreshed services/settingsService.js and routes/settings.js');
