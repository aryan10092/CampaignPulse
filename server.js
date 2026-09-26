require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const campaignRoutes = require('./routes/campaigns');
const { initSocket } = require('./services/socketService');
const emailQueue = require('./queue/emailQueue');
require('./workers/emailWorker');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

initSocket(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/campaigns', campaignRoutes);

app.post('/send-email', async (req, res) => {
  const { email, subject, body } = req.body;

  if (!email || !subject || !body) {
    return res.status(400).json({ error: 'Email, subject, and body are required.' });
  }

  try {
    const job = await emailQueue.add('sendEmail', { email, subject, body });
    res.status(200).json({ message: '✅ Email job added to the queue.', jobId: job.id });
  } catch (error) {
    console.error('Error adding job to the queue:', error);
    res.status(500).json({ error: '❌ Failed to add job to the queue.' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Bulk Email Campaign Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server listening on port ${PORT}`);
});
