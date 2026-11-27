# Australia–England fantasy update — 10 November 2026

## Delivered

- Permanent server-side match lock and once-per-series booster consumption, including legacy state reconciliation and storage-failure handling.
- Full lineup freeze, immutable consumed history and protection against stale cancellation requests.
- Clear available/reserved/consumed inventory, confirmation, cancellation, used counts and personal series history.
- Navy/slate page and panel theme, Australian gold/green identities, English red/navy identities, mobile safe-area navigation, larger touch controls and reduced-motion support.
- Sound preference covers player-selection sounds and spoken submission announcements.
- Transparent base × leadership × booster points in the player breakdown.
- Admin toolbar lazy loading and one fixture request per refresh instead of two.
- Fixed the existing Node static-serving route order so the built frontend can load with npm start.
- Fixed an existing T20 standings error: all-out NRR innings now use 120 balls rather than the old ODI value of 300. The fantasy scoring table itself remains unchanged.

## Run locally

From the extracted project folder, install once:

```sh
npm ci
npm --prefix frontend ci
```

If this is a new local installation, run `npm run setup:local` once. If you already have .env.local and local data, keep them; do not rerun setup just to update source files.

Two terminals:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

Open http://localhost:5173. Alternatively `npm run dev` starts both. Keep existing admin credentials. This package has not changed the authentication/setup configuration or your passwords.

```sh
npm test
npm run build
```

## Deploy and preserve data

This work modified the supplied code only; no production database or deployed site was accessed. Before deployment, export a backup of your existing Redis state using your hosting/provider tools and verify that the backup is readable. Keep existing .env/.env.local files, api/data files, Redis variables, JWT_SECRET, administrator settings and GAME_NAMESPACE. Do not run Reset Tournament. Do not upload your environment files to GitHub.

Deploy frontend and backend together to avoid cached older cancellation clients. Namespace defaults and legacy fallback keys are unchanged. Schema additions are reconciled on the first request and committed under the existing persistence transaction. A GET may now write an elapsed deadline/consumption record.

Rollback: do not simply redeploy the old cancellation implementation: it ignores consumed timestamps and can refund LIVE boosters. Pause entries, retain the current backup, and roll back only with this lock enforcement retained, or restore a verified pre-deployment snapshot while accepting that later entries would be lost. No automatic rollback or data reset is included.

## Rules references

Reviewed official reference material on 10 November 2026:

- IPL Fantasy terms: https://fantasy.iplt20.com/classic/more/tnc — scheduled-start edits and captain 2× / vice-captain 1.5×. Search-index text was available; a direct page fetch returned 502.
- ICC fantasy guide: https://www.icc-cricket.com/news/a-guide-to-icc-dream11-daily-fantasy-challenge — historical product documentation supports deadline-based team edits and leadership multipliers.
- ICC 2024 fantasy explanation: https://www.icc-cricket.com/tournaments/t20cricketworldcup/news/how-to-play-fantasy-cricket-during-the-icc-men-s-t20-world-cup-2024 — tournament-specific booster rules differ.
- Cricket Australia: https://www.cricket.com.au/ — official series context; fixtures and squads in this package were intentionally preserved.

There is no single universal ICC/IPL booster standard. Your five once-per-series boosters and permanent admin-lock policy are this game's custom rules, not an official affiliation or reproduction. Palette colors are interface choices inspired by team identities, not verified exact 2026 jersey specifications. Existing custom base scoring was deliberately retained, including its historic minimum-ball/over thresholds; it is not advertised as official ICC/IPL T20 scoring.

See TEST_REPORT.md for actual execution evidence and limitations, POWER_BOOSTERS_UPDATE.md for behavior, and CHANGED_FILES.md for the file list.
