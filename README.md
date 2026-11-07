# NIYOM (নিয়ম)

**Be ready. Not just informed.**

In Bangladesh, scholarships, internships and public services publish their rules as notices, then revise them through corrigenda. A student can prepare every document against version 1.0 of a notice. If version 2.0 quietly changes one rule, those documents are now wrong, and nothing tells the student.

NIYOM keeps every version of a notice. It compares versions deterministically and tells you when a change makes something you have already prepared invalid. Cosmetic edits, such as a moved helpdesk room, are ignored.

## Try it in 60 seconds

```bash
npm install
npm run dev        # http://localhost:3000
```

1. Open the **Overview**. You start on the Merit Grant 2026 as originally published. Scroll past the hero: the real corrigendum plays out word by word. Struck words fade, new words arrive under a marker, and readiness falls from 100% to 57%. Keep scrolling: each dossier's chapter opens its notice like a bundle of papers, landing on the version page and a live checklist. The rail on the left swells around the section you are reading.
2. Click **Watch a corrigendum arrive**. The demo assumes you had already prepared every required item against the original notice. Update 2 then drops onto the notice stack, readiness settles at 57%, and the bell shows an alert: *4 changes that matter, 2 of your checks are now stale*.
3. Open the bell and choose **See what changed in Update 2**. The redline shows exactly which words changed.
4. Click **I have the updated document** on the stale items. They move to *Required* and readiness climbs back.
5. In **My plan**, set household income to **I don't know**. The income certificate moves to *Needs your profile*, because NIYOM never assumes you are ineligible when a field is missing.
6. Still in **My plan**, read **When to start**. It adds up the working days your remaining papers need at the offices that issue them, skips the Friday–Saturday weekend, and gives the latest safe start date. Open any paper to leave a short note, such as a receipt number; it prints on the readiness slip.
7. Open **The railway refund case** from *Walkthrough*. Two official sources give different refund timelines, and applicants' field reports are shown separately from policy.

The **Walkthrough** menu (top right) runs the same steps and can reset the demo.

## What it does

| Feature | The problem it solves |
| --- | --- |
| Versioned notices with a word-level redline | Lets you see what actually changed between two published versions; on the Overview it plays as you scroll |
| Noise filter | Contact-detail edits are marked cosmetic and never touch your checklist |
| Stale-check detection | A tick records the wording you prepared against, and goes stale when that wording changes |
| **Follow and alerts** (bell) | Tells you when a notice you follow is revised and which of your checks it broke |
| Deadline countdown and **Add to calendar** | Gives you days left plus an `.ics` file with a 3-day reminder, served by the API |
| Applicability per profile | Shows whether a rule applies to you, with the comparison it used (for example, CGPA 3.78 ≥ 3.25) |
| Cross-source conflicts | When two official documents disagree, quotes both and gives a safe course of action |
| Field reports | Shows what applicants report from counters, kept apart from official policy and marked pending verification |
| **When to start** | Adds up the working days each remaining paper needs at its office (closed Friday and Saturday) and gives the latest safe start date, then lists the visits in order |
| Papers from the same place | Groups papers that different dossiers need from your university, so one campus visit collects them. Each still needs its own check |
| A note on each item | Records which paper in your folder covers a requirement (a serial or receipt number); saved as you type and printed on the slip |
| Printable readiness slip | Gives you a one-page checklist, with your notes, to keep with your physical documents |
| Share this checklist | Copies a link that opens a dossier at a given version. It carries nothing about you |
| Table view and bulk actions | Sort requirements or dossiers in a table; re-verify every stale item at once, or clear a dossier behind a two-step confirm |
| Works offline, says where your work is | Changes are saved on the device and sent when the connection returns; the Live API panel shows whether the server has them |

## On phones and tablets

Most applicants will open NIYOM on a phone, so every screen is built for one:

- **Layout.** No page scrolls sideways at 360px or wider. Phones get even 16px margins; the side rail appears from 640px.
- **Touch.** Small controls (checkboxes, "Add to calendar", "I saw this too", footer links) get a 44px touch area without looking any larger. On touch tablets the rail ticks spread apart.
- **Panels.** The menu, search, alerts, requirement inspector, report form, help and Live API open full-height or centred, and scroll inside.
- **Notifications.** They behave like system banners on an iPhone or Mac:
  - a translucent panel with an app icon, a bold title and "now";
  - they drop in under the top bar on a soft spring;
  - swipe one up (or sideways) to dismiss it; hovering or holding pauses it;
  - "You're offline" stays pinned until the connection returns.

The decisions behind this are in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md#9-phones-tablets-and-notifications).

## Is there a backend?

Yes. Next.js Route Handlers run the same deterministic engine on the server, over a persistent ledger. Every input is validated with Zod and checked against the dataset.

**Who owns what.** There are no accounts. On first contact the server issues an anonymous device id in an `HttpOnly` cookie.

- **Private to your device:** your profile, checks and followed versions. Another browser never sees them, and resetting clears only yours.
- **Public:** community field reports. A report becomes a *corroborated pattern* only after three different devices confirm it. Each device confirms a report at most once, and never its own. Who filed or confirmed a report is never exposed.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api` | This list, as JSON |
| GET | `/api/health` | Liveness, storage mode and ledger statistics (no applicant data); `503` when the database is unreachable |
| GET | `/api/dossiers?category=…` | Every dossier, the version you follow, report counts |
| GET / PATCH | `/api/dossiers/:id` | One dossier's ledger and reports / change the version your checklist follows |
| GET | `/api/compare?notice=…&from=1&to=3` | The deterministic redline between two versions, with word-level diffs, deadline shifts in days and a SHA-256 fingerprint of each version |
| POST | `/api/evaluate` | Readiness for a profile and checks (yours by default), with each item's office and lead time and the start-date plan |
| GET | `/api/plan?notice=…` | When to start: lead days, latest safe start date, visits in order, and papers other dossiers need from the same place |
| GET / PUT / DELETE | `/api/state` | Your profile, checks and versions / save them (merged by `updatedAt`) / reset yours |
| GET / POST / PATCH | `/api/reports` | List reports / file one (`201`) / confirm one (`403` own, `409` twice) |
| GET | `/api/calendar/:id` | The deadline as an iCalendar file |

**Errors.** Every error is JSON (`{ error, status, … }`) and carries an `X-Request-Id` that matches the server log.

| Status | When |
| --- | --- |
| `400` | Validation failed; the response lists field-level issues |
| `413` | The body is over 64 KB |
| `422` | Ids or versions do not exist |
| `429` | Rate limited; the response includes `Retry-After` |
| `503` | The database is unreachable; the response includes `Retry-After` |
| `404` | Unknown `/api/*` paths, also as JSON |

**Rate limits.** Each limit applies per device, and a looser one per IP, so dropping the cookie does not reset it:

| Action | Per device | Per IP |
| --- | --- | --- |
| Filing a report | 5 per 10 min | 30 per 10 min |
| Confirming a report | 30 per 10 min | 120 per 10 min |
| Saving state | 120 per min | 600 per min |

**Offline and failures.** The browser keeps a local copy in IndexedDB, so the app keeps working without a connection.

- Changes are queued and sent one at a time.
- After a network error, `5xx` or `429`, the queue retries with backoff (or after `Retry-After`), when the connection returns, and when you come back to the tab.
- Reports filed offline are uploaded on the next sync.

**Live API** shows whether your work is backed up, and the server's JSON for the dossier on screen. Versions are named in plain words throughout the interface (*Original*, *Update 1*, *Update 2*); the API keeps the official labels such as `v2.0 Major Corrigendum`.

### Storage

| Setting | Where the ledger lives | Use it for |
| --- | --- | --- |
| `DATABASE_URL` (or `POSTGRES_URL`) set | Postgres. Tables are created on first use. | Vercel, serverless, or any deployment with more than one instance |
| Not set | One JSON file in `.data/` (or `NIYOM_DATA_DIR`), written atomically | Local development, or a single server with a disk |
| Tests | Memory | `npm test` |

In Postgres every write is a single statement whose rules the database enforces:

- An older check can never overwrite a newer one.
- Followed versions merge.
- A confirmation is a unique (report, device) row.

Any number of server instances can share one database. `/api/health` says which store is active and warns when data would not survive a restart. See [`.env.example`](.env.example) for all settings.

### Deploy on Vercel

1. Import the repository in Vercel.
2. Add a Postgres database from the Vercel Marketplace (for example Neon). This sets `DATABASE_URL`.
3. Deploy, then open `/api/health`. It should show `"persistence": "postgres"` and `"durable": true`.

Without a database, a serverless host keeps the ledger in memory per instance, and `/api/health` warns about it.

## Architecture

```
src/domain/            Pure, tested engine: version comparison, deadline deltas, applicability, readiness,
                       and the start-date plan (readiness/intelligence.ts)
src/data/seed/         Four illustrative dossiers (scholarship, railway refund, internship, e-passport)
src/data/persistence/  db.ts: IndexedDB in the browser
                       server-db.ts: the server ledger (picks Postgres or a JSON file)
                       server-pg.ts: Postgres store
                       ledger-model.ts: shared rules
src/hooks/             Zustand stores (domain, UI, follow), sync queue and derived intelligence
src/lib/               Alerts, deadlines, iCalendar builder, word diff, record merge
src/app/api/           Route Handlers over the same engine; _lib.ts holds identity, validation, limits and error handling
src/components/        Shell (rail, top bar, alerts, palette), ledger entries, inspector, screens
```

## Checks

```bash
npm run lint        # eslint .
npm run typecheck   # tsc --noEmit
npm test            # vitest: engine, word diff, alerts, deadlines, iCalendar,
                    # the whole API on memory and on Postgres, and browser-to-server sync
npm run build       # production build
```

The Postgres tests use PGlite, a real Postgres compiled to WebAssembly, through the production `pg` driver. They need no Docker and no database.

Design rationale is in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md).

*The dossiers, office names and lead times are an illustrative dataset prepared for the Credosis Phase 02 demonstration. They are not official notices.*
