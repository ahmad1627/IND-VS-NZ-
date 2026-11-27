const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const local = process.env.FANTASY_LOCAL_MODE === 'true' && !process.env.VERCEL && process.env.NODE_ENV !== 'production';
if (local) {
  const localEnv = path.resolve(__dirname, '../../.env.local');
  if (!require('fs').existsSync(localEnv)) throw Error('Run npm run setup:local before starting localhost mode.');
  require('dotenv').config({ path: localEnv, override: true, quiet: true });
  // Explicit localhost mode isolates test credentials and writes from hosted Redis.
  for (const key of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','REDIS_REST_URL','REDIS_REST_TOKEN']) delete process.env[key];
  process.env.REQUIRE_REDIS = 'false';
  process.env.LOCAL_DATA_FILE = path.resolve(__dirname, '../data/localhost.json');
  process.env.LEGACY_LOCAL_DATA_FILE = path.resolve(__dirname, '../data/localhost.json');
}
module.exports = { hosted: Boolean(process.env.VERCEL), local };
