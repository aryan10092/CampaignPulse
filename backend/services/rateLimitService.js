const { connection } = require('../config/redis');

const MAX = parseInt(process.env.USER_RATE_LIMIT || '5', 10);
const WINDOW_MS = parseInt(process.env.USER_RATE_WINDOW_MS || '1000', 10);

const CONSUME_SLOT_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
if n > tonumber(ARGV[2]) then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then
    ttl = tonumber(ARGV[1])
  end
  return {0, ttl}
end
return {1, 0}
`;

/**
 * Fixed-window limiter per user so one campaign cannot starve others
 * on the shared BullMQ worker.
 */
async function tryConsumeUserSlot(userId) {
  const key = `ratelimit:email:${userId || 'anon'}`;
  const [allowed, retryAfterMs] = await connection.eval(
    CONSUME_SLOT_LUA,
    1,
    key,
    String(WINDOW_MS),
    String(MAX)
  );

  return {
    allowed: Number(allowed) === 1,
    retryAfterMs: Math.max(Number(retryAfterMs) || WINDOW_MS, 50),
    max: MAX,
    windowMs: WINDOW_MS,
  };
}

module.exports = { tryConsumeUserSlot, MAX, WINDOW_MS };
