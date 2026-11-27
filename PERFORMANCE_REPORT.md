# Performance update — Australia vs England fantasy cricket

The uploaded application was modified in place. No production database was accessed or reset. Existing Redis namespace/configuration, credentials, game data, seed fixtures, scoring, eligibility, booster multipliers and cutoff rules are unchanged. All original project files are retained. Production CSS is byte-identical. The loading panel now appears before the team response and offers a close button using the existing styling.

## Measured causes and changes

1. Overall leaderboard repeatedly searched all users, candidate managers and teams. Request-local indexes replace these nested scans without storing rankings between requests. Match leaderboard user lookups are indexed too. Ordering, tie rules and payloads are preserved.
2. Snapshot restoration searched all users once for each legacy team missing manager metadata. A lazily built index preserves the same enrichment with linear lookup cost. This benefits every persisted API route.
3. Every request acquired the Redis lease, read the state, then released the lease in three sequential network round trips. A Lua operation now atomically acquires the SAME lease and reads its protected snapshot in one trip. Unchanged reads need two trips; changed writes need three instead of four. Initialization/migration and contention can require more. The queue, lease duration, retry deadline, CAS commit, ownership check, error rollback and both deadline reconciliations remain intact. Responses still wait for durable commit. This is not a lock-free read path.
4. The old team modal opened only after the response. It now opens synchronously, cancels obsolete requests and rejects late manager/account responses. Repeated clicks on the selected manager do not refetch. It refreshes every 15 seconds while visible and after local mutations; errors close the preview and show retry guidance rather than inventing a zero-point XI from an unsaved draft.
5. Axios now shares equivalent concurrent GETs. Fixture changes cancel obsolete player/team loads; existing independent player/team requests remain concurrent. Overall standings no longer refetch just because the builder's selected fixture changes. Visibility restoration refreshes match locks and rankings. Existing live-score hidden-tab behavior and lazy admin screens remain.
6. An open player breakdown resolves its selected player from the latest response so corrections update its points.

## Reproducible before/after results

Local Node HTTP server, identical synthetic 1,000 managers / 5,000 teams / 931,284-byte snapshot, same host. No real users or database were used. The Redis test double executes the persistence branch and injects **20 ms per round trip**. A first request and ten repeated requests were measured for each read. “Cold” here means the first HTTP request for that route, NOT Vercel process startup or browser cold load. Median is the sorted sample at index 5 of ten repeated requests. Variance and raw samples' summaries are in `docs/performance`.

| Route | First request ms, before → after | Repeated median ms, before → after | JSON body bytes, unchanged |
|---|---:|---:|---:|
| `/leaderboard/overall` | 186.78 → 82.74 | 107.20 → 59.18 | 225,790 |
| `/leaderboard?match_id=1` | 89.08 → 61.71 | 84.40 → 58.49 | 209,970 |
| `/leaderboard/team/1` | 77.28 → 54.37 | 75.77 → 53.32 | 4,411 |
| `/matches` | 91.64 → 65.39 | 76.67 → 53.63 | 3,017 |
| `/matches/1/players` | 77.77 → 53.21 | 76.56 → 53.71 | 21,003 |
| `/teams/my-team?match_id=1` | 74.52 → 54.06 | 76.41 → 54.93 | 2,240 |
| `/power-boosters?match_id=1` | 76.60 → 53.72 | 75.96 → 54.00 | 813 |

All seven read response SHA-256 hashes match before/after for these fixtures. A leaderboard or team opening still needs one HTTP request; repeated three clicks before the team arrives changed from **3 requests to 1**. Player pool and own-team loading remain two concurrent HTTP requests, each with fewer Redis round trips. No view fields were removed merely to shrink a payload.

Five alternating real lineup writes followed by booster apply/cancel operations in the disposable test database:

| Operation | Before median ms | After median ms |
|---|---:|---:|
| save | 96.17 | 76.60 |
| apply | 95.51 | 77.11 |
| cancel | 95.61 | 76.32 |

Three simultaneous reads (`/matches`, overall leaderboard, team details) completed in **262.38 → 164.67 ms** with the same simulated Redis latency. They still serialize safely.

A separate zero-delay Redis-double run separates CPU costs from simulated storage latency:

| Route | HTTP median ms | Route computation median ms | Snapshot restore median ms |
|---|---:|---:|---:|
| `/leaderboard/overall` | 41.10 → 19.68 | 22.10 → 2.40 | 3.33 → 0.52 |
| `/leaderboard?match_id=1` | 22.66 → 18.30 | 7.22 → 4.43 | 2.48 → 0.23 |
| `/leaderboard/team/1` | 15.10 → 12.59 | 0.03 → 0.03 | 3.13 → 0.29 |
| `/matches` | 16.08 → 11.73 | 0.00 → 0.00 | 2.71 → 0.17 |
| `/matches/1/players` | 15.67 → 11.54 | 0.00 → 0.00 | 3.00 → 0.17 |
| `/teams/my-team?match_id=1` | 14.78 → 11.73 | 0.00 → 0.00 | 2.85 → 0.17 |
| `/power-boosters?match_id=1` | 14.19 → 11.99 | 0.00 → 0.00 | 2.37 → 0.18 |

Route computation is measured immediately before `res.json`, excluding persistence serialization. `Server-Timing` now reports `queue`, `lock_wait`, `lease_snapshot`, `storage`, `snapshot`, `handler`, `serialize`, and `commit_release` independently on normal persistence responses. `storage` includes lease/snapshot acquisition and restore, so do not add overlapping fields. `lock_wait` includes failed acquisition attempts and retry sleeps; successful lease/snapshot round-trip time is separate. See after-redis.txt for actual queue durations in the simultaneous batch. Baseline queue and lock wait were not separately instrumented; no baseline split is claimed. A contention fault-injection test verifies two retry waits of at least 90 ms total.

## React and feedback measurement

Identical jsdom/React Profiler harness, fixed 100 ms API response delay, three clicks:

- Before: feedback only when the team arrives, 113.20 ms; team DOM 113.20 ms; 3 GET calls; summed React actual duration 8.33 ms.
- After: loading feedback DOM 6.09 ms; team DOM 114.42 ms; 1 GET call; summed React actual duration 5.95 ms.

These are controlled DOM/React measurements, **not screen paint, mobile-device timings or production performance scores**. The fixed-delay test intentionally keeps actual team arrival similar; real data-path improvements are measured separately above. Network/server costs, not animation changes, explain the main improvements.

Production initial JS: 367.67 kB → 370.32 kB (gzip 104.90 → 105.69 kB). The small increase buys request cancellation/deduplication and refresh safeguards; this update does not claim a bundle reduction. CSS stays 90.85 kB with the identical content hash. Existing optional admin chunks remain lazy-loaded; no additional dependencies were added.

## Cache and privacy contract

There is NO resolved-response, private-lineup, browser-storage or cross-request leaderboard cache. Request-local server indexes expire at request completion. The frontend pool owns only pending promises, keyed by exact URL, parameters (including match/team IDs where applicable) and current JWT context. Entries expire at settlement or when all subscribers cancel; existing Axios timeout is 15 seconds. One consumer cancel does not cancel other subscribers. Logout/account changes and cross-tab token storage events abort pending private reads. A context check prevents an old account result from resolving into a new account.

Every successful local mutation clears pending reads and announces `fantasy-data-changed`. An interrupted read may retry once only if its view still needs it and the authorization context is unchanged. The leaderboard and open team subscribe to mutation events and refresh. Every new settled lookup reaches the authoritative server, so there are no completed-match cache entries to invalidate after corrections, deletion or finalization. Remote changes are fetched on the next visible 15-second refresh or visibility restoration; updates are not pushed in real time. Previously displayed scores can remain between polls, and refresh failure is reported rather than treated as fresh. Authenticated persistence responses use `private, no-store`. The server's existing owner/admin/deadline privacy check runs for every lineup request.

## Verification

`npm test` passed: seven backend groups (model, file persistence/restart, production invariants, HTTP, live-score adapter, power boosters and Redis transactions), plus **41 frontend tests across 8 files**. `npm run build` passed. Full original baseline tests also passed before modification.

Focused coverage includes rapid manager/fixture switching; response ordering; repeated clicks; transport cancellation; subscriber deduplication; mutation-triggered refresh/retry; account changes/logout; storage failure/retry; lineup privacy before lock; all five multipliers; irreversible consumption and permanent locking; failed/lost-lease commits; read-triggered deadline commits; concurrent scoring + lineup save + six leaderboard reads; corrected team/leaderboard points; process restart durability. The read response hashes match the original project. No scoring formula, seed file, CSS, lock lifecycle module, authentication backend, configuration, namespace or password was changed.

Limitations: no connection to your production Redis or website; the Lua path was exercised with a deterministic Redis double, not a live Upstash service. Cross-instance deployment latency, browser cold navigation, physical mobile/desktop layout and actual paint were not measured. Chromium launch was blocked by the environment's socket permissions. Actual devices and a deployed preview should be checked after deployment. The serialized snapshot architecture still has contention at high load; the queue and full snapshot serialization were deliberately retained for correctness.

## Changed files

Existing files:

- `backend/test_transaction_suite.js`
- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/components/Leaderboard.jsx`
- `frontend/src/components/UserTeamPitchModal.jsx`
- `frontend/src/components/Leaderboard.test.jsx`
- `api/_lib/database.js`
- `api/_lib/app.js`
- `api/_lib/persistence.js`

New files:

- `frontend/src/readPool.js` — authorization-scoped in-flight sharing, cancellation and expiry.
- `frontend/src/readPool.test.js`, `frontend/src/api.test.js`, `frontend/src/App.performance.test.jsx` — focused regressions.
- `frontend/src/performance.bench.test.jsx` — controlled React/DOM benchmark.
- `scripts/benchmark-performance.js` — isolated HTTP/Redis-double benchmark (never points at live Redis).
- `PERFORMANCE_REPORT.md` and `docs/performance/*` — this report and raw verification output.

## Run locally and deploy

From the extracted project folder, with your existing local configuration and saved data retained:

```bash
npm ci
npm --prefix frontend ci
npm run dev
```

Open http://localhost:5173 (backend http://127.0.0.1:5000). You can also run `npm run dev:backend` and `npm run dev:frontend` in separate terminals. The existing dev runner uses `.env.local` and `api/data/localhost.json`. Copy those from your current local project if using a new extraction folder. Do not run setup again over an existing installation merely to apply this update: the original setup script configures the local administrator account. For a completely new isolated local installation only, the existing `npm run setup:local` command supplies that configuration; it was not run on your uploaded data.

```bash
npm test
npm run build
node scripts/benchmark-performance.js
# Optional controlled Redis latency benchmark (bash):
BENCH_REDIS_MS=20 node scripts/benchmark-performance.js
# PowerShell equivalent:
# $env:BENCH_REDIS_MS="20"; node scripts/benchmark-performance.js
```

Deploy the updated source to the same GitHub/Vercel project using your existing build settings. Keep all existing environment variables, Redis URL/token, GAME_NAMESPACE, JWT secret and admin credentials unchanged. No migrations or resets are needed. Keep existing local database files if deploying to a filesystem host. Rebuild rather than serving an old dist folder. The ZIP contains the complete source project and verification artifacts; generated node_modules and dist folders are omitted and recreated by installation/build. No deployment was performed on your behalf.
