# Admin lock/unlock and live fantasy points update

## Controls
- Confirm the final qualification using existing admin activation, then use LOCK LINEUPS or UNLOCK LINEUPS in the dashboard, quick toolbar or scoring modal.
- Admin can reopen before or after scheduled start / first delivery and after live score entry. Reopening is an explicit override that stays open until the admin locks again, even after the scheduled cutoff. All managers can edit while open; after known performances, this can affect contest fairness. A confirmation warns about this.
- Completed/finalized matches cannot be reopened; admin can use existing result correction. Every change records the admin ID, timestamp and lock state (last 100 changes). Explicit desired-state API requests are idempotent. Ordinary users cannot change locks.
- Reopening changes consumed 3X uses for this fixture back to reserved, preserving reservation ID. The user can change/cancel one booster while open. When relocked it becomes consumed again. Existing match/user IDs and storage namespaces stay intact.
- Score entry requires a locked fixture. Lock again before saving live stats. Manual locking no longer falsely sets the match to LIVE; actual score entry sets LIVE.

## Live points (no paid data API)
1. Lock the confirmed match.
2. Open admin scoring and enter cumulative verified player statistics (including playing XI).
3. Use Save Live Scores / Save Live Statistics (do not finalize until the result is official).
4. Existing server scoring recalculates all fantasy teams and ranks; the match leaderboard refreshes every 15 seconds while visible. The new My XI live points panel shows the saved XI, individual effective points, total, rank and score-save time; it refreshes while visible and does not overwrite a draft.
5. If the admin reopens selection, changes to saved team/leadership or 3X reservation recalculate points from the current authoritative saved scorecard.

Optional existing CricketData.org match-score display: set CRICKET_API_KEY on the server. It is cached for 15 minutes and displays match totals only. Provider publishes 100 hits/day on its free tier, near-live data and Fantasy API trial mode: https://cricketdata.org/pricing/. No key or confirmed coverage for this final was provided. Automatic ball-by-ball/player-stat imports are NOT implemented; no fake live points are generated. Manual verified data remains authoritative.

## Verification
11 backend test scripts exited successfully, including the new authenticated HTTP admin-reopen regression and existing Python AI integration, simulated Redis fault injection, scoring and persistence suites. The production suite is static source checks. 44 frontend source JS/JSX files parsed successfully with Babel. Full production build was attempted; see docs/admin-live-test-results/frontend-build.log. No hosted Redis or live Vercel deployment was accessed. Browser UI verification remains necessary.

Local: install dependencies using npm ci and npm --prefix frontend ci, restore your own existing .env.local and local data (check LOCAL_DATA_FILE in your existing environment; default api/data/ind-nz-odi.json), then npm run setup:local and npm run dev. Keep existing environment values, backup data first; do not reset tournament. Run npm run test:admin-reopen for the new isolated test. Use a Vercel preview before production.
