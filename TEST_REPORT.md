# Validation — 10 November 2026

Executed `npm ci`, `npm --prefix frontend ci`, `npm test` and `npm run build` successfully. Full logs are in docs/verification/.

## Passed

- 26 React/jsdom tests in four files: saved-team read-back, account draft isolation, save errors, booster confirmation/retry, 3X targeting, lock cancellation controls, leaderboard and squad-admin regressions.
- Five provider-adapter tests using mocks: no key, cache/deduplication, malformed responses, provider failure, Redis outage.
- 19 static production-path assertions (these are source checks, not end-to-end tests).
- Backend roster/fixture/scoring checks; account/password-hash/admin preservation and snapshot round-trip checks.
- HTTP integration: signup/login, five independent teams, eligibility pools, duplicate rejection, authenticated admin scoring/lock, stale-score revision rejection, all-out T20 NRR correction.
- Booster integration: five role multipliers, negative points, C/VC exclusions for 3X, no automatic booster, pre-lock cancellation/switching, repeated applies/cancels, stale cancellation identity, early admin lock, full team freeze, scheduled cutoff, first-delivery evidence, LIVE legacy state, reuse rejection, reopen/reschedule rejection, score corrections, no-result, separate user inventory and a new-process disk restore.
- Redis persistence branch with a deterministic test double: rejected commit, lost lease, failed apply/cancel rollback, safe retry and durable read-triggered cutoff. No real Redis service was contacted.
- Vite production build and source syntax through build/tests.

## Performance evidence

Same environment, original ZIP versus updated source. Measurements are build artifact sizes, not live-user latency.

| Metric | Original | Updated |
|---|---:|---:|
| Main JS, uncompressed | 390.91 KB | 367.67 KB |
| Main JS, gzip | 110.22 KB | 104.90 KB |
| CSS, uncompressed | 91.92 KB | 90.85 KB |
| CSS, gzip | 15.06 KB | 15.19 KB |
| Fixture API calls per refresh | 2 | 1 |

Admin tools load separately. The CSS gzip size increased slightly; no claim is made that every artifact shrank. Backend read reconciliation adds lease work for integrity rather than removing validation for speed.

## Not verified here

Chromium could not start: the environment rejected its socket creation. Therefore real-browser screenshots, viewport checks at 320–1920px, keyboard/focus walkthroughs, device accessibility, Lighthouse and LCP/INP/CLS measurements were not completed. Responsive CSS and component tests are not substitutes for those checks.

Real Upstash networking, multi-instance production load, real delayed/lost network delivery, deployment, real cricket feed coverage and live credentials were not tested. Retry/lost-response UI behavior and persistence failures were simulated. No production data was changed. These passing tests do not establish a guarantee of zero defects.

## Remaining existing limitations

The optional score API is display-only; fantasy scoring remains admin-managed. Email verification, automatic password-reset delivery and social login remain unconfigured as in the supplied application. No private-league feature was present in this codebase, so none was invented. Published fixtures and squads have not been newly certified or silently changed. Historical booster reservations deleted by the old cancellation policy cannot be recovered from absent records.
