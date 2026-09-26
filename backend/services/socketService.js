let io = null;
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const throttleMap = new Map();
const THROTTLE_INTERVAL_MS = 250;

function extractHandshakeToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);

  const queryToken = socket.handshake.query?.token;
  if (Array.isArray(queryToken)) return queryToken[0];
  return queryToken;
}

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      socket.user = verifyToken(extractHandshakeToken(socket));
      if (!socket.user?.id) {
        return next(new Error('Authentication required'));
      }
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:campaign', async (campaignId) => {
      if (!campaignId) return;
      try {
        const res = await db.query(
          'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
          [campaignId, socket.user.id]
        );
        if (res.rows.length === 0) {
          socket.emit('join:error', { campaignId, error: 'Not allowed to join this campaign.' });
          return;
        }
        socket.join(`campaign:${campaignId}`);
      } catch (err) {
        console.error('join:campaign failed:', err);
        socket.emit('join:error', { campaignId, error: 'Failed to join campaign room.' });
      }
    });

    socket.on('leave:campaign', (campaignId) => {
      if (!campaignId) return;
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
