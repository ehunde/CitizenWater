# CitizenWater

CitizenWater is a phone-first Progressive Web App (PWA) for reporting water problems and recording follow-up. A citizen can save a report on the current device, share a private report and photo link through their own email app, and later mark the issue still open or fixed.

## What it does

- Captures or selects a photo, requests device location, and matches the location to the nearest contact in a small, clearly labeled sample utility directory.
- Saves report details and the photo in browser IndexedDB so pending reports remain available on that device, including offline.
- When the citizen chooses **Open email draft**, the Express server stores a shared copy in Supabase and returns a private link that expires after 30 days. Photo access uses a short-lived signed URL.
- Opens the citizen's email app with a prefilled draft. The citizen reviews and sends it; CitizenWater does not send or verify email.
- Lets the citizen record whether the issue remains open or is fixed. This is citizen follow-up, not independent confirmation from the utility.

The app does not require an account. Reports saved locally are specific to that browser and device. The utility directory is sample data for Crown Gardens, Johannesburg; it is not worldwide or verified service-area coverage.

## Run locally

Requirements: Node.js 24 and npm.

1. Clone the repository and open a terminal in its folder.
2. Install dependencies:

       npm ci

3. Copy .env.example to .env and enter the Supabase project URL, server-only service-role key, and private Storage bucket name.
4. Start the app:

       npm start

5. Open http://localhost:3000.

For watch mode during development, run npm run dev.

The browser's camera and location features require a secure context. Use HTTPS when trying the app on a phone; localhost is suitable for local development on the computer.

## Supabase setup

Before enabling cloud sharing:

1. Create the public.reports table with the fields expected by the app. The required column names are checked by the local diagnostics endpoint in server.js.
2. Create a **private** Storage bucket for report photos.
3. Apply [supabase/server-access.sql](supabase/server-access.sql) in the Supabase SQL editor. It enables RLS and grants the server role the table access it needs; it does not grant anonymous access.
4. Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_PHOTO_BUCKET to the server environment.

The service-role key must stay on the server. Never put it in browser code or commit it. .env is ignored by Git; .env.example contains placeholders only.

The local-only diagnostics page is http://localhost:3000/api/diagnostics/supabase. It reports whether server configuration, the reports table, and the private bucket are reachable. It is intentionally unavailable on non-local hosts. The general readiness route is /api/health.

## Deploy on Render

The repository includes [render.yaml](render.yaml). Create a Render Web Service from the GitHub repository and configure the dashboard environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_PHOTO_BUCKET to the exact private bucket name in Supabase. Render uses Node 24.21.0 and the repository's npm ci / npm start commands.

After deployment, open the HTTPS service URL. A static service host is not sufficient by itself: this app needs its Express server for the Supabase-backed share endpoints.

## Important behavior and limits

- Opening an email draft does not mean the email was sent. The citizen returns to CitizenWater and records that action.
- Offline reports are not sent automatically when connectivity returns; the citizen must review and open the draft.
- Shared report links expire, but expiry does not automatically delete the database row or photo. The citizen can delete a shared report from the original browser while its local token remains available.
- The app cannot verify email delivery, a utility response, or a repair.
- Production use would need broader verified utility coverage, automated retention cleanup, stronger abuse controls, monitoring, and privacy/legal review.

## Project layout

- public/ — app screens, styles, PWA manifest, service worker, and browser JavaScript.
- public/js/storage.js — IndexedDB storage for local reports and photos.
- public/js/app.js — report flow, email handoff, statuses, and archive.
- server.js — Express API and server-side Supabase access.
- src/data/utilities.json — labeled sample utility directory.
- supabase/server-access.sql — least-privilege table grants for the server role.
- devpost/ — project scope, product requirements, technical specification, checklist, and app map.

## License

See [LICENSE](LICENSE).
