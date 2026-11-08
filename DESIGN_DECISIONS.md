# NIYOM: design decisions

This document explains why NIYOM looks and behaves the way it does. It describes the product as it stands. How it got there, phase by phase, is in [`NIYOM_EXECUTION_LOG.md`](NIYOM_EXECUTION_LOG.md).

## 1. Principles

**The loop the interface is built around: follow → alert → review → re-verify → ready.**

- **Follow.** Every dossier is followed by default. You can unfollow from a dossier's page.
- **Alert.** The bell lists each revision of a followed notice that you have not reviewed. Each alert says how many changes matter, how many cosmetic edits were ignored, and how many of your checks went stale. Alerts are derived from the data, never stored separately.
- **Review.** Opening the redline marks the alert as read.
- **Re-verify.** A stale item shows the old and new wording with one fix: *I have the updated document*. The item glides into *Required* and readiness counts up.
- **Be on time.** Deadlines show the days left. **Add to calendar** downloads an `.ics` file from `/api/calendar/:id` with a reminder three days before.

**Numbers are computed, never typed.** Every figure on screen comes from the domain engine, and the tests pin them. For an applicant who prepared every paper for the original notice:

| Dossier | Original | Later versions |
| --- | --- | --- |
| Merit Grant 2026 | 100% (6 of 6) | Update 1: 100% (a cosmetic edit). Update 2: **57%** (4 of 7: two prepared papers changed, the income certificate became required) |
| Railway e-ticket refund | 100% (4 of 4) | Update 1: 80% (a new SMS two-factor rule; nothing prepared went stale) |
| ICT SE Fellowship 2026 | 100% (4 of 4) | Update 1: 60% (the deadline moved, a GitHub portfolio was added) |
| e-Passport checklist | 100% (3 of 3) | Update 1: 50% (the identity document wording changed, an enrolment certificate was added) |

See `tests/domain/prepared.test.ts` and `readinessIfPreparedForOriginal` in `src/domain/readiness/calculate.ts`.

**Plain words for versions.** *v1.0* and *v2.0* mean little to a student at a counter. The interface says *Original*, *Update 1*, *Update 2*, in the order the notice was published (from the version number). Inside a sentence it reads *the original*. The official label, such as "Major Corrigendum", still appears beside the name, and the API keeps the raw labels.

**Less on screen at once.** Each requirement shows a check, its title, the rule and at most one status. Everything else opens in a slide-over inspector: applicability, history, sources, conflicts and field reports.

**Honest by default.** NIYOM never assumes you are ineligible when a profile field is missing; the item moves to *Needs your profile*. Field reports from counters are kept apart from official policy and marked pending until three devices confirm them. The dataset is labelled as illustrative wherever it appears.

## 2. Visual direction: the Stripe Press reading model, softened

The interface follows the structure and motion of [Stripe Press](https://press.stripe.com), studied in a real browser at desktop and phone width. It uses none of Stripe's fonts, logo or copy.

| The reference does | NIYOM does |
| --- | --- |
| One serif family everywhere, with italic sub-labels | **Newsreader** for everything; its optical sizes give tight display cuts and open text cuts. Requirement codes are set in small caps. Noto Serif Bengali sets নিয়ম and the engraved Bengali words. |
| A pastel wash behind the opening screen | A **monsoon-morning wash** (lilac, mist blue, paddy green, lotus pink) under the top bar and the rail. |
| Each book is a chapter with its own colour field | **Each dossier is a chapter**: forest (Merit Grant), night violet (railway), olive and navy (ICT), maroon (e-passport). Working pages take a light tint of that colour and fade between tints when you switch dossiers. |
| A fixed rail with one tick per section | **A rail that breathes with your scroll on every page.** Sections opt in with `data-rail`. Each is a line resting at 40% of its length; the lines swell around the place you are reading, and under the pointer the swell follows the pointer like a dock. The current section's name appears beside its line for a moment when you enter it, or beside any line you point at, in small type with parentheses dropped. The rail takes the ink of whatever lies beneath it. Lengths change with `transform: scaleX`, so the swell never causes layout. |
| A 3D book in perspective | **Each dossier as its own object, stacked by version**: an official circular with a seal, e-tickets with a perforated stub and barcode, a code window whose changed lines light up, a passport booklet. These appear in the Overview chapters and on each dossier's page, not in the hero (see section 3). |
| A stroke-drawn monogram | **An "N" engraved as three parallel strokes**: the same rule written three times, one per version. It draws itself on load beside the wordmark and নিয়ম. The favicon uses a solid N, because hairlines turn to mush at 16px. |

Geometry is soft but not rounded for its own sake: 10px on controls, 14px on cards, 20px on panels, 4–6px on paper.

## 3. The Overview, top to bottom

**The hero: the idea, played by the visitor.** A notice sits on the desk with its published versions as a switch: *Original · Update 1 · Update 2*. The visitor is shown an applicant who prepared every paper for the original. Switching to a later version:

- strikes each changed clause and writes the new wording in under a marker, an added rule slides in marked *New*, and a cosmetic edit is shown in quiet grey and labelled *Cosmetic*;
- stamps the sheet (*Corrigendum*, *Amended* or *Addendum*, in red only when something that matters changed);
- drops the readiness meter beside it by exactly what that version invalidates, with the papers themselves turning amber (stale) or outlined (new).

Four tabs switch the dossier. Pointing at a clause shows where the paper comes from: the issuing office and its lead time in working days, or that there is nothing to collect at a counter. **Try it on my checklist** then plays the same update on the visitor's own plan: the notification arrives, the bell rings, the nav's readiness changes and the page scrolls to *Your next steps*. On a 1366×650 laptop viewport the version switch, the meter and its button all sit above the fold, and the meter card never moves when an update makes the sheet longer.

Earlier heroes showed a 3D paper stack (it repeated the chapters below and, for a passport, broke the layout) and then a single animated scene beside a second status card (two cards competing, starting at 0%). Both were replaced by this one interaction, which states the thesis in a few seconds: you were 100% prepared, and a corrigendum quietly undid it.

**The corrigendum, word by word.** A pinned scene a few screens long. Scrolling rewrites each change that matters in the Merit Grant, one word at a time: a line drawn through each struck word, then each new word under a marker, and the date reading "15 → 25 Nov 2026". It plays like an old picture show: a dark sepia screen, film sprockets that run with the scroll, grain and a slight projector flicker (only while on screen), a vignette, and the readiness figure in a silent-film title card falling 100 → 83 → 71 → 57 as the engine applies each change in turn. Screen readers get the same story as a list.

**Your next steps.** The changed items with a redline of what you prepared against what the notice now says, the conflicts between official sources, and what is not prepared yet. Beside them, a sticky manila folder lists every required paper and where it stands.

**When to start.** One sentence ("Start by Sunday, 08 Nov 2026"): the working days your remaining papers need at their offices, counted over the Sunday–Thursday week.

**Not every change is news.** The Merit Grant's three versions side by side: one revision only moved a helpdesk room, the other changed what you must submit.

**Chapters.** Each dossier in its own colour field. Its object opens like a book once 40% of it is in view: the cover swings over, three printed pages riffle after it, and the spread lands flat with the version on the left and what that version asks of you on the right, ticked live from your checks.

**Footer.** At least one screen tall at the end of a page, so the floating top bar sits over the footer and never over a sliver of the band above it. It carries the promise, every way back in, the next closing date across all dossiers (with a calendar file), and the disclaimer. Links draw their underline in from the left.

## 4. Motion

Motion either answers something you did or marks one deliberate moment.

| Moment | Behaviour |
| --- | --- |
| Page change | React 19.3 `<ViewTransition>`: the old page fades, the new one rises. Navigation lands at the top at once (`data-scroll-behavior="smooth"` on `<html>`, needed since Next 16). |
| Hero version switch | Strike (150 ms), new wording (420 ms), stamp (600 ms); the meter tweens to its new figure. The newest version pulses softly until the visitor first switches. |
| Re-verify, check, profile change | Inside the View Transition API: items glide to their new group while readiness counts up. |
| Books that open | See section 3. The other versions in the stack fade as the book opens; the spread has page edges, a shaded gutter and a shadow on the band. |
| Papers, not dials | Readiness is shown as the papers themselves: one sheet per required item, solid when checked, amber when stale, outlined when missing. |
| Top bar | Tucks into a floating pill once you scroll. Its height never changes, so nothing below it moves. |
| Type that drifts | নিয়ম behind the hero, each chapter's version name behind its band, and one engraved word on every other page (তালিকা on the Directory, the version on a specification, সংশোধনী on Changes, প্রস্তুতি on My plan). Native scroll-driven animations: no JavaScript, still where unsupported. |
| Panels and popovers | Native `<dialog>` and the popover API; both animate, and Esc and click-outside work. |
| Reduced motion | Every animation ends at once and shows its final state; the scroll and pointer loops do not run. |

Scroll-linked motion writes CSS variables from one `requestAnimationFrame` loop, so scrolling never re-renders React, and each loop runs only while its element is on screen. A page at rest does no work: no video, no canvas, zero layouts while idle.

## 5. Phones, tablets and touch

- **No rail below 640px.** On a phone the rail cost 36px of a 360px screen for ticks too small to tap. Phones get even 16px margins; the top bar and menu carry navigation.
- **Nothing scrolls sideways** at 360px or wider. Grids that gain columns at a breakpoint start from one shrinkable column, and the page shell clips stray overflow (`overflow-x: clip`) without clipping the full-bleed bands.
- **Fingers, not cursors.** Small text controls get an invisible 44px hit area (`.tap`): checkboxes, *Add to calendar*, *Details*, *I saw this too*, footer links.
- **Every panel fits and scrolls inside**: menu, search, alerts, inspector, report form, help, Live API.

## 6. Notifications

They behave like system banners on an iPhone or Mac: a translucent, blurred panel with an app icon, a bold title, "now" and a line or two of body, set in the system font because a notification is the device speaking, not the document. They drop in under the top bar on a damped spring, pause while hovered or held, and can be swiped up or sideways. The close button sits inside the banner at the right and is always visible, since touch screens have no hover. "You're offline" stays pinned until the connection returns.

## 7. Forms

The report form uses listboxes in the house style instead of the browser's menu: a chapter swatch or requirement code, a second line, a check on the chosen item, arrow keys, Home and End, and Escape that closes the list without closing the form. Each kind of report is a card with an icon and one line on what it means. Text areas show a character count. Scrollbars are thin and take the ink of what they scroll.

## 8. Backend: who owns which data

- **What you prepared is private.** On first contact the server issues an anonymous `HttpOnly` device cookie. Your profile, checks and followed versions are stored under that device. Reset clears only yours.
- **What applicants saw at the counter is public, and has to be earned.** A field report becomes a *corroborated pattern* only when three different devices confirm it. You cannot confirm your own report or confirm one twice, and who filed or confirmed a report is never sent to anyone.
- **Nothing is lost when connections or requests go wrong.** Checks merge record by record by `updatedAt`, so an older request never overwrites a newer one. Edits wait in a queue and are sent when the connection returns.
- **Bad input is refused, not stored.** Every body is validated with Zod and checked against the dataset: unknown ids or versions return `422`, large bodies `413`, report spam `429` (per device and per IP).
- **A real database everywhere.** With `DATABASE_URL`, the ledger is that Postgres. Without it, on any machine with a disk, the server starts an embedded Postgres (PGlite) and talks to it through the same `pg` driver and SQL. Each write is one statement whose rule the database enforces: a newer check wins, versions merge, a confirmation is a unique (report, device) row. A JSON file remains only as a fallback, and `/api/health` reports which store answers.
- **Outages are expected, not fatal.** A database outage returns `503` with `Retry-After`; every error is JSON with a request id; pages and the redline keep working from the browser's IndexedDB copy.

## 9. Removed, and why

- **A 3D paper stack in the hero.** It repeated the chapters and broke the layout for the passport. Replaced by the version switch.
- **An ambient Three.js background with looping videos.** About 1 MB on a phone, a WebGL loop, and 160 layouts per five idle seconds. Removing it took the home page's JavaScript from 478 KB to 283 KB and idle work to zero. `three`, `framer-motion` and `motion` went with it.
- **"Check all required".** One tap claimed every document was prepared, which made the readiness figure meaningless.
- **A readiness ring.** It read as a generic dashboard widget; the papers themselves replaced it.
- **An auto-advancing "motion graph" reel.** Replaced by the static, readable plan.
- **The generic SaaS kit**: a zinc palette with emerald buttons, a frosted-glass navbar, an eyebrow badge above the hero, a three-card bento grid, Geist and Inter.

## 10. Departures from the original brief

- **Fonts:** Geist, Geist Mono and Inter were replaced by Newsreader and Noto Serif Bengali.
- **Colours:** the brief's forest green is kept as the Merit Grant chapter. Status inks (ok, warn, critical) pass WCAG AA on every tint.
- **Navigation:** the numbered tab masthead and the dark scenario bar were replaced by the rail, a quiet top bar and a Walkthrough popover.
- **Corrigendum banner:** replaced by the alerts bell and a notification.
- **Figures:** the brief's examples (50%, 1 stale, 3 changes) did not match the seed data; the interface shows what the engine computes (section 1).

## 11. Known limits

- The dossiers, offices and lead times are an illustrative, hand-modelled dataset. A real product needs an ingestion pipeline from notice PDF to structured requirements, with human review.
- There are no accounts. Your state is saved on the server for your device but does not move between devices, and alerts appear only in the app (no SMS or email).
- Rate limits are counted in each server instance's memory; with several instances a determined client gets a few more requests through. A shared store such as Redis would make them exact.
- One person with several browsers counts as several devices when confirming a report. Blocking by IP would also block students on a shared campus or carrier address, so the three-device threshold and per-IP limits are the guard instead.
- View transitions animate in Chromium, Safari and recent Firefox; elsewhere, changes are instant with no loss of function.
