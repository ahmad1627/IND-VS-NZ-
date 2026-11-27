# Current update

See [UPGRADE_NOTES.md](UPGRADE_NOTES.md) and [TEST_REPORT.md](TEST_REPORT.md) for current instructions and validation. The older release observations below are retained for context. Do not rerun setup on an existing local installation merely to update code.

# Localhost and optional live scores

## Start on Windows / VS Code
Open a terminal inside the extracted project folder:

```sh
npm ci
npm --prefix frontend ci
npm run setup:local
npm run dev
```

Visit http://localhost:5173, choose Sign In, then open Admin after login.

- Email: ahmadtahseen140@gmail.com
- Password: 1234567889101112

These credentials are created only by `setup:local` in the ignored `.env.local` file. Development commands explicitly enable localhost mode; `npm start` and the Vercel API do not enable it. The backend and Vite dev server bind to loopback. Production still uses its existing environment credentials and Redis settings.

Localhost uses `api/data/localhost.json` to avoid changing live users, entries or Redis. It starts as a fresh test competition. Stop the backend before repeating `npm run setup:local`; repeating it resets this account but retains the other users and teams in that local test file. Keep your existing `.env`, Redis variables, GAME_NAMESPACE and data folders when updating an installation.

## Enable the optional free score feed
1. Get your own free API key: https://cricketdata.org/signup.aspx
2. Add this line to the root `.env.local` for localhost:

```dotenv
CRICKET_API_KEY=your_actual_key_here
```

3. Restart `npm run dev`. For production, set `CRICKET_API_KEY` in backend hosting environment variables and redeploy. Never use a VITE_ prefix for this key.

Provider: CricketData.org currentMatches endpoint. References:
- https://cricketdata.org/live-cricket-score-api/
- https://cricketdata.org/pricing/

The documented free plan offers 100 requests/day. This integration waits 15 minutes between provider attempts (up to 96/day for one continuously running instance; provider dashboard tests and other apps also consume quota). Hosted instances with Redis share a 15-minute request window and cached results. Local process restarts reset the in-memory window; multiple independent deployments without shared Redis can consume more quota. Free service coverage, delay and availability depend on the provider.

The panel displays Australia vs England T20 scores for the selected fixture date only. Missing/ambiguous results show a message. A failed request retains the last successful data with a stale label; with no key the panel stays hidden. Requests time out after five seconds and do not enter the game-save queue. This adapter fetches the provider's first current-matches page; if the match is absent from that page, it shows no score rather than spending extra free-plan requests.

This is a periodically refreshed score display, not ball-by-ball or automatic fantasy scoring. Existing admin-entered statistics, points, locks, players, squads and standings remain authoritative.

## Changes and checks
- Shared gold/green Australia and red/navy England token colours in selection and both pitch views. C and VC appear on every match. 3X badges appear only if the once-per-series 3X booster was reserved.
- Admin dashboard downloaded only when opened; production build creates a separate 24.63 kB chunk (5.98 kB gzip).
- Existing backend/persistence/production/HTTP suites and 12 React tests passed.
- Five new mocked provider tests passed: missing key, concurrent request deduplication, fallback, malformed responses, shared Redis cache and Redis failure.
- Requested localhost credentials successfully authenticated with admin privileges over HTTP.
- Production build passed. Real upstream score delivery was not tested because no provider key was supplied.
- Browser screenshot verification was unavailable because this environment blocked Chromium startup.
