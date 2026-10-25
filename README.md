# CitizenWater

CitizenWater is a phone-first Progressive Web App (PWA) for reporting water problems and recording follow-up. A citizen can save a report on the current device, share a private report and photo link through their own email app, and later mark the issue still open or fixed.

## Inspiration

Water leaks and other service problems are easier to address when people can describe what they saw, include a location and photo, and follow up later. CitizenWater was shaped around that simple citizen-led journey, with offline use in mind.

## What it does

- Captures or selects a photo, requests device location, and matches the location to the nearest contact in a small, clearly labeled sample utility directory.
- Saves report details and the photo in browser IndexedDB so pending reports remain available on that device, including offline.
- When the citizen chooses **Open email draft**, the Express server stores a shared copy in Supabase and returns a private link that expires after 30 days. Photo access uses a short-lived signed URL.
- Opens the citizen's email app with a prefilled draft. The citizen reviews and sends it; CitizenWater does not send or verify email.
- Lets the citizen record whether the issue remains open or is fixed. This is citizen follow-up, not independent confirmation from the utility.

The app does not require an account. Reports saved locally are specific to that browser and device. The utility directory is sample data for Crown Gardens, Johannesburg; it is not worldwide or verified service-area coverage.

## How we built it

The user interface is built with HTML, CSS, and browser JavaScript. IndexedDB keeps reports and photo files on the device. A Node.js 24 and Express server connects to Supabase Postgres and a private Storage bucket when the citizen requests a share link. The PWA manifest and service worker support installation and cache the public app shell. Email uses a prefilled mailto draft in the citizen's email app; there is no paid AI or email-provider API.

## Challenges we ran into

Getting a photo from the browser to the server and then into a private Supabase bucket required checking each step separately. We resolved a bucket-name mismatch and a browser photo-read issue during development. We also had to make offline status honest: reconnecting cannot send an email, and opening a draft cannot prove it was sent. Camera and location testing on phones also requires HTTPS and browser permissions.

## Accomplishments that we're proud of

The main journey now works from writing a report through private photo sharing and later follow-up. The learner confirmed that the private report/photo link worked, that closing a draft leaves the report pending, and that offline pending reports remain saved until the citizen reviews them. Fixed reports can be archived, and the PWA can be installed on supported phone browsers.

## What we learned

Local browser storage and cloud storage solve different problems: IndexedDB keeps a report available on one device, while Supabase provides the shared report link. A service-role key must stay on the server. A mailto draft hands control to the citizen's email app, so CitizenWater cannot know whether a message was sent or delivered. Testing the actual browser, phone, and hosting environment helped uncover setup issues that were not visible from the code alone.

## What's next for CitizenWater

The next steps are to verify location behavior in the remaining target browser, expand the utility directory with confirmed contacts and service areas, and add production safeguards such as automatic cleanup of expired cloud photos and reports, monitoring, and stronger abuse controls. Utility acknowledgements and repair verification would require a separate utility-facing workflow.

## Run locally

Requirements: Node.js 24 and npm.

1. Clone the repository and open a terminal in its folder.
2. Install dependencies:

       npm ci

3. Create a local .env file in the project folder with your Supabase project URL, server-only service-role key, and private Storage bucket name:

       SUPABASE_URL=https://your-project-ref.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret
       SUPABASE_PHOTO_BUCKET=your-private-bucket-name
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

The service-role key must stay on the server. Never put it in browser code or commit it. The local .env file is ignored by Git.

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
