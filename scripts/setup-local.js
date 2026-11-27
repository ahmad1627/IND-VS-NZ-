// Local bootstrap only: never reset saved users, credentials or teams.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw Error('Local setup is disabled in production.');
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
const dataPath = path.join(root, 'api/data/localhost.json');
if (fs.existsSync(envPath)) {
  console.log('Existing .env.local preserved. Run npm run dev and use your existing login.');
  process.exit(0);
}
if (fs.existsSync(dataPath)) throw Error('Existing local database found. Restore its previous .env.local; no users or teams were changed.');
const email = process.env.ADMIN_EMAIL || 'admin@fantasy.local';
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
const values = {JWT_SECRET:crypto.randomBytes(48).toString('hex'), ADMIN_EMAIL:email, ADMIN_PASSWORD:password};
fs.writeFileSync(envPath,Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
console.log('New local-only admin configured.\nEmail: '+email+'\nPassword: '+password+'\nKeep these private. Run npm run dev.');
