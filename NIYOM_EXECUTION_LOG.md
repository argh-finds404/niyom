# NIYOM: how it was built and tested

This is the build journal for NIYOM, in the order the work happened. Each phase says what was done and how it was checked. Early phases describe the app as it was at the time. For the app as it is now, see [`README.md`](README.md); for the reasons behind the design, see [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md).

- **Author:** Shoumik Orgho
- **Source code:** [github.com/argh-finds404/niyom](https://github.com/argh-finds404/niyom)
- **Live app:** [niyom-swart.vercel.app](https://niyom-swart.vercel.app)
- **Shape of the code:** one Next.js app, with a pure TypeScript engine at its centre, Zustand and IndexedDB in the browser, and Postgres on the server

## At a glance

| Phase | Date | What it delivered | Tests passing |
| --- | --- | --- | --- |
| A | 4 Nov 2026 | Project set-up, the engine, the four sample notices, browser storage | first suite |
| C | 7 Nov | The API, server storage and syncing | 26 |
| C.1 | 7 Nov | Private data per visitor, rules for field reports, safe merging | 34 |
| C.2 | 7 Nov | Postgres, clear errors, retries: ready to deploy | 71 |
| D | 7 Nov | Phones, tablets and new notifications | 71 |
| E, E.1 | 7 Nov | "When to start", notes on papers; a heavy experiment removed | 77 |
| F–J | 7–8 Nov | The film scene, notice objects that open like books, the rail, footer and forms | 77 |
| K | 8 Nov | An embedded Postgres for local use, cleanup | 77 |
| L | 8 Nov | Figures pinned by tests, documents for submission | 81 |
| M | 8 Nov | Live on Vercel with a Neon database | 81 |
| N | 8 Nov | The opening scene, smoother scrolling, documents rewritten for reviewers | 81 |

---

## Phase A: Foundation (4 Nov 2026)

- Created the Next.js 16 project with TypeScript, and installed Zod, Zustand, Dexie, Lucide icons and Vitest.
- Set the Git identity and commit hooks for the repository.
- Laid out the folders (`app`, `components`, `domain`, `data`, `hooks`, `lib`, `tests`).
- Wrote the core types (notice, version, requirement, profile, readiness record and others) and the Zod schemas that check them.
- Built the engine in `src/domain/`:
  - text normalising;
  - deadline differences in days;
  - comparing two versions (with a check for duplicate IDs);
  - telling cosmetic changes from real ones;
  - "does this rule apply to me?";
  - the readiness percentage.
- Wrote the four sample notices: the Merit Grant (three versions), the railway refund, the ICT fellowship and the e-passport checklist, with a sample student profile and field reports.
- Added browser storage (IndexedDB through Dexie, safe during server rendering) and the app's state store, with the walkthrough steps.
- Added the first engine tests, and checked that typecheck, tests and build pass.

## Phase C: The backend (7 Nov)

- Added server-side storage for profiles, ticks, field reports and followed versions.
- Tightened the Zod schemas: income can't be negative, text is trimmed, lengths are capped.
- Built the API:
  - `health`, `dossiers`, `compare`, `evaluate`, `reports`, `state` and `calendar`;
  - field reports become a *confirmed pattern* at three confirmations.
- Connected the app to the API. It keeps the offline copy in IndexedDB and shows whether it is online, connecting or offline.
- Added the **I saw this too** button and the **Live API** viewer.
- **Checked:** typecheck clean, 26 of 26 tests, production build passes.

## Phase C.1: Making the backend safe (7 Nov)

- Each visitor now gets an anonymous ID in an `HttpOnly` cookie, and their data is private to it. Field reports stay public, without saying who filed them.
- "Reset" clears only your own data, never other people's reports.
- Confirming a report: once per device, never your own (`403` and `409`), and a pattern needs three different devices.
- Changes merge record by record by time, so an older change can't overwrite a newer one. The browser sends changes one at a time and retries when it reconnects.
- Safe file writes, bad input refused (`422`), large bodies refused (`413`), rate limits (`429`).
- **Checked:** end to end over HTTP with two separate visitors, and in the browser. 34 of 34 tests.

## Phase C.2: Ready to deploy (7 Nov)

- Added a Postgres store behind the same interface as the file store, chosen by `DATABASE_URL`. Each write is one statement the database enforces. Tables are created on first use.
- Every API route returns clear JSON errors (`503` with a retry time when the database is down, `500` on bugs), a request ID, and no caching. Added `GET /api` and JSON 404s.
- Per-IP rate limits as well as per-device limits; secure cookies behind HTTPS; security headers.
- The browser retries with backoff after `429`, `5xx` or a network error, and syncs again when you reconnect or come back to the tab.
- **Checked:** 71 of 71 tests, including the whole API on Postgres. On the production build: two servers sharing one database, a database outage and recovery, and the full walkthrough.

## Phase D: Phones, tablets and notifications (7 Nov)

- Every screen checked at 360, 390 and 768px.
- The rail is hidden on phones, which get even 16px margins instead.
- Fixed sideways scrolling on two pages.
- Small buttons get a 44px touch area.
- Notifications redesigned to look like phone system banners: frosted, with an app icon, a spring drop-in and swipe to dismiss. "You're offline" stays until you're back.
- Fixed notifications disappearing instantly when the device asks for reduced motion.
- **Checked:** no sideways scrolling at 360 and 390px, swipes work, 71 of 71 tests.

## Phase E: Planning features (7 Nov)

- **When to start:** working-day lead times for each office (Sunday to Thursday) and the latest safe start date.
- **A note on each paper** (a receipt or serial number), saved everywhere and printed on the readiness slip.
- `GET /api/plan`, plus a tab for it in the Live API viewer.
- A sortable table view, a two-step confirm for destructive actions, and share links.
- An experiment with a 3D background, looping videos and a motion graph (removed in E.1).
- **Checked:** typecheck, lint, 77 of 77 tests, build.

## Phase E.1: Keeping it honest and light (7 Nov)

- Removed the 3D background, the videos and the motion graph, along with the `three`, `framer-motion` and `motion` packages. On a phone, scripts went from 478 KB to 283 KB, images and video from about 1 MB to nothing, and an idle page stopped doing work.
- "When to start" now shows a plain sentence and the visits in order.
- Grouped shared papers honestly, by issuing office, without claiming one paper satisfies another.
- Removed **Check all required**, because one tap made the readiness figure meaningless.
- Share links carry nothing personal.
- **Checked:** 77 of 77 tests. In the browser: notes save, share links open the right version, the walkthrough reaches 57%, no sideways scrolling, and a clean console.

## Phases F to J: Motion, objects and finish (7–8 Nov)

- **The corrigendum scene:** the Merit Grant's changes are rewritten word by word as you scroll. It looks like an old film (sepia, moving film edges, grain, flicker), and readiness falls 100 → 83 → 71 → 57. Screen readers get the same story as a list.
- **Notice objects that open like books:** the cover swings over, printed pages riffle after it, and the spread lands flat with page edges and a shadow. Fixed a 3D bug that painted the cover over the pages, and a miss where a fast scroll sometimes stopped a book from opening.
- **The rail:** lines that swell around the reading position and follow the pointer, with the section's name shown beside its line.
- **Drifting Bengali words** behind the hero and on each page, using CSS only.
- **A new app icon, logo and footer.** The footer is at least one screen tall, so the floating bar never covers a strip of the section above.
- **Plain version names:** *Original*, *Update 1*, *Update 2* everywhere in the app; the API keeps the official labels.
- **The report form:** custom dropdowns that work with the keyboard, report types as cards, a character count.
- **Fixes:**
  - a build error caused by reading today's date during prerendering;
  - opening a page from the footer no longer scrolls up visibly.
- **Checked each time:** typecheck, lint, 77 of 77 tests and the build. Browser checks at 360, 390, 768 and 1440px: the flows work, books open every time, no sideways scrolling, an idle page does no work, and the console is clean.

## Phase K: A real database on every machine (8 Nov)

- Without `DATABASE_URL`, the server now starts an embedded Postgres (PGlite) in `.data/pglite`, using the same driver and SQL as the live site. A lock file stops two servers opening it at once, and it falls back to a JSON file if it can't start. `/api/health` says which database is in use.
- **Checked:**
  - data survives a hard kill and restart;
  - a stale lock is taken over;
  - production dependencies have 0 known vulnerabilities.
- Smaller fixes:
  - the notification close button sits inside the banner;
  - rail labels are shorter;
  - the last "v1.0 / v2.0" strings were renamed.
- Removed unused code: four helpers, an unused animation and an unused prop.
- **Checked:** 77 of 77 tests, and the flows work against the embedded database.

## Phase L: Figures you can trust, documents for submission (8 Nov)

- Added `readinessIfPreparedForOriginal` to the engine, so the home page's figures (Merit 57%, railway 80%, ICT 60%, e-passport 50%) are calculated and pinned by `tests/domain/prepared.test.ts`. Nothing is typed into the interface.
- The walkthrough steps work for any notice and version, not just the Merit Grant.
- Removed three unused type aliases and old styles.
- `package.json` now requires Node.js 20.9 or later.
- **Checked:** 81 of 81 tests, and browser checks at 360, 390, 1366×650 and 1440×900.

## Phase M: Live (8 Nov)

- Deployed to Vercel at [niyom-swart.vercel.app](https://niyom-swart.vercel.app).
- Connected a Neon Postgres database in Singapore, the closest region to Bangladesh.
- **Checked:** `/api/health` reports `"database": "postgres (DATABASE_URL)"`, `"durable": true` and no warnings, and the main API routes answer on the live site.

## Phase N: The opening scene, smoother scrolling, documents for reviewers (8 Nov)

- **A new opening scene** (`src/components/ui/HeroScene.tsx`). The old hero showed a list of clauses with a version switch, which read like a table on first sight. The new one plays the idea by itself in about four seconds:
  1. the student's folder reads 100%;
  2. a *Corrigendum* stamp lands and the changed rules are struck and rewritten;
  3. NIYOM's card arrives like a notification, drops to 57% and names the papers to check again.

  Visitors can click a step, replay it, or play it on any of the four notices; every figure comes from the engine. The new headline: *The notice changed. Your papers didn't.* It fits above the fold at 1366×650, 1024×768 and 1440×900. On phones, the notice and NIYOM's alert appear on the first screen.
- **Smoother scrolling.** Measured in a production build with Chrome's performance tools:
  - The opening books wrote their tilt as CSS variables, so about 200 elements inside each book were restyled every frame. They now write one finished `transform` on one element, and restyle fewer than 10.
  - The rail's lines restarted a CSS transition on every scroll frame. They now follow the scroll directly, and glide only when the pointer leaves.
  - Result: a typical frame while scrolling the home page went from 33 ms to 16.7 ms (60 frames per second).
- Removed the books' unused "open while scrolling" mode.
- Fixed "My plan" wrapping onto two lines in the top bar at 1024px.
- Rewrote `README.md`, `DESIGN_DECISIONS.md` and this log in plain language for reviewers. The README now:
  - opens with what was built, how to get in (no login), what is implemented, and how the key features work;
  - maps the Phase 02 brief point by point: one core feature, three supporting features;
  - adds how I worked, the challenges and how I handled them, a diagram of how the pieces connect, the files worth reading first, and next steps.
- **Checked:**
  - typecheck, lint, 81 of 81 tests and the production build all pass;
  - the scene plays correctly on all four notices (57%, 80%, 60%, 50%) at 1440×900, 1366×650, 1024×768, 390×844 and 360×740;
  - no sideways scrolling;
  - all four books still open;
  - the console is clean.
