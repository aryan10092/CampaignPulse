const { connection } = require('../config/redis');
const db = require('../config/db');

const SENT_TTL_SECONDS = 7 * 24 * 60 * 60;

function sentKey(recipientId) {
  return `email:sent:${recipientId}`;
}

async function wasAlreadySent(recipientId) {
  const cached = await connection.get(sentKey(recipientId));
  if (cached) return true;

  const res = await db.query('SELECT status FROM recipients WHERE id = $1', [recipientId]);
  return res.rows[0]?.status === 'SENT';
}

async function markSentIdempotent(recipientId) {
  await connection.set(sentKey(recipientId), '1', 'EX', SENT_TTL_SECONDS);
}

/**
 * Marks the recipient SENT only if another attempt has not already done so.
 * Returns true when this call owns the counter increment.
 */
async function markRecipientSentOnce(recipientId, jobId) {
  const res = await db.query(
    `UPDATE recipients
     SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, job_id = $1
     WHERE id = $2 AND status IS DISTINCT FROM 'SENT'
     RETURNING id`,
    [jobId, recipientId]
  );
  return res.rowCount > 0;
}

module.exports = {
  wasAlreadySent,
  markSentIdempotent,
  markRecipientSentOnce,
};
