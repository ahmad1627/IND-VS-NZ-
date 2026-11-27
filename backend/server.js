if (process.argv.includes('--local') && !process.env.VERCEL && process.env.NODE_ENV !== 'production') process.env.FANTASY_LOCAL_MODE = 'true';
const app = require('../api/_lib/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, require('../api/_lib/config').local ? '127.0.0.1' : '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(` 🏏 Pakistan A vs Sri Lanka A Fantasy 2026 API`);
  console.log(` Runtime: Node.js (Express)`);
  console.log(` Server running on http://127.0.0.1:${PORT}`);
  console.log(` Health check:     http://127.0.0.1:${PORT}/api/health`);
  console.log(` API Endpoint:     http://127.0.0.1:${PORT}/api/matches`);
  console.log(`======================================================\n`);
});
