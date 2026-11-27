# Deploy the update

Deploy the repository root using the existing `vercel.json`. Preserve your existing Vercel environment settings: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, Redis REST URL/token, `GAME_NAMESPACE` and any existing frontend API URL overrides. Never add server secrets to VITE variables.

Keep a private export/backup of the current database before deployment. Do not run the admin Reset Tournament action to migrate: normal loading performs the non-destructive archive migration. Do not upload the old account JSON file to GitHub. Local migration details and terminal commands are in README.md.

After deployment, `/api/health` must report `AUS_ENG_T20_2026`; `/api/matches` must return five fixtures. Check an existing account login, admin access and a saved lineup before inviting users. Hosted requests fail safely when required credentials/Redis are unavailable.

Production Redis, Vercel deployment, real account logins and external live scoring could not be exercised in this workspace. No deployment was performed.
