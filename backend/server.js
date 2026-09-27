require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const campaignRoutes = require('./routes/campaigns');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');
const { initSocket } = require('./services/socketService');
require('./workers/emailWorker');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

initSocket(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'CampaignPulse Bulk Email Campaign Backend API is running.',
    endpoints: {
      health: '/health',
      campaigns: '/api/campaigns',
      settings: '/api/settings',
    },
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/settings', settingsRoutes);

server.listen(PORT, () => {
  console.log(`Bulk Email Campaign Backend running on http://localhost:${PORT}`);
  console.log(` WebSocket server listening on port ${PORT}`);
});
