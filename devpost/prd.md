---
doc: prd
status: approved
---

# CitizenWater - Product Requirements

CitizenWater is a phone-first Progressive Web App that helps community members report treated-water problems and follow whether they are fixed.
Source: `scope.md > The Unique Kernel`, `Who It's For`, and `The Core Loop`.

## The Core Journey

1. **Open CitizenWater.** The home screen is available without creating an account. It offers **Start a report**, shows active reports and their statuses, and provides access to archived fixed reports.
2. **Start a report.** CitizenWater explains that location is needed to identify a utility. The citizen enables location access before continuing.
3. **Capture the problem.** The citizen takes a photo of the water problem. CitizenWater captures the phone's current coordinates with the report.
4. **Analyze and route.** AI analyzes the photo and creates a short description. Using the coordinates, CitizenWater identifies the nearest available utility contact. If no utility in the immediate area is listed, it selects the closest available one, even if far away, and shows its name and distance.
5. **Review the report.** The citizen sees the photo, location, AI description, selected utility, and email contact. They can edit the description or retake the photo, then choose whether to send.
6. **Hand off or wait.** When online, the citizen sends the report by email. CitizenWater confirms the handoff and marks it **Awaiting follow-up**; it does not imply the utility has read or resolved it. If the citizen is offline, the report remains **Pending** on that phone. When connection returns, CitizenWater reminds them; they review and send the report themselves.
7. **Follow up.** Later, the citizen opens the report after checking the location and marks it **Still open** or **Fixed**. If it is still open, they can wait or send a follow-up report. A fixed report is highlighted as fixed and moved to **Archived**.

Source: `scope.md > The Core Loop`, `What "Working" Looks Like`, and `The POC Boundary`.

## Screens and Layout

- **Home:** A clear **Start a report** action, active reports with status labels, and access to archived reports. No sign-in gate.
- **Location and photo:** A brief explanation of why location is needed, followed by the location permission step and photo capture. Keep the capture action prominent.
- **Review report:** Photo preview, editable AI description, readable location, selected utility and its distance, and the email destination. The citizen can retake the photo, edit the description, or send.
- **Report detail:** The submitted report and its current status, with an action to update it after checking the location. Fixed reports appear in the archive.

## Look and Feel

Use a clear, dependable civic style: calm blues, a light background, strong contrast, readable text, and large controls that are easy to use outdoors. Avoid flashy AI-demo styling.
Decision confirmed by the learner during the product interview.

## Features and Behavior

### Home and saved reports
Source: `scope.md > The Core Loop`.

- A citizen can begin reporting without registering or signing in.
- The home screen shows **Start a report**, active reports, and access to archived fixed reports.
- Reports remain available on the same phone for follow-up. Accounts and cross-device access are outside this proof of concept.

Acceptance criteria:

- [ ] The home screen can be opened without an account.
- [ ] The citizen can start a new report from the home screen.
- [ ] Saved reports show their current status; fixed reports can be found in the archive.

### Location and photo
Source: `scope.md > The Core Loop` and `The POC Boundary`.

- Location access is required before report capture because the coordinates are used to select a utility.
- Explain the location need before requesting access. Capture current coordinates with the photo.
- If location is disabled or permission is denied, explain that utility matching needs location and offer a way to enable access and retry.
- Capture one phone photo of the reported treated-water problem.

Acceptance criteria:

- [ ] The citizen is told why location is needed before the app requests it.
- [ ] A report proceeds to utility matching only after current coordinates are available.
- [ ] The citizen can take a photo and see that photo in the report flow.
- [ ] If location access is unavailable, the app explains the issue and offers a retry path.

### AI analysis and utility selection
Source: `scope.md > The Core Loop` and `The POC Boundary`.

- AI analyzes the photo and proposes a concise description for the citizen to review.
- CitizenWater uses the captured coordinates to find the nearest available utility in the selected demo area's utility data.
- If there is no nearby listed utility, select the closest available utility even if it is far away. Show the utility name and distance so the citizen can review the match.
- If the available data contains no utility contact at all, do not invent a recipient; explain that no contact is available and keep the report unsent.
- Make uncertainty in the AI description visible; the citizen can correct the text.

Acceptance criteria:

- [ ] The review screen shows a short AI-generated problem description.
- [ ] The utility match is based on the report's coordinates and available utility locations.
- [ ] When the selected utility is far away, its name and distance are shown before sending.
- [ ] The citizen can correct an AI description before sending.
- [ ] No recipient is fabricated when utility contact data is unavailable.

### Review and email handoff
Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

- Before sending, show the photo, description, location, selected utility, and email destination together.
- The citizen can edit the description or retake the photo before sending.
- Email is the one contact path in the proof of concept. Calls and social media are deferred.
- After the handoff, show the report as **Awaiting follow-up**. Do not claim the utility received, read, or acted on it.

Acceptance criteria:

- [ ] The citizen can inspect the report and destination before sending.
- [ ] The citizen's action sends the report by the selected email path.
- [ ] After handoff, the report appears as **Awaiting follow-up** on the home screen and report detail.
- [ ] The confirmation distinguishes a sent report from a utility response.

### Offline reports
Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

- If the citizen loses internet before the email handoff, keep the photo and available report information as **Pending** on that phone.
- Do not send automatically when connection returns. Remind the citizen that the report is ready, then let them review and send it.
- If analysis or utility matching could not finish offline, resume those steps after connection returns, then show the review screen.

Acceptance criteria:

- [ ] A report started without internet remains visible as **Pending** after the app is closed and reopened on that phone.
- [ ] On reconnection, CitizenWater tells the citizen the pending report is ready to continue.
- [ ] The citizen reviews and explicitly sends the report; reconnecting alone does not send it.

### Follow-up and archive
Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `What "Working" Looks Like`.

- A submitted report can be reopened later from the home screen.
- After checking the location, the citizen can mark the issue **Still open** or **Fixed**.
- For a still-open issue, the citizen can leave it open and wait, or create a follow-up report.
- A fixed report is clearly marked and moved to **Archived**.
- CitizenWater records the citizen's status update; it does not verify the repair or receive a utility response.

Acceptance criteria:

- [ ] The citizen can reopen a submitted report and view its photo, description, utility, and status.
- [ ] The citizen can mark the issue **Still open** or **Fixed**.
- [ ] A still-open report can remain open or lead to a follow-up report.
- [ ] A fixed report is visibly marked and appears in the archive.

## States and Boundaries

- **First use:** Home is usable without sign-in and explains the report action.
- **Location off or denied:** Explain that current location is needed to find a utility; allow retry after the citizen enables it.
- **No nearby utility:** Use the closest available utility from the demo data, show its distance, and let the citizen review it.
- **No utility contact data:** Keep the report unsent and explain that no contact is available; never invent a recipient.
- **AI uncertainty or failure:** Show the proposed text as a draft, identify uncertainty where possible, and let the citizen edit or retry. Never send without citizen review.
- **Offline before handoff:** Keep the report pending on the same phone and prompt the citizen when it is ready to continue.
- **Handoff complete:** Show **Awaiting follow-up**, not a claim that the utility received or resolved the problem.
- **Fixed:** Mark the report fixed and move it to the archive.
- **Persistence:** Reports are available on the same phone for later follow-up. Cross-device sync is not included.

## Product Decisions

- No mandatory login or registration for the proof of concept; a citizen can start reporting immediately.
- Request location when a report begins, explain why it is needed, and get location before photo capture.
- AI drafts the report; the citizen reviews and can edit it before sending.
- Email is the single contact method for the proof of concept.
- If the nearest local utility is unavailable, use the closest available utility and show its distance for review.
- Offline reports stay pending and require the citizen to review and send after connection returns.
- Citizens mark issues **Still open** or **Fixed** after checking the location; fixed reports are archived.
- The learner wants an installable PWA to support people with internet problems. App-store and AppGallery distribution are not part of this proof of concept.

## What We're Building

One phone-first PWA flow: start without an account, enable location, photograph a treated-water issue, receive an AI description and closest available utility match, review and send by email, keep an unsent report pending through an offline period, and let the citizen update its status later.

## Deferred From the POC

- Worldwide utility and contact coverage; the demo uses a selected area and a limited set of utility contacts.
- Calls and social-media posting; email is the first contact path.
- Accounts, identity profiles, and access to reports across devices.
- Utility-side accounts, acknowledgements, repair updates, and proof that a report was received or fixed.
- Publishing native app listings in the Apple App Store or Huawei AppGallery; the POC focuses on the PWA experience.

## Possible Later Enhancements

- Expand utility and contact coverage area by area.
- Add call and social-media handoff options.
- Add accounts and cross-device report history if citizens need them.
- Let utilities acknowledge and update reports.

## Non-Goals

- Proving that an email was read or that a utility fixed the issue; the citizen records their own follow-up.
- Guaranteeing a correct utility match for every location worldwide.
- Automatically sending a report without the citizen's review.
- Publishing to app stores during the proof of concept.

## Open Questions

- Which demo community and sample utility contacts will be used? **Resolved during build:** Crown Gardens, Johannesburg, with a labeled approximate routing point and Johannesburg Water's published water-fault contact. The point does not establish jurisdiction.
- How the email handoff is completed and confirmed in the PWA. **Must be settled during `4-spec` before build**, while keeping the citizen in control and avoiding a false claim of utility receipt.
- How the PWA reminds the citizen if the app is closed when connectivity returns. **Can be assessed during `4-spec`**; the product requirement is to make the pending report visible and prompt the citizen to review and send it when online.
