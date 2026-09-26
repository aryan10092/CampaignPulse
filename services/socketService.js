let io = null;
const db = require('../config/db');

// Throttle progress emissions per campaign to avoid overwhelming the frontend UI
const throttleMap = new Map();
const THROTTLE_INTERVAL_MS = 250;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join:campaign', (campaignId) => {
      socket.join(`campaign:${campaignId}`);
    });

    socket.on('leave:campaign', (campaignId) => {
      socket.leave(`campaign:${campaignId}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitCampaignProgressThrottled(campaignId) {
  if (!io) return;

  if (throttleMap.has(campaignId)) {
    return;
  }

  const timer = setTimeout(async () => {
    throttleMap.delete(campaignId);
    try {
      const res = await db.query(
        `SELECT id, title, total_count, sent_count, processing_count, failed_count, status
         FROM campaigns
         WHERE id = $1`,
        [campaignId]
      );

      if (res.rows.length > 0) {
        const camp = res.rows[0];
        const total = camp.total_count || 0;
        const sent = camp.sent_count || 0;
        const failed = camp.failed_count || 0;
        const processed = sent + failed;
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

        io.to(`campaign:${campaignId}`).emit('campaign:progress', {
          campaignId,
          total,
          sent,
          processing: camp.processing_count,
          failed,
          percentage,
          status: camp.status,
        });
      }
    } catch (err) {
      console.error('Error emitting throttled campaign progress:', err);
    }
  }, THROTTLE_INTERVAL_MS);

  throttleMap.set(campaignId, timer);
}

function emitRecipientUpdate(campaignId, recipientData) {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('recipient:updated', recipientData);
}

module.exports = {
  initSocket,
  getIO,
  emitCampaignProgressThrottled,
  emitRecipientUpdate,
};
