const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const campaignService = require('../services/campaignService');
const { requireAuth } = require('../middleware/auth');
const { assertUserCanSend } = require('../services/settingsService');

const router = express.Router();

// All campaign routes require authentication
router.use(requireAuth);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `campaign-${uniqueSuffix}.csv`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('csv') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { title, subject, body } = req.body;

    if (!title || !subject || !body) {
      return res.status(400).json({ error: 'Title, subject, and body are required fields.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a CSV file with customers.' });
    }

    try {
      await assertUserCanSend(req.user.id);
    } catch (configError) {
      return res.status(configError.statusCode || 400).json({ error: configError.message });
    }

    const result = await campaignService.createAndEnqueueCampaign({
      title,
      subject,
      body,
      filePath: req.file.path,
      userId: req.user.id,
    });

    res.status(201).json({
      message: 'Campaign created and jobs enqueued successfully!',
      ...result,
    });
  } catch (error) {
    console.error('Error processing campaign upload:', error);
    res.status(500).json({ error: error.message || 'Internal server error processing campaign.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await campaignService.getCampaignStats(req.params.id, req.user.id);
    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: 'Failed to fetch campaign stats.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const campaigns = await campaignService.listAllCampaigns(req.user.id);
    res.json({ campaigns });
  } catch (error) {
    console.error('Error listing campaigns:', error);
    res.status(500).json({ error: 'Failed to list campaigns.' });
  }
});

module.exports = router;
