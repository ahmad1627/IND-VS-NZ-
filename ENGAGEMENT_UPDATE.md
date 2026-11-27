> **Startup correction:** See [LOCALHOST_BLANK_PAGE_FIX.md](LOCALHOST_BLANK_PAGE_FIX.md). First-time local setup is required; retain existing local configuration and data when upgrading.

# Fantasy engagement update

This is an additive update to the uploaded React / Express fantasy project. Open **Explore Fantasy Hub** below the fixture selector. Existing navigation, colors, scoring, five boosters, captain/vice rules, lock lifecycle, credentials and hosting configuration remain in place.

## Features and where to find them

| # | Feature | Implementation and data requirements |
|---|---|---|
| 1 | Rank movement | Match leaderboard shows gained/lost/unchanged ranks and previous rank in its tooltip. Uses persisted checkpoints; first observation has no prior rank. |
| 2 | Head-to-head | Challenges → Head-to-head. Two registered saved XIs, C/VC, booster, common/different players, points ordered highest first, finalized winner/tie. Rival lineup access is blocked before reveal. |
| 3 | Achievement badges | My Performance → Achievements. Ten badges with tier, icon, exact rule, first-verification date and locked state. Result corrections revoke invalid awards. |
| 4 | Player analytics | Fantasy Insights → Player analytics. Completed-match totals, averages, highs, runs/wickets where stored, chart, consistency and recent change. |
| 5 | Dream Team | Fantasy Insights → Dream Team. Exact deterministic dynamic program maximizing the XI plus existing C/VC multipliers. Reuses existing eligibility/composition rules; no booster or lineup edits. Finalized scored matches only. |
| 6 | Private leagues | Challenges → Private leagues. Create/join, random invite codes, sharing, duplicate prevention, membership-private rankings, match histories/activity and final champions. No league implementation existed in the supplied ZIP; this is a separate additive collection. |
| 7 | Captain analyzer | Fantasy Insights → Captain analyzer. Compare two players, historical form leaders, consistency, post-lock captain popularity, and your finalized C/VC contributions. Past performance is not a prediction. |
| 8 | Points breakdown | Fantasy Insights → Points breakdown. Existing base categories, C/VC increments, booster increment and authoritative total. Unclassified adjustment is explicit; any mismatch is flagged. |
| 9 | Rank history | My Performance → Rank history. Rank and points charts plus paginated recorded checkpoints. These are per-match ranks, not a fabricated past overall ranking. |
| 10 | Predictions | Challenges → Predictions. One permanent vote per account/fixture, percentages/count, server cutoff, official winner and predictor badge. Isolated from fantasy points. |
| 11 | Smart validator | Team builder → Team readiness. Draft count, roles, C/VC and lock state; authenticated server check reuses submission composition checks. Does not save or bypass locks. |
| 12 | Celebrations | Activity → Activity feed → Celebrate new achievements. Confetti and existing optional sound, reduced-motion/mute support, server-side claim before display prevents replay on refresh or simultaneous tabs. User-triggered, nonblocking. |
| 13 | Weekly champion | Challenges → Weekly champion. Monday-to-Monday UTC; finalized scores assigned by scheduled fixture date. Current week shows leaders; ended weeks show champions, including ties. |
| 14 | Streak tracker | My Performance → Winning streaks. Current/best Top 10, participation, correct prediction and league-win streaks, with definitions visible. Unfinished fixtures excluded. |
| 15 | Selection popularity | Fantasy Insights → Player popularity. Actual distinct registered team submissions; player/C/VC percentages hidden before official reveal. |
| 16 | Differentials | Fantasy Insights → Differential players. Under 20% selection, historical average and rating (100 minus popularity); player button opens detailed history. No success guarantee. |
| 17 | Share fantasy XI | Activity → Share my XI. Browser Canvas PNG export, name/XI/C/VC/branding and labeled rank; final points only after completion. Server refuses export before reveal. No external image library or emails. |
| 18 | Countdown | Activity → Match countdown (also in Predictions). Server-clock offset, schedule, status and deadline; server alone enforces the lock. Original main countdown retained. |
| 19 | Manager profile | My Performance → My profile. Career summaries, avatar, achievements/history via subpages and privacy opt-in; other registered managers can view opted-in summaries. Email excluded. |
| 20 | Booster history | Activity → Booster history. All five existing boosters, availability/reservation/consumption/expiry, applied fixture and final bonus. Strictly read-only. |
| 21 | Personal records | My Performance → Personal records. Highest score/rank, captain/batting/bowling contributions, observed recovery and streak records. Completed scores only; no fictional history. |
| 22 | Activity feed | Activity → Activity feed. Observed rank gains, finalized scores/results, badges, correct predictions, best-score celebrations and league champions. Not ball-by-ball commentary. |

## Data and rule definitions

- There are **no new Redis keys or environment variables**. Existing key/namespace and transaction mechanism are byte-for-byte unchanged. New data lives in the clearly prefixed `engagement_v1` collection inside the existing persisted game snapshot. No migration command is required; existing fields are not reset.
- Collection: `{ version: 1, snapshots, votes, leagues, preferences, awards, seen }`.
- `snapshots[matchId]`: observed rank/point rows, status, score revision, hash and recording time. Up to 100 non-final checkpoints per fixture; finalized checkpoints retained. Recorded at successful score updates and leaderboard/hub reads. Legacy matches receive a baseline when observed, never invented historical changes.
- `votes[matchId][authenticatedUserId]`: choice, user ID, timestamp. No client-supplied voter identity. Same-vote retries are idempotent; different repeat votes rejected. Admin/first-delivery/scheduled permanent lock closes voting.
- `leagues[]`: UUID, owner, random invitation code, name, creation time, `{user_id, joined_at}` memberships. Owner/name retries and repeated joins are idempotent. Maximum ten owned leagues per manager. Existing submitted teams are the only entries; no ghost or duplicate accounts are created.
- `preferences[userId]`: `public_profile` defaults false. `awards[userId][badgeId]`: first verified date; invalid awards removed on correction. `seen[userId]`: claimed celebration event IDs.
- All writes use the existing serialized transaction, lease and compare/commit mechanism, including rollback if storage fails. Local JSON uses the existing atomic replacement path. Authentication derives identity from the existing verified session.
- League eligibility: fixture scheduled after league creation and manager joined by its persisted lock time (schedule if no lock recorded). League champion requires the whole configured series to complete and a positive total; tied first places share recognition. Membership and invite codes are visible only to members.
- Rankings preserve descending points and existing ID-based deterministic ordering, with competition ranks for ties. Orphan/deleted accounts are filtered from new analytics and the match leaderboard. No original score or multiplier formula was changed.
- Streaks: consecutive completed fixtures; missing participation breaks participation and Top 10. Top 10 needs positive points. Predictions count only official WIN results; ties/no-results are skipped. League wins use eligible completed league fixtures.
- Consistency uses `max(0,100*(1 - standard deviation / abs(mean)))`, at least two records; a zero mean uses denominator 1. Differentials have selection below 20%; rating is `100 - selection percentage`.
- Badges and legacy records have their first verification time, not a claimed original achievement date. Corrected finalized data recomputes analytics and can revoke awards. No paid service, external analytics platform, new database or premium dependency added.

## Run locally

From the extracted project root, preserve your existing `.env` and local data file:

```sh
npm ci
npm --prefix frontend ci
npm run dev
```

Frontend: `http://localhost:5173`. Backend: `http://127.0.0.1:5000`. Your existing admin credentials remain unchanged. Do not run a reset script or point local testing at production Redis. See `LOCAL_AND_LIVE_SETUP.md` for the original environment setup. No production secrets or registered-user export were supplied or added to this archive.

Validation commands:

```sh
npm test
npm run build
```

`npm test` includes the new `test:engagement` suite. Test fixtures are synthetic and confined to tests; the application does not seed fake teams or scores.

## Deploy safely to your existing hosting

1. Retain your current environment variables, Redis URL/token, `GAME_NAMESPACE`, JWT secret and admin settings exactly. Back up the current persisted game state using your existing process.
2. Deploy frontend and backend together using your current Vercel/repository workflow and unchanged `vercel.json`. For your existing Node host, run `npm ci`, `npm --prefix frontend ci`, `npm run build`, then `npm start`.
3. Open the existing site, sign in, verify a previously saved XI/leaderboard and open Fantasy Hub. Empty histories until real results exist are intentional.
4. Test predictions and league joins with your own authorized accounts before a fixture locks. Do not reset the tournament or import test fixtures into production.
5. No deployment was performed in this task. The ZIP is ready for your existing deployment workflow; real-hosting and visual device acceptance checks remain yours to perform.

## Validation and practical limits

- Full `npm test` passed, including original backend, persistence, HTTP, live-score, booster, transaction/fault suites and updated static checks.
- **47 frontend tests passed** (9 files). Includes all hub views with empty data, prediction action, errors/retry, pre-lock share blocking, validator, and existing team/leaderboard/booster UI tests.
- **40 new backend integration assertions passed**: authentication/privacy, orphan exclusion, concurrent vote/claim behavior, league deduplication/privacy, snapshots, corrections, scorer reconciliation, no game mutations, empty history and snapshot restore.
- Dream Team exact optimization matched an independent exhaustive oracle on a 12-player pool. Full-pool cold request in the final run was approximately 0.38 seconds; repeat results are cached by inputs.
- Production build passed. The Fantasy Hub is a separate lazy chunk: about 24.03 KB / 8.28 KB gzip. No new runtime dependencies.
- 1,000-manager / 5,000-team synthetic benchmark (Redis double, no network latency) showed no observed regression: match leaderboard median 47.56 ms before / 34.52 ms after; team inspection 21.86 / 18.00 ms. Both retain two Redis commands on unchanged warm reads. Runs are noisy and not a production speed guarantee. First/new snapshots require a commit.
- **Visual browser/device testing and actual PNG download inspection were not completed**: local Chromium could not start under the environment’s process restrictions and the remote browser could not reach the isolated local server. Responsive CSS and automated component tests pass, but real mobile/desktop visual acceptance remains unverified. Live production Redis and existing account credentials were not accessed.
- Score history and result-dependent panels need actual finalized records. No new live cricket provider was added. Historical statistics are limited to fields already saved by your scorer.
- Original source backup is included at `docs/engagement/original-source-backup.zip`. Restoring old source may discard the new engagement collection on future saves; retain a state backup before any rollback. Do not overwrite your current data with test files.

## Exact source changes

Modified files:
- `README.md`
- `api/_lib/admin.js`
- `api/_lib/app.js`
- `api/_lib/database.js`
- `backend/test_production_suite.js`
- `frontend/src/App.jsx`
- `frontend/src/components/Leaderboard.jsx`
- `package.json`

New code/test files:
- `api/_lib/engagement.js`
- `api/_lib/engagementRoutes.js`
- `api/_lib/teamComposition.js`
- `backend/test_engagement.js`
- `frontend/src/components/EngagementHub.jsx`
- `frontend/src/components/EngagementHub.test.jsx`
- `frontend/src/components/SmartValidator.jsx`
- `frontend/src/components/engagement.css`

New documentation/evidence: `ENGAGEMENT_UPDATE.md`, `docs/engagement/tests.txt`, `docs/engagement/build.txt`, `docs/engagement/benchmark-before.txt`, `docs/engagement/benchmark-after.txt`, `docs/engagement/original-source-backup.zip`. Fresh compiled output is included under `frontend/dist/` and `dist/`.

Protected source files verified byte-for-byte against the uploaded original:
- `api/_lib/scoringEngine.js`
- `api/_lib/boosterLifecycle.js`
- `api/_lib/auth.js`
- `api/_lib/persistence.js`
- `api/_lib/config.js`
- `api/_lib/seedData.js`
- `frontend/src/utils/fantasyAudio.js`
- `frontend/src/components/PowerBoosters.jsx`
- `frontend/src/components/PitchPreview.jsx`
- `frontend/src/components/TeamSubmissionCelebration.jsx`
- `vercel.json`
