---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [ ] **1. Create and keep a water report on this phone**
  Becomes usable: A running, phone-sized app lets a citizen start without an account, explain why location is needed, take or select a photo, capture current coordinates, see a nearby entry from a clearly labeled sample utility directory with its distance, review/edit a report, and save it locally as pending.
  Why now: This puts the central report journey in a usable form early. The first slice includes project setup and the browser-to-local-storage path, so we can try the real flow before adding external services.
  PRD ref: `prd.md > The Core Journey` (steps 1-5), `Screens and Layout`, `Features and Behavior > Location and photo`, `Features and Behavior > AI analysis and utility selection`
  Spec ref: `spec.md > Technical decisions`, `Where it runs`, `Data flow` (steps 1-4), `Components and files`, `Local report record`, `States and recovery`, `Privacy and scope boundaries`
  Build: Scaffold the vanilla HTML/CSS/JavaScript and Express project; create the responsive civic-style home and report/review screens; add a small visibly labeled demo utility directory for a community chosen with the learner; implement location/photo permission and recovery; match the nearest listed utility and show distance; save and reopen report/photo drafts in IndexedDB. Use manual description text until AI is added in slice 2.
  Verify (mechanical): Run the app and its health route; create a report with photo and location, reload the page, and confirm the pending report and image remain available; exercise denied-location and no-utility-contact states and confirm the app never fabricates coordinates or a recipient.
  Learner check: On the running app, start a report, check its photo, location, suggested utility and distance, save it, reload, and tell me what was clear or confusing.
  Commit: `Build local water report flow`

- [ ] **2. Review an AI draft and send the report by email**
  Becomes usable: A citizen can request an AI-written description, edit it, inspect the photo/location/destination together, then explicitly send and see whether the provider accepted the email or the result is failed/unknown.
  Why now: Once a locally saved report works, this adds the external handoff while preserving a citizen review and clear outcome states.
  PRD ref: `prd.md > The Core Journey` (steps 4-6), `Features and Behavior > AI analysis and utility selection`, `Features and Behavior > Review and email handoff`, `States and Boundaries`
  Spec ref: `spec.md > Technical decisions`, `Data flow` (steps 3-6), `API contracts`, `Components and files`, `States and recovery`, `Privacy and scope boundaries`
  Build: Add Express analysis and email routes, OpenAI and Resend services, server-side environment configuration and safe validation/errors; let the citizen generate/retry/edit an AI description; build the review/send confirmation flow and preserve pending reports on clear or uncertain failures. Use labeled test contacts and a verified sender/test recipient.
  Verify (mechanical): Run the server and health route; with configured credentials, submit a sample image to analysis and confirm editable text returns, then send a reviewed report to the configured test recipient and confirm the UI distinguishes provider acceptance from utility receipt. Confirm missing configuration produces a safe error and leaves the report saved.
  Learner check: Review an AI description, change it, inspect the destination, and send only to the agreed test recipient; tell me whether the result states were understandable.
  Commit: `Add reviewed AI and email handoff`

- [ ] **3. Continue pending reports and close the follow-up loop**
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

- [ ] Early usable behavior explored — after slice 1, try the locally saved report flow and review the Crown Gardens sample utility match before external-service work.
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

- The learner's Firefox location request did not respond; use faster-accuracy coordinates, a 30-second browser timeout, and a 32-second watchdog with Firefox/Windows recovery guidance. The learner still needs to reload and retry in Firefox.
- The available system runtime is Node 20.18.0 although the approved spec targets Node 24; Express installed and the server started under Node 20, but final verification should also run under Node 24.
