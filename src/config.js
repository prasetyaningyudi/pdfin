const MB = 1024 * 1024;

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const MAX_FILE_MB = intFromEnv('MAX_FILE_MB', 50);
const MAX_TOTAL_MB = intFromEnv('MAX_TOTAL_MB', 100);

module.exports = {
  PORT: intFromEnv('PORT', 3100),
  MAX_FILES: intFromEnv('MAX_FILES', 20),
  MAX_FILE_MB,
  MAX_TOTAL_MB,
  MAX_FILE_BYTES: MAX_FILE_MB * MB,
  MAX_TOTAL_BYTES: MAX_TOTAL_MB * MB,
  RATE_WINDOW_MS: intFromEnv('RATE_WINDOW_MS', 60000),
  RATE_MAX_API: intFromEnv('RATE_MAX_API', 60),
  RATE_MAX_OP: intFromEnv('RATE_MAX_OP', 10),
  TRUST_PROXY: process.env.TRUST_PROXY === undefined ? 0 : parseInt(process.env.TRUST_PROXY, 10) || 0,
};
