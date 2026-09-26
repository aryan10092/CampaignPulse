const express = require('express');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { getPublicSettings, updateSettings, getEmailConfig } = require('../services/settingsService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All settings routes require authentication
router.use(requireAuth);

/**
 * GET /api/settings  — returns current user's settings (masked)
 */
router.get('/', async (req, res) => {
  try {
    const settings = await getPublicSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * POST /api/settings  — save/update current user's settings
 */
router.post('/', async (req, res) => {
  try {
    const { provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName } = req.body;
    const updated = await updateSettings(
      { provider, smtpUser, smtpPass, resendApiKey, fromEmail, fromName },
      req.user.id
    );
    res.json({ message: 'Settings saved successfully', settings: updated });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * POST /api/settings/test  — send a test email using current user's config
 */
router.post('/test', async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid test email address is required' });
    }

    const config = await getEmailConfig(req.user.id);

    const fromAddress = config.fromName
      ? `"${config.fromName}" <${config.fromEmail || config.smtpUser}>`
      : (config.fromEmail || config.smtpUser);

    const testHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">✅ CampaignPulse Test Email</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Your email dispatcher is working properly via <strong>${config.provider.toUpperCase()}</strong>!
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-family: monospace; color: #475569; margin: 16px 0;">
          <div><strong>Sender:</strong> ${fromAddress}</div>
          <div><strong>Recipient:</strong> ${testEmail}</div>
          <div><strong>Timestamp:</strong> ${new Date().toLocaleString()}</div>
        </div>
        <p style="font-size: 13px; color: #64748b;">
          You can now launch bulk campaigns to your customer lists with confidence.
        </p>
      </div>
    `;

    // 1. Nodemailer / Gmail SMTP
    if (config.provider === 'nodemailer') {
      if (!config.smtpUser || !config.smtpPass) {
        return res.status(400).json({
          error: 'Gmail SMTP credentials missing. Please enter your Gmail address and 16-character App Password in Settings.',
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.smtpUser, pass: config.smtpPass },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: testEmail,
        subject: '✅ CampaignPulse Gmail SMTP Test Email',
        text: `Your email dispatcher is working properly via Gmail SMTP! Sent to ${testEmail} at ${new Date().toLocaleString()}`,
        html: testHtml,
      });

      return res.json({ message: `Test email sent to ${testEmail} via Gmail SMTP!`, messageId: info.messageId });
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
        text: `Your email dispatcher is working properly via Resend! Sent to ${testEmail} at ${new Date().toLocaleString()}`,
        html: testHtml,
      });

      if (error) {
        return res.status(400).json({ error: error.message || 'Resend failed to deliver email.' });
      }

      return res.json({ message: `Test email sent to ${testEmail} via Resend!`, id: data?.id });
    }

    // 3. Simulation mode
    return res.json({ message: `Simulation mode active: fake email sent to ${testEmail} (no real SMTP was called).` });
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
