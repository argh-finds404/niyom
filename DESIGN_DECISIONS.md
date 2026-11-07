# NIYOM: design decisions

This file records how the interface was designed, where it departs from `CLAUDE_MASTER_BRIEF.md`, and why. Everything not listed here follows the brief.

## 1. Direction: the Stripe Press reading model, softened

The interface follows the structure and motion of [Stripe Press](https://press.stripe.com/we-are-as-gods), studied in a real browser at desktop and phone width. It does not use Stripe's fonts, logo or copy.

| The reference does | NIYOM does |
| --- | --- |
| One serif family everywhere, with italic sub-labels | **Newsreader** for everything. Its optical sizes give tight display cuts and open text cuts. Requirement codes are set in small caps. |
| A five-stop pastel wash behind the hero | A **monsoon-morning wash** (lilac, mist blue, paddy green, lotus pink) that runs under the top bar and the rail. |
| Each book is a chapter with its own solid colour field | **Each dossier is a chapter** (forest, night violet, olive and navy, maroon). Working pages take a light tint of that colour, and the page fades between tints when you switch dossiers. |
| A fixed left rail with one tick per section. The active tick is at full opacity, the rest at about 30%. Ticks take the colour of the section underneath and stagger in on load. Hovering reveals every section's title as a contents list. | **The same rail, tracking your scroll on every page.** Sections opt in with `data-rail`. A single indicator slides to the section you are reading and lengthens as you read through it. Ticks swell under the pointer, and hovering the rail fans out all section titles as a contents list. Ticks stagger in on each page and take the colour of whatever lies beneath. It also works on phones (ticks only). |
| A 3D book in perspective, rising into its section | **Each dossier as its own object, stacked by version.** The Merit Grant is an official circular with a seal. The railway refund is a stack of e-tickets with a perforated stub, a masked PNR and a barcode. The ICT fellowship is a code window whose changed lines light up, with a blinking caret. The e-passport is a passport booklet whose cover swings open on hover to show the checklist inside. Every object uses its dossier's colours. The stack deals in the first time it is seen, floats on the hero, fans out under the pointer and turns as its section scrolls by. When a newer version arrives, its sheet drops on top and its stamp lands ("Corrigendum", "Revised terms", "Revised", "Amended"). |
| A stroke-drawn monogram | **An "N" engraved as three parallel strokes**: the same rule written three times, one per version. It draws itself on load and is used for the favicon (`app/icon.svg`) and Apple icon (`app/apple-icon.tsx`). |

## 2. From the pasted review: what was taken and what was left

**Taken:**

- **Less on screen at once.** Each requirement shows a check, its title, the rule and at most one status. Everything else opens in a slide-over **inspector**: applicability, history, sources, conflicts and field reports.
- **Softer geometry.** 10px on controls, 14px on cards, 20px on panels, 4px on paper sheets. No more square-cornered black boxes.
- **No permanent demo bar.** The demo is a **Walkthrough** popover in the top bar, plus one link in the hero.
- **A real API layer** (`src/app/api/*`) and a **Live API** inspector that shows the server's JSON.
- **Before-and-after cards** on the Changes page instead of a wide table. Unchanged items collapse into one line.

**Left, because it is the generic SaaS look the brief asks us to avoid:**

- A zinc palette with emerald buttons
- A frosted-glass navbar
- An eyebrow badge above the hero
- A three-card bento grid
- Geist and Inter type

## 3. Product: the loop the interface is built around

**Follow → alert → review → re-verify → ready.**

- **Follow.** Every dossier is followed by default. You can unfollow from a dossier's page.
- **Alert.** The bell lists each revision of a followed notice that your checklist follows and you have not reviewed yet. Each alert says how many changes matter, how many cosmetic edits were ignored, and how many of your checks went stale. Alerts are derived from the data, never stored separately.
- **Review.** Opening the redline marks the alert as read.
- **Re-verify.** A stale item shows the old and new wording with a single fix: *I have the updated document*. The item then glides into *Required*, and readiness counts up.
- **Be on time.** Deadlines show the days left, and **Add to calendar** downloads an `.ics` file from `/api/calendar/:id` with a reminder three days before.

## 4. Motion

Motion either responds to what you do or marks one deliberate moment.

| Moment | Behaviour |
| --- | --- |
| Page change | React 19.3 `<ViewTransition>`: the old page fades out and the new one rises in. The notice stack morphs from the overview into its specification page. |
| Re-verify, check, profile change | Runs inside the View Transition API, so items glide to their new group while the readiness figure counts up. |
| Corrigendum arrives | The sheet drops on top, the stamp lands, the bell rings once, and a soft toast appears. |
| Notifications | System-style banners (see section 9). They drop in on a soft spring, pause while read, and lift away. Swipe up or sideways to dismiss. |
| Panels and popovers | Native `<dialog>` and the popover API. Both animate open and closed, and Esc and click-outside work. |
| Reduced motion | Every animation has a fallback. The scroll and pointer loops do not run at all. |

Scroll-linked motion writes CSS variables from one `requestAnimationFrame` loop, so scrolling never re-renders React.

## 5. Numbers are computed, never typed

Every figure on screen comes from the domain engine. After *A corrigendum arrives*, it gives:

- **Readiness:** 57%, which is 4 of 7 required items
- **Stale checks:** 2
- **Changes that matter (v1.0 → v2.0):** 4

The brief's examples (50%, 1 stale, 3 changes) do not match the seed data. The tests and the `/api/evaluate` response agree with the screen.

## 6. Data and infrastructure changes

- **`REQ-RW-05`** was added to both railway versions so the payment-channel control has a real effect.
- **`db.ts`** emits a `niyom:storage-error` event, and the UI turns it into a soft notification.
- **`useWatchStore`** holds `lastSeen` and the unfollowed list in localStorage. It hydrates manually on mount, so server and client HTML agree.
- **Cache Components keeps visited pages mounted but hidden.** For that reason:
  - The rail ignores sections that are not rendered.
  - The page colour is set on `<html>` by the visible page's effect. A `:has()` selector only covers the first paint.
  - Requirement anchors are unique per screen.
- **The default `favicon.ico`** (the Next.js triangle) was replaced by the NIYOM mark.

## 7. Fixes from hands-on testing

- **Runtime error:** `InvalidStateError: Transition was aborted… Viewport size changed` (the dev overlay's "1 Issue") came from resizing the window during an item's glide. View transitions are now treated as optional: their promises are caught, and they are skipped when the tab is hidden. The page also keeps a stable scrollbar gutter, so opening a dialog no longer resizes the viewport.
- **Navbar collision:** the top bar is always opaque (it used to be transparent at the top of the page). Every rail target and anchor clears the bar via `scroll-margin-top`. The hero wash now starts below the bar.
- **Brand:** the N mark and the NIYOM wordmark sit together in the top bar. The rail is slimmer (56px).
- **My plan:** the context column is wider (320–370px), and its controls never clip or wrap mid-label ("bKash/Nagad").
- **Directory:** the category tabs and filters sit on separate rows below 1536px.
- **Rail:** the indicator was measured from the wrong parent and stayed on the first tick. It now follows the section you are reading.

## 8. Backend: who owns which data

A second pass (by another agent) added a server ledger and four endpoints. Its routes and Zod validation were kept. Its data model kept **one profile and one checklist for every visitor**, so a new visitor saw the previous visitor's CGPA and checks. It was rebuilt around this rule:

- **What you prepared is private.** On first contact the server issues an anonymous `HttpOnly` device cookie. Your profile, checks and followed versions are stored under that device. Reset clears only yours.
- **What applicants saw at the counter is public, and has to be earned.** Field reports are shared. A report becomes a *corroborated pattern* only when three different devices confirm it. You cannot confirm your own report or confirm one twice. Who filed or confirmed a report is never sent to anyone. The report shows *You reported this* or *You confirmed this* instead of the button.
- **Nothing is lost when connections or requests go wrong.** Checks merge record by record by `updatedAt`, so an older request cannot overwrite a newer one. Edits wait in a queue and are sent when the connection returns. The ledger file is written atomically, and an unreadable file is set aside, never overwritten.
- **Bad input is refused, not stored.** Unknown dossiers, requirements or versions return `422`. Large bodies return `413`. Report spam returns `429`, limited per device and per IP.
- **It runs the same on one server or many.**
  - With `DATABASE_URL`, the ledger is Postgres. Every write is one statement whose rule the database enforces: a newer check wins, versions merge, and a confirmation is a unique (report, device) row. Ten clicks at once across two server instances count once.
  - Without a database, the ledger is a JSON file, and `/api/health` warns when it would not survive a restart.
- **Outages are expected, not fatal.**
  - A database outage returns `503` with `Retry-After`. Every error is JSON with a request id, and pages and the redline keep working.
  - The browser keeps each change and retries with backoff, on reconnect, and when you return to the tab. Reports filed offline go up on the next sync.

The findings and fixes from both passes are listed in [`reviews/backend-audit.md`](reviews/backend-audit.md).

**Footer.** The line naming the demonstration programme was replaced with two that matter to the person using the site:

- **Where their work is.** For example: saved on this device and backed up to the server at 14:32, or offline and waiting to send. The Live API dot shows the same state instead of always being green.
- **The disclaimer.** The dossiers are sample cases and are not official; confirm with the issuing office.

## 9. Phones, tablets and notifications

**Phones (below 640px)**

- **No rail.** On a phone the rail had already lost its labels and help button. What was left was a column of 22px ticks that are too small to tap, and it cost 36px of a 360px screen. The content was also lopsided: a 52px left margin against 16px on the right. Phones now get even 16px margins, and the top bar and menu carry navigation. Tablets and desktops keep the rail unchanged.
- **Nothing scrolls sideways.** Two Specification pages were 13–58px wider than the screen. Their single-column grid sized itself to the longest version title, which never wraps. Every grid that only gains columns at a breakpoint now starts from one column that can shrink (`grid-cols-1`). Larger layouts are untouched.
- **Fingers, not cursors.** On touch screens, small text controls get an invisible 44px-tall hit area (`.tap`), so they look the same but are easy to hit:
  - requirement checkboxes;
  - "Add to calendar", "Details", "Where this comes from";
  - "I saw this too", "Add what you saw";
  - footer links and the directory titles.

  On touch tablets, the rail ticks are spaced 34px apart.
- **Verified** at 360, 390 and 768px on every screen and every overlay:
  - no page wider than the screen;
  - no control under 32px without a hit area;
  - menu, search, alerts, inspector, report drawer, help and Live API all fit and scroll.

  The only text under 12px is inside the miniature document illustrations, where it is decoration.

**Notifications, like an Apple notification banner**

- **Material.** A translucent, blurred panel over the page (opaque where blur is unsupported), with a hairline edge and a soft shadow, rounded to 22px.
- **Identity.** An app icon on the left: the NIYOM mark for news, and a symbol on a tinted tile for outcomes (green check, amber or red warning). Then a bold title, "now", and one or two lines of body.
- **Typeface.** The system font (SF Pro on Apple devices, Segoe UI on Windows) instead of Newsreader. A notification is the device speaking, not the document, and the change of voice makes that clear.
- **Place.** Under the top bar, centred on phones and at the top right on larger screens, near the bell. The newest is on top.
- **Motion.** In on a damped spring with about 4% overshoot, written as a CSS `linear()` curve. Out by lifting and fading. The slots close smoothly, so the remaining banners glide instead of jumping.
- **Control.**
  - Swipe up or sideways to dismiss: the banner follows the finger and springs back if released early, and the page does not scroll.
  - The timer is invisible and pauses while a banner is hovered, focused or held.
  - On desktop, a close button appears at the top left on hover, as on macOS; keyboard focus shows it too.
- **"You're offline"** is a pinned banner of the same kind, removed when the connection returns.
- **Fixed on the way:** with Reduce Motion on, the global rule shortened every animation to 1ms, including the old notification timer, so notifications vanished instantly. The timer is now exempt.

## 10. Departures from the brief's visual spec

- **Fonts:** Geist, Geist Mono and Inter are replaced by Newsreader, plus Noto Serif Bengali for নিয়ম only.
- **Colours:** the brief's forest green is kept as the Merit Grant chapter. Status inks (ok, warn, critical) are kept and pass AA on every tint.
- **Navigation:** the numbered tab masthead and the dark scenario bar are replaced by the rail, a quiet top bar and the Walkthrough popover.
- **Corrigendum banner:** replaced by the alerts bell and a soft notification.

## 11. Known limits

- The dossiers are an illustrative, hand-modelled dataset. A real product needs an ingestion pipeline: from notice PDF to structured requirements, with human review.
- There are no accounts. Your state is saved on the server for your device, but it does not move between devices. Alerts appear in the app; nothing is pushed by SMS or email.
- Rate limits are counted in each server instance's memory, so with several instances a determined client gets a few more requests through. A shared store such as Redis would make them exact.
- One person with several browsers counts as several devices when confirming a report. Blocking that by IP would also block students who share a campus or mobile-carrier address, so the threshold (three devices) and the per-IP limits are the guard instead.
- View transitions animate in Chromium, Safari and recent Firefox. Elsewhere, changes are instant with no loss of function.
- Newsreader approximates Ivar (licensed) but is not identical.
- `npm run lint` calls `next lint`, which Next 16 removed.
