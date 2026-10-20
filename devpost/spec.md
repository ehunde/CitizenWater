---
title: CitizenWater Technical Specification
status: approved
review_format: html
---

# CitizenWater Technical Specification

## Purpose and POC boundary

Build one full report journey for a sample service area: photograph a water problem, capture device coordinates, write a description, find the nearest listed utility, review and email the report, retain it offline when needed, retry after reconnection, and later mark it fixed or leave it open.

Worldwide use is the product goal, but a verified global utility directory is outside this POC. Use a small labeled directory. If no nearby match exists, show the nearest available entry, its distance, and that it is a fallback. Never invent a utility or contact.

## Technical decisions

| Area | Choice | Reason |
|---|---|---|
| Frontend | Semantic HTML, CSS, browser JavaScript | Matches learner skills; no framework or build step. |
| Backend | Node.js 24 LTS, Express 5 | Uses existing Node/Express knowledge. |
| PWA | Responsive UI, manifest, service worker | Installable shell and cached static resources. |
| Offline reports | IndexedDB on device | Stores report data and photo blobs for retry. |
| Shared reports and photos | Supabase Postgres and a private Storage bucket, accessed only through Express | Gives utilities a read-only report link without exposing the server key or making photos public. |
| Description | Citizen-written text in the browser | No model service or paid AI call is required. |
| Utility lookup | Deterministic distance calculation against sample coordinates | Explainable recipient choice; never guess contacts. |
| Email | `mailto:` draft opened by the browser | Uses the citizen's configured email app; the message includes a private report link. A downloaded photo remains a fallback if cloud sharing is unavailable. |
| Demo hosting | Local development, then temporary HTTPS preview | Real phone camera/location/install need a secure context. |
| Accounts/database | None in POC | Keeps first journey small; reports stay on-device. |

No email-provider credentials or paid email API are needed. The `mailto:` draft includes the listed utility address, report details, approximate location, and map link. Download the photo separately and attach it in the citizen's email app. The app cannot confirm that a draft was sent or delivered.

## Where it runs

Develop with Express on the computer using localhost. A phone cannot access that localhost, so create a temporary HTTPS preview for phone testing. Request camera/location permission during reporting, explain why coordinates are needed, and provide recovery states for denied/unavailable permission. Install from supported mobile browsers; App Store, Google Play and AppGallery publishing/native packaging are outside this POC. Mark sample contacts as test data unless confirmed. `mailto:` behavior depends on an email app or handler configured on the device.

## Data flow

1. User takes/selects a photo and writes a short description. Save the report and photo in IndexedDB when the citizen saves it.
2. Request current coordinates; save latitude, longitude and capture time. Never claim a nearest utility was found without location.
3. Compare coordinates with sample utilities, order by geographic distance, and show the nearest entry, distance and contact options. If no nearby match exists, show the nearest available fallback and disclose that sample coverage does not prove jurisdiction.
4. User reviews/edits the manually written description, checks the listed email destination, and chooses Open email app. The browser sends the report fields and photo to Express. Express stores the photo in the private bucket and the row in `public.reports`, then returns a 30-day private link. The prefilled email includes that link and a map link. If cloud sharing fails, the user can still download and attach the photo.
5. On returning to CitizenWater, the user may mark the email sent. This is the citizen's record; CitizenWater cannot verify the email was sent, delivered, read, or acted on.
6. Offline reports remain in IndexedDB as pending. They are not uploaded or emailed until the citizen opens the email draft while online. When online while app is open, show reminder/retry; if closed, show it next launch. No closed-app push.
7. User can mark report fixed and archive it, or leave it open. This is citizen feedback, not independent verification.

## Components and files

```text
public/
  index.html, styles.css, manifest.webmanifest, service-worker.js
  js/app.js                 screens and actions
  js/location.js            permission, coordinates, recovery
  js/storage.js             IndexedDB report/photo persistence
  js/utility-matcher.js      distance and candidate ordering
src/
  data/utilities.json       labeled sample utilities
server.js                   Express, utility directory, static files
supabase/server-access.sql  least-privilege access for the server role
package.json, .env.example, .gitignore
devpost/scope.md, prd.md, spec.md, spec.html
```

The service worker caches public app-shell/static assets only, never private reports or API responses. Utility records use stable IDs, approximate coordinates, and clearly labeled demo contacts. Keep the Supabase secret/service-role key only in the server's `.env`; never add it to frontend files or commit it. The server stores only a SHA-256 hash of each random share token. Shared links expire after 30 days; each private photo URL lasts five minutes. Expiration disables the link but does not automatically delete the cloud row or photo. The citizen can delete shared data from the original browser while it still has the token.

## Local report record

```text
id: UUID; createdAt, updatedAt: ISO timestamps
status: pending | unknown (legacy) | submitted | fixed
photo: Blob; photoMimeType: string
latitude, longitude: number or null; locationCapturedAt: ISO timestamp or null
description: string
utilityId, recipientEmail: string or null
utilitySnapshot: name, serviceArea, email, directoryLabel, or null
linkedToReportId: UUID or null; lastCheckedAt: ISO timestamp or null
submittedAt, fixedAt: ISO timestamp or null; handoffMethod: string or null
resolutionNote: string or null; emailDraftOpenedAt: ISO timestamp or null
shareToken, shareUrl, shareExpiresAt: local bearer token, link, and expiry
```

IndexedDB keeps the citizen's local report and photo for offline use and follow-up. A copy is uploaded only when the citizen opens the email draft. The raw share token stays in that browser's report record; only its hash is stored in Supabase. A recipient's page is read-only.

## API contracts

- `GET /api/health`: minimal readiness; never expose secrets or report data.
- `GET /api/utilities`: labeled utility directory.
- `POST /api/reports/share`: validate report/photo, upload to private storage, upsert the row, return a private link and token to the originating browser.
- `GET /api/shared-report`: verify token and expiry, then return limited report details and a short-lived signed photo URL.
- `PATCH /api/reports/:id/status` and `DELETE /api/reports/:id`: require the bearer token and update or remove the report/photo.

## States and recovery

| Situation | Behavior |
|---|---|
| Camera unavailable/denied | Explain permission recovery or allow selecting a photo. |
| Location unavailable/denied | Preserve photo; explain why location is needed and allow retry; never invent coordinates. |
| Offline before email handoff | Save locally; the citizen can write or edit a description offline. |
| No nearby directory entry | Show nearest fallback, distance, and coverage caveat. |
| No email listed | Disable email action; do not invent an address. |
| No email handler or draft fails to open | Keep pending; allow copying report details and address into the citizen's email provider. |
| Photo attachment | Download the saved photo separately; the citizen attaches it to the email draft. |
| Back online | Reminder while open and on next launch; user triggers retry. |
| Supabase unavailable | Keep the report locally; let the citizen open email with the report text and map link and attach the downloaded photo. |
| Shared report link | Only a valid, unexpired token can read the report; photo access uses a five-minute signed URL. Recipients cannot edit. |
| Delete a shared report | Verify the local token, then delete the private photo and row; keep the local report if deletion fails. |
| Mark fixed | Confirm, timestamp, archive; otherwise leave open. |

## Privacy and scope boundaries

Explain why location is requested; show destination and report contents before email; require the citizen to start the email draft and send it themselves. Restrict photo types/size, safely render user text, and keep the server key out of frontend code. Public launch needs stronger abuse controls, automated deletion of expired cloud data, monitoring, and privacy/legal review. Anonymous users can request links; the server's in-memory rate limit is only a POC safeguard.

Deferred: worldwide verified directory; AI features; jurisdiction validation; call-answer detection; direct social posting; closed-app push; accounts and cross-device report inbox; utility dashboard; external repair verification; maps/geocoding; store publication; production abuse controls and automated retention cleanup. A user-triggered tel: link cannot confirm an answer. Social handles may be shown; posting needs separate APIs/permission.

## Build order

1. Responsive shell, manifest and sample directory.
2. IndexedDB persistence and static-shell caching.
3. Photo capture/selection and GPS permission/recovery.
4. Deterministic utility selection and distance display.
5. Manual description editing and report review.
6. Supabase-backed private report/photo link in the citizen's email draft, with downloaded-photo fallback and citizen-confirmed sent status.
7. Pending reminder/retry, fixed/open status and archive.
8. Complete local walkthrough, then HTTPS phone preview: install, camera, location, offline save, reminder, review, email acceptance.

## Decisions and open issues

Resolved: vanilla JavaScript; Node 24 LTS/Express 5; manually written descriptions with no AI model or AI API calls; coordinate-based matching; IndexedDB/offline shell; private Supabase row/photo only when opening the email draft; hashed 30-day bearer link; no push; `mailto:` in the citizen's email app; local first then temporary HTTPS preview; no accounts or paid provider API in POC.

Confirmed during build: Crown Gardens, Johannesburg, for the labeled demo directory. The directory uses Johannesburg Water's published water-fault email and contact-center number; the map point is an approximate suburb reference, not a depot coordinate or verified service boundary. Still confirm during build: public app URL; Supabase URL, server-only key, bucket name and table grant; phone/browser email-handler support; cloud upload and private-link walkthrough.

## References

- [MDN camera/secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN secure-context features](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Express 5 migration](https://expressjs.com/en/guide/migrating-5/)

## Review checklist

- [ ] Matches approved PRD and learner's HTML/CSS/JavaScript/Express experience.
- [ ] Offline persistence, retry, privacy, and email outcomes are clear.
- [ ] Citizen-marked email handoff is not mistaken for utility delivery or repair.
- [ ] Utility fallback is transparent and never invents contacts.
- [ ] HTTPS phone-preview requirement is clear.
- [ ] User approves before 5-build.
