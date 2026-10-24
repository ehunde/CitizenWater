---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. Create and keep a water report on this phone**
  Becomes usable: A running, phone-sized app lets a citizen start without an account, explain why location is needed, take or select a photo, capture current coordinates, see a nearby entry from a clearly labeled sample utility directory with its distance, review/edit a report, and save it locally as pending.
  Why now: This puts the central report journey in a usable form early. The first slice includes project setup and the browser-to-local-storage path, so we can try the real flow before adding external services.
  PRD ref: `prd.md > The Core Journey` (steps 1-5), `Screens and Layout`, `Features and Behavior > Location and photo`, `Features and Behavior > Description and utility selection`
  Spec ref: `spec.md > Technical decisions`, `Where it runs`, `Data flow` (steps 1-4), `Components and files`, `Local report record`, `States and recovery`, `Privacy and scope boundaries`
  Build: Scaffold the vanilla HTML/CSS/JavaScript and Express project; create the responsive civic-style home and report/review screens; add a small visibly labeled demo utility directory for a community chosen with the learner; implement location/photo permission and recovery; match the nearest listed utility and show distance; let the citizen write a short description; save and reopen the report/photo in IndexedDB.
  Verify (mechanical): Run the app and its health route; create a report with photo and location, reload the page, and confirm the pending report and image remain available; exercise denied-location and no-utility-contact states and confirm the app never fabricates coordinates or a recipient.
  Learner check: On the running app, start a report, check its photo, location, suggested utility and distance, save it, reload, and tell me what was clear or confusing.
  Commit: `Build local water report flow`

- [x] **2. Send a report from the citizen's email app**
  Becomes usable: A citizen writes and edits a description, inspects the photo/location/destination together, then opens a draft addressed to the listed utility with report details, a map link, and a private link to the cloud-hosted report and photo. If cloud sharing is unavailable, the report stays on the device and the draft has no photo link.
  Why now: The citizen asked to share a particular report link with the utility. Supabase is now the hosted copy for that handoff, while IndexedDB remains the offline copy and email stays user-controlled.
  PRD ref: `prd.md > The Core Journey` (steps 4-6), `Features and Behavior > Description and utility selection`, `Features and Behavior > Review and email handoff`, `States and Boundaries`
  Spec ref: `spec.md > Technical decisions`, `Data flow` (steps 3-5), `API contracts`, `Components and files`, `States and recovery`, `Privacy and scope boundaries`
  Build: Keep reports/photos in IndexedDB for offline use. On email handoff, upload through Express to the private Supabase bucket, save the report row using the server-only service key, create a 30-day random-token link (store only its hash in the database), and send that link in the citizen's `mailto:` draft. Verify tokens before displaying a read-only shared report with a five-minute signed photo URL. Sync status changes and deletion using the local token. Never expose the server key in frontend code.
  Verify (mechanical): Run the app and health route; inspect the SQL grant, server-only environment loading, generated email link, private bucket upload, expiring-token lookup, signed photo URL, and token-protected status/delete endpoints. Confirm no AI/email-provider dependency or API credential remains in frontend code; opening a draft alone must not mark a report sent.
  Learner check: After adding Supabase URL/key/bucket to local `.env` and running the supplied service-role grant SQL, create a report, open the email draft, then open the private link in a separate browser and check its report and photo. Confirm the link expires as shown; cancel the email without sending and check the report stays pending.
  Commit: `Open reviewed reports in citizen email app`

- [x] **3. Continue pending reports and close the follow-up loop**
  Becomes usable: A report saved offline remains on the phone, is surfaced when the app is open again online, and requires the citizen to review and send; submitted reports can be marked still open or fixed and fixed reports appear in the archive.
  Why now: This completes the unique kernel after report creation and honest handoff are working: the citizen can return and record what they observed.
  PRD ref: `prd.md > The Core Journey` (steps 6-7), `Features and Behavior > Offline reports`, `Features and Behavior > Follow-up and archive`, `States and Boundaries`
  Spec ref: `spec.md > Data flow` (steps 7-8), `Local report record`, `States and recovery`, `Components and files`
  Build: Add online/next-launch reminders and a user-triggered resume/retry path; retain status changes locally; add report detail, still-open/fixed actions and the fixed archive; clearly describe status as citizen feedback rather than verified repair.
  Verify (mechanical): Save a report while offline, close/reopen the app, reconnect, and confirm it is surfaced but not sent automatically; complete a test handoff, mark the report still open and then fixed, reload, and confirm the fixed item appears in the archive.
  Learner check: Try the pending-report return path, then update a report to still open and fixed; tell me whether it is clear what CitizenWater knows and what it does not.
  Commit: `Complete offline follow-up and archive`

- [ ] **4. Install the app shell and finish the phone walkthrough**
  Becomes usable: The static app shell can be installed on a supported phone browser and the completed report journey is tried over a temporary HTTPS preview, including camera/location permissions and offline behavior.
  Why now: Secure phone access is required for camera/location and install checks; do this after the complete journey can be exercised so the preview tests a real product.
  PRD ref: `prd.md > The Core Journey`, `Screens and Layout`, `Product Decisions`
  Spec ref: `spec.md > Where it runs`, `Components and files`, `States and recovery`, `Privacy and scope boundaries`
  Build: Add the manifest and service worker to cache only public app-shell assets, finish responsive adjustments from learner feedback, configure a temporary HTTPS preview, and walk through the core journey on the learner's phone/browser. Keep reports and API responses out of the service-worker cache.
  Verify (mechanical): Run the local walkthrough and inspect the service-worker cache contents; confirm an HTTPS phone preview loads, offers installation where supported, grants camera/location only after user action, and retains a pending report through a reload while offline.
  Learner check: On your phone, install or open the preview, try the report flow and offline return, and note anything broken or confusing for the final review.
  Commit: `Add installable PWA shell and phone preview`

## Hands-on Checkpoints

- [x] Early usable behavior explored — the learner reloaded the app in Firefox and confirmed it was working before external-service work.
- [ ] Final kick-the-tires exploration and feedback completed — after slice 4, try the completed journey on the HTTPS phone preview.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Three earlier pending reports did not appear in the Codex in-app browser. Reports use browser-local IndexedDB, so check them in the original Firefox profile; the app now labels this storage as browser-local. On 2026-10-15 the learner confirmed the app was working in Firefox, completing the slice 1 hands-on check.
- Product decision on 2026-10-15: remove AI drafting because the ongoing model cost is unaffordable. Citizens write their own descriptions; the app no longer calls or depends on an AI model.
- Product decision on 2026-10-15: use the citizen's own email app instead of a paid email provider API. At that point, the email draft included a downloaded-photo fallback; the 2026-10-24 decision below removed that fallback control.
- Product decision on 2026-10-16: add Supabase cloud storage for reports/photos when a citizen opens an email draft, with a private read-only expiring link. Keep IndexedDB for offline and local follow-up. The app's Express server uses a server-only key; no anonymous table or bucket policies are added.
- Product decision on 2026-10-24: remove the **Copy report details**, **Download photo to attach**, and **Replace photo** controls as requested. If email draft creation or cloud sharing fails, the report stays local; CitizenWater does not offer a copy or attachment fallback. Label the action **Open email draft** so it does not imply the app sent the message. Scope and recovery copy now match this choice.
- Slice 2 learner check on 2026-10-24: the user confirmed the private report/photo link was working and then confirmed that closing the email draft without sending leaves the report **Pending**. Code review covered private-bucket upload, hashed expiring tokens, signed photo URLs, token-protected status/delete routes, server-only Supabase credentials, and no email-provider/AI dependency in the client. The user previously reported the local Supabase diagnostics showed the table reachable and bucket private. The current task shell could not reach its local loopback health endpoint; hosted Node 24 is configured in `render.yaml`.
- Slice 3 learner check on 2026-10-24: the user confirmed a pending report stayed saved after reload in Airplane mode; reconnecting showed it waiting for review without opening or sending email. The user also confirmed the sent-status and still-open/fixed follow-up flow worked.
- Offline startup now loads saved reports even when API configuration or the utility directory is unavailable. On reconnection, pending reports without a utility are matched to the sample directory for review; they are never sent automatically. The service worker caches only the explicit app-shell asset list, not API responses or reports.
- The learner's Firefox location request did not respond; use faster-accuracy coordinates, a 30-second browser timeout, and a 32-second watchdog with Firefox/Windows recovery guidance. The learner still needs to reload and retry in Firefox.
- The available system runtime is Node 20.18.0 although the approved spec targets Node 24; Express installed and the server started under Node 20, but final verification should also run under Node 24.
