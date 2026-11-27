# Localhost blank-page fix

The earlier update contained a development-only initialization error: EngagementHub called React.lazy before Vite's generated `const React` declaration. This caused `ReferenceError: Cannot access 'React' before initialization` and prevented the entire application from rendering. Production bundling and the earlier component tests did not reproduce this Vite development transformation.

The React import now comes first, before lazy component initialization. All existing game components and the engagement features remain included.

The local launcher now starts Node and Vite directly, works without shell-dependent quoting, checks port conflicts, stops both child processes together and points the frontend proxy at the configured backend port. Vite uses strict port 5173 instead of silently switching to 5174/5175/5177. Missing local configuration gives an explicit setup instruction.

## Windows / VS Code steps

1. Stop previous frontend/backend terminals with Ctrl+C. Close the old localhost tabs.
2. Back up your existing project. Extract the corrected ZIP. When moving to a fresh folder, copy your existing `.env`, `.env.local` and `api/data` into the corresponding locations first. Keep existing credentials and saved local teams; do not run setup again merely to update code.
3. In VS Code choose Open Folder and select `australia-england-t20-fantasy-2026`, the folder containing the main `package.json`.
4. Open Terminal → New Terminal and use PowerShell. Run:

```powershell
npm ci
npm --prefix frontend ci
if (!(Test-Path .env.local)) { npm run setup:local }
npm run dev
```

The conditional setup is for a new local installation only. If you already have local saved teams but lost `.env.local`, restore that file from your previous folder instead. `setup:local` configures the project's existing local test admin; rerunning it can reset that local admin password. No production credentials are changed.

5. Keep the terminal running. Open Chrome or Edge at **http://127.0.0.1:5173**. Use Ctrl+Shift+R once to refresh old loaded code.
6. The original site opens on the team builder. Click **Explore Fantasy Hub** below the fixture selector, then sign in to use the new features. History/achievements need real saved and completed-match data.

For later sessions, only run `npm run dev` from this same project folder.

## Optional two-terminal method

After dependencies and local configuration are ready, use the project root in both terminals:

Terminal 1:
```powershell
npm run dev:backend
```
Terminal 2:
```powershell
npm run dev:frontend
```

Open http://127.0.0.1:5173. The two-terminal method assumes the normal backend port 5000. The combined `npm run dev` command also handles a custom backend PORT automatically.

## Checks

- Reproduced the original Vite dev transformation's `Cannot access 'React' before initialization` error.
- Added `frontend/test-dev-startup.mjs`, which fetches and evaluates the actual development initialization code and is included in `npm test`.
- Added `frontend/src/Boot.test.jsx`, which mounts the real component tree, checks the original builder and opens the new hub as a guest.
- Tested the combined launcher with isolated temporary local configuration: frontend HTML and five-fixture API proxy succeed; duplicate startup fails clearly without changing ports.
- Full regression test/build output is in `docs/localhost-fix/`.
- Full browser visual acceptance and Windows execution have not been performed in this environment. The development transformation, component tree, launcher and HTTP routing were exercised directly.

Files changed by this fix: `frontend/src/App.jsx`, `frontend/vite.config.js`, `scripts/dev.js`, `package.json`. New regression tests: `frontend/test-dev-startup.mjs`, `frontend/src/Boot.test.jsx`. Compiled `frontend/dist` and root `dist` rebuilt. Gameplay, authentication, fixtures, scoring and booster rules were not changed by this fix.
