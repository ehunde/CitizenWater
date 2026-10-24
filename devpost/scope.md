---
doc: scope
status: approved
---

# CitizenWater

CitizenWater helps a citizen report a water problem and follow it until it is fixed.

## The Unique Kernel
It closes the loop: a citizen can report wasted water to a utility, then update the report to say whether the problem is still open or has been fixed.

## Who It's For
Any responsible citizen with a camera phone who notices a treated-water problem anywhere in their community - at a home, business, school, CBD, or other place - and wants to alert the responsible utility. What they do today instead has not been established.

## The Core Loop
The citizen turns on location access, photographs a water problem, and shares the phone's current location coordinates. They write a short description of what they observed; those coordinates identify the nearest listed utility for review. When the citizen opens the email draft, the server saves the report and photo in Supabase and gives the email a private report link that expires after 30 days. The citizen reviews and sends the email themselves. If the app is offline or cloud sharing is unavailable, the report remains pending on the phone and the citizen can retry sharing later. They can return to the report after checking the location and mark it fixed or still open.

## Inspiration & Identity
No design or product inspiration has been shared yet.

## Why This Matters to the Learner
They want CitizenWater to help people save water and contribute to UN Sustainable Development Goal outcomes related to water. They also want to learn the plan-first workflow and get the app working.

## What "Working" Looks Like
A short demo follows one treated-water problem in a community from a phone with location access enabled, through photo capture, current coordinates, a citizen-written description, and identification of the nearest listed utility in that area, to a prefilled email draft with a private, expiring report link that the citizen reviews and sends. The link opens the stored report and photo. The citizen can later update the report as fixed or still open. It also shows a report waiting while offline and a reminder when connection returns. The proof is that the citizen can report and follow up, not that every utility worldwide is connected.

## The POC Boundary
One end-to-end example report for a citizen noticing a treated-water problem somewhere in their community: enable phone location access, capture a photo and current location coordinates, write a description, identify the nearest listed utility in that area, review the report, open a prefilled email draft addressed to the listed utility with a private, expiring report link, and send it in the citizen's own email app. The report stays on the phone while offline; if cloud sharing is unavailable, the citizen can retry later. The citizen can update its status after checking the location. CitizenWater does not verify that the email was sent or delivered.

## Later
- Worldwide coverage of utility locations and contact details.
- Multiple ways to contact utilities, including calls, email, and social media.
- Broader community participation and follow-up beyond the one demonstrated report.

## Explicitly Cut
- Proving that a utility received, accepted, or fixed the report. CitizenWater can show the citizen's handoff and their own follow-up, but the first proof does not establish a utility-side response.
