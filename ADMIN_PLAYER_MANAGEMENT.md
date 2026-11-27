# Admin player management update

Open Admin → Manage Australia / England T20I squads after signing in as an administrator.

## Included

- Add New Player: manual name, Australia/England, WK/BAT/AR/BOWL, actual fixture checkboxes, active status, availability, optional provider ID and HTTPS photo URL. The backend assigns a unique numeric ID. No demo players are added.
- Edit existing names, roles and teams without changing their IDs. Click Edit / Manage Matches to reveal optional photo and note fields; the main fields and fixture checkboxes are directly editable.
- Search and filters for team, role, fixture, active status and availability.
- Select All / Deselect All modify only permitted fixture assignments. Empty eligibility is supported. Existing players can be deactivated instead of deleted.
- Save, Cancel Changes, Refresh Player List and Undo Last Saved Edit. Undo retains the last 10 saved batches; newly added players are deactivated instead of deleted. Locked or already-selected match eligibility is retained during undo.
- Confirmation before disruptive role/team/status changes. Concurrent stale editors receive a refresh-required error instead of overwriting another admin's changes.
- Player updates refresh the current browser's selection pool and are available on other browsers after refresh. Existing read-pool invalidation remains in use.

## Historical protection

Before an edit, locked, started, completed or scored matches receive their original player roster snapshot if one does not already exist. Scoring, booster role calculations, saved-team displays and historical dream-team calculations resolve that match's roster. New player edits apply to future matches. Eligibility changes to protected fixtures are rejected. Removing a player already selected in an unlocked saved team is also rejected.

Saved teams are never deleted or silently rebuilt. Role, team, inactive or OUT changes can make an existing unlocked team invalid for its next submission; managers may need to update those teams before lock. The admin confirmation explains this. Historical points and all five booster formulas are unchanged.

## Storage and deployment

The existing Redis state key, namespace and transaction mechanism are retained. Backward-compatible state fields hold player-edit history and match roster snapshots. Local mode continues to persist to its configured JSON file; Vercel continues to require the existing Redis configuration. No production database was contacted or reset during this work.

Keep your existing environment configuration and local data files when replacing source files. Do not run setup again merely to install this update. Install dependencies and start from the project root:

```sh
npm ci
npm --prefix frontend ci
npm run dev
```

For a fresh localhost installation only, run `npm run setup:local` once before `npm run dev`, as described in LOCAL_AND_LIVE_SETUP.md. Open http://localhost:5173. The existing admin login setup is unchanged.

Production build: `npm run build`. Deploy with your existing hosting workflow and environment variables.

## Verification

- `npm test`: existing backend, persistence, HTTP, live-score mocks, boosters, transaction, engagement, frontend and localhost-startup checks, plus new player-management integration checks.
- New API checks cover admin authorization, additions after a team exists, server-generated IDs, optional external ID, fixture filtering, active status, all role transitions, unknown fixture/role rejection, deletion rejection, stale edits, undo, state restore and historical roster/multiplier preservation.
- React checks cover clickable eligibility, protected fixtures, adding a player, search and cancelling edits.
- `npm run build`: production frontend bundle.
- Logs: docs/player-management/tests.txt and build.txt.
- The Vite startup check prints an optimizer cancellation message during teardown; its assertions pass and the full test command exits successfully (0).

Live Redis deployment and interactive browser appearance were not tested in this environment. No live API provider account was used. Optional photo URLs are stored and returned by the player API; the existing team-color pitch icons remain unchanged.

The uploaded prompt ends mid-sentence under External API compatibility. All complete requirements in the supplied text were used; manually added players do not require an external ID and remain usable with existing manual scoring.
