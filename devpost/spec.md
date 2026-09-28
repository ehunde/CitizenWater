---
title: CitizenWater Technical Specification
status: approved
review_format: html
---

# CitizenWater Technical Specification

## Purpose and POC boundary

Build one full report journey for a sample service area: photograph a water problem, capture device coordinates, create an editable AI description, find the nearest listed utility, review and email the report, retain it offline when needed, retry after reconnection, and later mark it fixed or leave it open.

Worldwide use is the product goal, but a verified global utility directory is outside this POC. Use a small labeled directory. If no nearby match exists, show the nearest available entry, its distance, and that it is a fallback. Never invent a utility or contact.

## Technical decisions

| Area | Choice | Reason |
|---|---|---|
| Frontend | Semantic HTML, CSS, browser JavaScript | Matches learner skills; no framework or build step. |
| Backend | Node.js 24 LTS, Express 5 | Uses existing Node/Express knowledge. |
| PWA | Responsive UI, manifest, service worker | Installable shell and cached static resources. |
| Offline reports | IndexedDB on device | Stores report data and photo blobs for retry. |
| Image AI | OpenAI Responses API, image input, GPT-6 Luna via Express | Drafts short description; citizen reviews/edits. |
| Utility lookup | Deterministic distance calculation against sample coordinates | Explainable recipient choice; AI does not guess contacts. |
| Email | Resend Node SDK via Express | Sends reviewed report/photo; keys remain server-side. |
| Demo hosting | Local development, then temporary HTTPS preview | Real phone camera/location/install need a secure context. |
| Accounts/database | None in POC | Keeps first journey small; reports stay on-device. |

Keep OPENAI_API_KEY, OPENAI_MODEL, RESEND_API_KEY, EMAIL_FROM, and PORT only in server environment configuration. Never expose or commit secrets. AI may make mistakes and only drafts visible-issue language; the user reviews it. API use may cost money and image costs vary. Verify access/pricing during setup. See [OpenAI quickstart](https://developers.openai.com/api/docs/quickstart), [image guide](https://developers.openai.com/api/docs/guides/images-vision), [pricing](https://developers.openai.com/api/docs/pricing), [Resend Node.js](https://resend.com/nodejs), and [Resend pricing](https://resend.com/pricing).

## Where it runs

Develop with Express on the computer using localhost. A phone cannot access that localhost, so create a temporary HTTPS preview for phone testing. Request camera/location permission during reporting, explain why coordinates are needed, and provide recovery states for denied/unavailable permission. Install from supported mobile browsers; App Store, Google Play and AppGallery publishing/native packaging are outside this POC. Configure a verified sender and test recipient. Mark sample contacts as test data unless confirmed.

## Data flow

1. User takes/selects a photo. Save photo and draft immediately in IndexedDB.
2. Request current coordinates; save latitude, longitude and capture time. Never claim a nearest utility was found without location.
3. When online, send image to POST /api/analyze. Express calls OpenAI and returns an issue category and editable short description. If offline or AI fails, preserve draft; allow manual text or retry.
4. Compare coordinates with sample utilities, order by geographic distance, and show the nearest entry, distance and contact options. If no nearby match exists, show the nearest available fallback and disclose that sample coverage does not prove jurisdiction.
5. User reviews/edits the report, checks destination email/photo, then explicitly chooses Send.
6. Post reviewed data to POST /api/reports/email. Express validates and calls Resend. On provider acceptance return submitted and provider message ID. This does not mean the utility received, read, or fixed the report.
7. Offline reports remain pending. When online while app is open, show reminder/retry; if closed, show it next launch. No closed-app push.
8. User can mark report fixed and archive it, or leave it open. This is citizen feedback, not independent verification.

## API contracts

- POST /api/analyze: request { imageDataUrl, latitude, longitude }; validate MIME/size; success { category, description, confidenceNote }. Failure leaves local draft intact. This route does not choose utility or send email.
- POST /api/reports/email: request { reportId, category, description, latitude, longitude, capturedAt, utilityId, recipientEmail, imageDataUrl }; validate fields/size; success { status: "submitted", providerMessageId }. On clear failure retain pending report. If timeout makes outcome uncertain, say "status unknown" and suggest checking before retry to reduce duplicates.
- GET /api/health: minimal readiness only; never expose secrets/account data.

## Components and files

```text
public/
  index.html, styles.css, manifest.webmanifest, service-worker.js
  js/app.js                 screens and actions
  js/location.js            permission, coordinates, recovery
  js/storage.js             IndexedDB report/photo persistence
  js/api.js                 server requests and errors
  js/utility-matcher.js      distance and candidate ordering
  js/sync.js                online/next-launch reminder and retry
src/
  data/utilities.json       labeled sample utilities
  routes/analyze.js         validation and AI route
  routes/email.js           validation and email route
  services/openai.js        OpenAI request/response parsing
  services/email.js         Resend integration/error mapping
server.js                   Express, static files, request-size limit
package.json, .env.example, .gitignore
devpost/scope.md, prd.md, spec.md, spec.html
```

The service worker caches public app-shell/static assets only, never private reports or API responses. Utility records use stable IDs, approximate coordinates, and clearly labeled demo contacts.

## Local report record

```text
id: UUID; createdAt, updatedAt: ISO timestamps
status: approved | pending | ready | submitted | fixed
photo: Blob; photoMimeType: string
latitude, longitude: number or null; locationCapturedAt: ISO timestamp or null
category: string or null; description: string
utilityId, recipientEmail, providerMessageId: string or null
submittedAt, fixedAt: ISO timestamp or null; resolutionNote: string or null
```

IndexedDB is local-only, with no cross-device backup. Provide a delete action and explain this limit. Upload coordinates/photo only when the user requests analysis or confirms sending.

## States and recovery

| Situation | Behavior |
|---|---|
| Camera unavailable/denied | Explain permission recovery or allow selecting a photo. |
| Location unavailable/denied | Preserve photo; explain why location is needed and allow retry; never invent coordinates. |
| Offline before AI | Save locally; allow manual description or retry when online. |
| AI unavailable/bad output | Preserve draft, show safe error, allow editing/retry; never auto-send. |
| No nearby directory entry | Show nearest fallback, distance, and coverage caveat. |
| No email listed | Disable email action; do not invent an address. |
| Email failure | Keep pending and offer retry; ambiguous timeout is "status unknown." |
| Back online | Reminder while open and on next launch; user triggers retry. |
| Mark fixed | Confirm, timestamp, archive; otherwise leave open. |

## Privacy and scope boundaries

Explain why location is requested; show destination and report contents before email; require explicit confirmation. Restrict upload types/size, safely render user text, keep secrets server-side, and show safe errors. Public launch needs abuse controls, retention policy, server persistence, monitoring, and privacy/legal review.

Deferred: worldwide verified directory; AI utility discovery; jurisdiction validation; call-answer detection; direct social posting; closed-app push; accounts; remote database/sync; utility dashboard; external repair verification; maps/geocoding; store publication; production operations. A user-triggered tel: link cannot confirm an answer. Social handles may be shown; posting needs separate APIs/permission.

## Build order

1. Responsive shell, manifest and sample directory.
2. IndexedDB persistence and static-shell caching.
3. Photo capture/selection and GPS permission/recovery.
4. Deterministic utility selection and distance display.
5. Express endpoints and editable AI analysis.
6. Review and email send with accepted/failed/unknown states.
7. Pending reminder/retry, fixed/open status and archive.
8. Complete local walkthrough, then HTTPS phone preview: install, camera, location, offline save, reminder, review, email acceptance.

## Decisions and open issues

Resolved: vanilla JavaScript; Node 24 LTS/Express 5; OpenAI Responses API/GPT-6 Luna; coordinate-based matching; IndexedDB/offline shell; no push; Resend; local first then temporary HTTPS preview; no accounts/server DB in POC.

Confirmed during build: Crown Gardens, Johannesburg, for the labeled demo directory. The directory uses Johannesburg Water's published water-fault email and contact-center number; the map point is an approximate suburb reference, not a depot coordinate or verified service boundary. Still confirm during build: Resend sender/test recipient; OpenAI account/model access/current cost; preview host; phone/browser; photo size limits.

## References

- [OpenAI JavaScript quickstart](https://developers.openai.com/api/docs/quickstart)
- [OpenAI image and vision guide](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI models](https://developers.openai.com/api/docs/models)
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [Resend Node.js](https://resend.com/nodejs) and [pricing](https://resend.com/pricing)
- [MDN camera/secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN secure-context features](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Express 5 migration](https://expressjs.com/en/guide/migrating-5/)

## Review checklist

- [ ] Matches approved PRD and learner's HTML/CSS/JavaScript/Express experience.
- [ ] Offline persistence, retry, privacy, and email outcomes are clear.
- [ ] Provider acceptance is not mistaken for utility delivery or repair.
- [ ] Utility fallback is transparent and never invents contacts.
- [ ] HTTPS phone-preview requirement is clear.
- [ ] User approves before 5-build.
