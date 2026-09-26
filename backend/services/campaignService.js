const fs = require('fs');
const csv = require('csv-parser');
const db = require('../config/db');
const emailQueue = require('../queue/emailQueue');

const BATCH_SIZE = 500;

async function createAndEnqueueCampaign({ title, subject, body, filePath, userId }) {
  const campaignRes = await db.query(
    `INSERT INTO campaigns (title, subject, body, status, user_id)
     VALUES ($1, $2, $3, 'PROCESSING', $4)
     RETURNING *`,
    [title, subject, body, userId || null]
  );
  const campaign = campaignRes.rows[0];
  const campaignId = campaign.id;

  let totalRecipients = 0;
  let batch = [];

  const flushBatch = async (items) => {
    if (items.length === 0) return;

    const emails = items.map((r) => r.email);
    const names = items.map((r) => r.name || '');

    const insertRes = await db.query(
      `INSERT INTO recipients (campaign_id, email, name, status)
       SELECT $1, unnest($2::text[]), unnest($3::text[]), 'PENDING'
       RETURNING id, email, name`,
      [campaignId, emails, names]
    );

    const jobs = insertRes.rows.map((row) => ({
      name: 'sendCampaignEmail',
      data: {
        campaignId,
        recipientId: row.id,
        email: row.email,
        name: row.name,
        subject: campaign.subject,
        body: campaign.body,
        userId: userId || null,
      },
      opts: {
        jobId: `email-${row.id}`,
      },
    }));

    await emailQueue.addBulk(jobs);
  };

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(csv());

    stream.on('data', async (row) => {
      const emailKey = Object.keys(row).find((k) => k.trim().toLowerCase() === 'email');
      const nameKey = Object.keys(row).find((k) =>
        ['name', 'fullname', 'full_name', 'customer_name'].includes(k.trim().toLowerCase())
      );

      const email = emailKey ? row[emailKey]?.trim() : null;
      const name = nameKey ? row[nameKey]?.trim() : '';

      if (email && email.includes('@')) {
        batch.push({ email, name });
        totalRecipients++;

        if (batch.length >= BATCH_SIZE) {
          stream.pause();
          const currentBatch = [...batch];
          batch = [];
          try {
            await flushBatch(currentBatch);
            stream.resume();
          } catch (err) {
            stream.destroy(err);
          }
        }
      }
    });

    stream.on('end', async () => {
      try {
        if (batch.length > 0) {
          await flushBatch(batch);
          batch = [];
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    stream.on('error', (err) => reject(err));
  });

  await db.query(
    `UPDATE campaigns
     SET total_count = $1, processing_count = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [totalRecipients, campaignId]
  );

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    console.warn(`Could not delete temp file ${filePath}:`, err.message);
  }

  return {
    campaignId,
    title: campaign.title,
    totalCount: totalRecipients,
    status: 'PROCESSING',
  };
}

async function getCampaignStats(campaignId, userId = null) {
  let campaignRes;
  if (userId) {
    campaignRes = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2`,
      [campaignId, userId]
    );
  } else {
    campaignRes = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [campaignId]);
  }

  if (campaignRes.rows.length === 0) return null;

  const campaign = campaignRes.rows[0];

  const recipientsRes = await db.query(
    `SELECT id, email, name, status, error_reason, sent_at
     FROM recipients
     WHERE campaign_id = $1
     ORDER BY id DESC
     LIMIT 50`,
    [campaignId]
  );

  const total = campaign.total_count || 0;
  const sent = campaign.sent_count || 0;
  const failed = campaign.failed_count || 0;
  const processed = sent + failed;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return {
    campaign: { ...campaign, percentage },
    recentRecipients: recipientsRes.rows,
  };
}

async function listAllCampaigns(userId = null) {
  let res;
  if (userId) {
    res = await db.query(
      `SELECT id, title, subject, total_count, sent_count, processing_count, failed_count, status, created_at
       FROM campaigns
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
  } else {
    res = await db.query(
      `SELECT id, title, subject, total_count, sent_count, processing_count, failed_count, status, created_at
       FROM campaigns
       ORDER BY created_at DESC
       LIMIT 20`
    );
  }

  return res.rows.map((camp) => {
    const total = camp.total_count || 0;
    const sent = camp.sent_count || 0;
    const failed = camp.failed_count || 0;
    const processed = sent + failed;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    return { ...camp, percentage };
  });
}

module.exports = {
  createAndEnqueueCampaign,
  getCampaignStats,
  listAllCampaigns,
};
