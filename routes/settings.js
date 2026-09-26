const express = require('express');
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
    const { resendApiKey, fromEmail, fromName, provider } = req.body;
    const updated = await updateSettings({ resendApiKey, fromEmail, fromName, provider });
    res.json({ message: 'Settings saved successfully', settings: updated });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * POST /api/settings/test
 * Sends a single test email to verify credentials
 */
router.post('/test', async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid test email address is required' });
    }

    const config = await getEmailConfig();

    if (!config.resendApiKey) {
      return res.status(400).json({ error: 'Resend API key is not configured. Please enter your API key first.' });
    }

    const resend = new Resend(config.resendApiKey);

    const fromAddress = config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [testEmail],
      subject: '✅ CampaignPulse Resend Integration Test',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5;">CampaignPulse Email Test Successful!</h2>
          <p>Your Resend API key and sending domain are properly configured.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">
            Sent from <strong>${fromAddress}</strong> via CampaignPulse Bulk Email Manager.
          </p>
        </div>
      `,
    });

    if (error) {
      return res.status(400).json({ error: error.message || 'Resend failed to deliver email.' });
    }

    res.json({ message: 'Test email sent successfully!', data });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message || 'Internal server error sending test email.' });
  }
});

module.exports = router;
