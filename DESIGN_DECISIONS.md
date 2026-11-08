# NIYOM: design decisions

This document explains why NIYOM looks and works the way it does, in plain words. It describes the app as it is today. How it got here, step by step, is in [`NIYOM_EXECUTION_LOG.md`](NIYOM_EXECUTION_LOG.md).

## 1. What guides every decision

**One loop: follow → get alerted → review → check again → ready.**

- **Follow.** You follow every notice by default. You can unfollow one from its page.
- **Get alerted.** The bell lists each correction to a followed notice that you haven't looked at yet. Each alert says how many changes matter, how many cosmetic edits were ignored, and how many of your ticks are now out of date.
- **Review.** Opening the comparison marks the alert as read.
- **Check again.** An out-of-date paper shows the old and new wording side by side, with one button: *I have the updated document*. The paper moves back into place and readiness counts up.
- **Be on time.** Deadlines show the days left, and **Add to calendar** downloads a calendar file with a reminder three days before.

**Numbers are calculated, never typed in.** Every figure on screen comes from the engine in `src/domain/`, and tests check them. For a student who prepared every paper for the original notice:

| Notice | Original | After the latest correction |
| --- | --- | --- |
| Merit Grant 2026 | 100% (6 of 6) | Update 1: still 100% (only a helpdesk moved). Update 2: **57%** (4 of 7: two papers changed, and the income certificate became required) |
| Railway e-ticket refund | 100% (4 of 4) | Update 1: 80% (a new SMS code step; nothing prepared went out of date) |
| ICT SE Fellowship 2026 | 100% (4 of 4) | Update 1: 60% (the deadline moved, and a GitHub profile became required) |
| e-Passport checklist | 100% (3 of 3) | Update 1: 50% (the ID document wording changed, and an enrolment certificate became required) |

The test is `tests/domain/prepared.test.ts`; the function is `readinessIfPreparedForOriginal` in `src/domain/readiness/calculate.ts`.

**Plain names for versions.** "v1.0" and "v2.0" mean little to a student at a counter. The app says *Original*, *Update 1*, *Update 2*, in the order they were published. The official label (such as "Major Corrigendum") is still shown next to it, and the API keeps the official labels.

**Less on screen at once.** Each requirement shows a tick, its name, the rule and at most one status. Everything else (does it apply to you, history, sources, conflicts, field reports) opens in a side panel when you ask for it.

**Honest by default.** If a profile field is missing, NIYOM never assumes you are not eligible; it asks. Reports from counters are kept apart from official rules and stay *pending* until three different people confirm them. The sample data is labelled as sample data wherever it appears.

## 2. The look: a calm reading experience

The layout and motion take their cue from [Stripe Press](https://press.stripe.com), the way a well-made book site reads: one serif typeface, soft colour, generous space. NIYOM uses none of Stripe's fonts, logo or text.

| Idea | How NIYOM does it |
| --- | --- |
| One typeface, used well | **Newsreader** for everything, with **Noto Serif Bengali** for নিয়ম and the Bengali words. Requirement codes are set in small capitals. |
| A soft wash behind the first screen | A **monsoon-morning wash** (lilac, mist blue, paddy green, lotus pink). |
| Each topic has its own colour | **Each notice is a chapter** with its own colour: forest green (Merit Grant), night violet (railway), olive and navy (ICT), maroon (e-passport). Working pages take a light tint of that colour. |
| A side rail that shows where you are | **A rail of short lines on every page.** The lines swell around the part you are reading, and follow your pointer like a dock. The current section's name appears for a moment as you enter it. |
| Objects you want to touch | **Each notice as a physical object**: an official circular with a seal, an e-ticket with a tear-off stub, a code window, a passport. In the chapters they open like a bundle of papers. |
| A memorable mark | **An "N" drawn as three parallel lines**: the same rule written three times, once per version. |

Corners are soft but not bubbly: 10px on controls, 14px on cards, 20px on panels, 4–6px on paper.

## 3. The home page, top to bottom

**The opening scene.** The first thing a visitor sees should explain the whole product in a few seconds, without reading a table. So the hero is a short scene that plays by itself, in three steps that are listed beside it:

1. **You prepare every paper.** An official notice sits on the desk. NIYOM's card shows the student's folder: 100% ready, every paper matching.
2. **The notice is quietly corrected.** A *Corrigendum* stamp lands on the notice, and the changed rules are struck through and rewritten word by word. The folder still says 100%, which is exactly the problem.
3. **NIYOM shows what it broke.** NIYOM's card arrives like a phone notification: readiness drops to 57%, and it names the two papers to check again and the one that is now required.

The scene takes about four seconds, plays once when it comes into view, and then stays still. Visitors can click any step to see that moment, replay it, or play it on any of the four notices. **Try it on my checklist** then applies the same correction to the visitor's own checklist and scrolls to their next steps. The headline says the problem in seven words: *The notice changed. Your papers didn't.*

Earlier versions of the hero were replaced:
- a 3D stack of papers repeated the chapters further down, and broke the layout for the passport;
- a version switch with a list of clauses worked, but looked like a form or a table on first sight, which is the wrong first impression.

**The corrigendum, word by word.** A section a few screens long. As you scroll, each change in the Merit Grant is rewritten one word at a time, like an old film: a dark sepia screen, film edges that run with the scroll, grain and a slight flicker. The readiness figure falls 100 → 83 → 71 → 57 as each change lands. Screen readers get the same story as a plain list.

**Your next steps.** The papers that changed (what you prepared next to what the notice now says), the places where official sources disagree, and what isn't prepared yet. Beside them, a manila folder lists every required paper and where it stands.

**When to start.** One sentence, such as "Start by Sunday, 08 Nov 2026": the working days your remaining papers need, counted over the Sunday–Thursday week.

**Not every change is news.** The Merit Grant's three versions side by side: one only moved a helpdesk; the other changed what you must submit.

**Chapters.** Each notice in its own colour. Its object opens like a book when you reach it: the cover swings over, printed pages riffle after it, and it lands flat, with the version on one side and what it asks of you on the other.

**Footer.** At least one screen tall, so the floating top bar never sits over a strip of the section above. It holds the promise, every way back into the app, the next closing date, and the disclaimer.

## 4. Motion

Motion either answers something you did, or marks one planned moment. Nothing moves just to decorate.

| Moment | What happens |
| --- | --- |
| The opening scene | Stamp (460 ms), strike-through (420 ms), new words under a marker (600 ms), then the card drops in and its number counts down. About four seconds in all, then still. |
| Changing page | The old page fades and the new one rises (React `<ViewTransition>`). |
| Ticking or re-checking a paper | Papers glide to their new group while readiness counts up. |
| Books that open | The cover and pages turn once, when the book is well in view. |
| Papers, not dials | Readiness is shown as small paper sheets: solid when ready, amber when out of date, outlined when missing. |
| Top bar | Shrinks into a floating pill when you scroll. Its height never changes, so nothing below it jumps. |
| Drifting words | নিয়ম behind the hero and one large word on each page drift slowly with the scroll, using CSS only. |
| Reduced motion | If your device asks for less motion, every animation jumps straight to its end, and the scene opens on its last step. |

**Smooth scrolling.** Anything that moves with the scroll is updated once per frame, and only while it is on screen. Each moving part writes a finished `transform` onto one element. It does not change a CSS variable that hundreds of child elements would have to recalculate, and it does not restart a CSS transition on every frame. Measured in a production build, each opening book now restyles fewer than 10 elements per frame instead of about 200. A typical frame while scrolling the home page dropped from 33 ms to 16.7 ms, which is 60 frames per second. A page at rest does no work at all.

## 5. Phones, tablets and touch

- **No rail below 640px.** On a phone the rail would cost space for lines too small to tap. Phones get even 16px margins, and the top bar and menu handle navigation.
- **Nothing scrolls sideways** at 360px or wider.
- **Big enough to tap.** Small text buttons get an invisible 44px touch area.
- **Every panel fits and scrolls inside**: menu, search, alerts, details, report form, help, Live API.
- **The opening scene on a phone:** the notice fills the width, NIYOM's card overlaps its foot, and the steps and buttons follow below.

## 6. Notifications

Notifications look like the system banners on a phone: a frosted panel, an app icon, a bold title, "now", and a line or two of text. They use the system font, because a notification is the device talking, not the document. They drop in under the top bar, pause while you hover or hold them, and can be swiped away. The close button is always visible, because touch screens have no hover.

## 7. Forms

The report form uses custom dropdowns in the app's style instead of the browser's default: each option shows a colour or code and a second line, and they work with arrow keys, Home, End and Escape. Each kind of report is a card with an icon and one line explaining it. Text boxes show a character count.

## 8. Backend: who owns which data

- **What you prepared is private.** On your first visit the server gives your browser an anonymous ID in an `HttpOnly` cookie. Your profile, ticks and notes are saved under that ID. "Reset" clears only yours.
- **What students saw at the counter is public, and has to be earned.** A field report becomes a *confirmed pattern* only when three different devices confirm it. You can't confirm your own report or confirm one twice, and nobody is told who filed or confirmed a report.
- **Nothing is lost when the connection drops.** Changes wait in a queue and are sent when you're back online. The server merges them record by record, so an older change never overwrites a newer one.
- **Bad input is refused, not stored.** Every request is checked with Zod and against the data: unknown notices or versions get `422`, oversized requests `413`, and spam `429`.
- **A real database everywhere.** The live site uses Postgres (Neon). On your computer, the server starts a small embedded Postgres, using the same driver and SQL. Each save is one statement, and the database enforces the rules.
- **Outages are expected.** If the database is down, the API answers `503` with a retry time, and the app keeps working from the copy in your browser.

## 9. Removed, and why

- **Two earlier heroes** (a 3D paper stack, then a version switch with a clause list). See section 3.
- **A Three.js background with looping videos.** It added about 1 MB on phones and kept the processor busy even when nothing happened. Removing it cut the home page's JavaScript from 478 KB to 283 KB.
- **A "Check all required" button.** One tap claimed every document was ready, which made the readiness figure meaningless.
- **A readiness ring.** It looked like a generic dashboard widget. The paper sheets replaced it.
- **The generic startup look**: grey and emerald colours, a frosted navbar, a badge above the headline, a grid of three cards, and the Geist and Inter fonts.

## 10. Where it differs from the original brief

- **Fonts:** Newsreader and Noto Serif Bengali instead of Geist and Inter.
- **Colours:** the brief's forest green is kept as the Merit Grant's colour. Status colours pass WCAG AA contrast on every tint.
- **Navigation:** the side rail, a quiet top bar and a Walkthrough menu instead of numbered tabs and a dark bar.
- **Correction banner:** replaced by the alerts bell and a notification.
- **Figures:** the brief's example numbers didn't match the sample data, so the app shows what the engine calculates (section 1).

## 11. Known limits

- The notices, offices and lead times are hand-made sample data. A real product needs a way to turn notice PDFs into structured requirements, with a person reviewing them.
- There are no accounts. Your data is saved on the server for your browser, but it doesn't move to another device, and alerts appear only in the app (no SMS or email).
- Rate limits are counted by each server instance separately. A shared store such as Redis would make them exact.
- One person using several browsers counts as several devices when confirming a report. Blocking by IP address would also block students on a shared campus network, so the three-device rule and per-IP limits are the protection instead.
- Page transitions animate in Chrome, Safari and recent Firefox. In other browsers pages change instantly, with nothing lost.
