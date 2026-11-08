# NIYOM (নিয়ম)

**Be ready. Not just informed.**

In Bangladesh, scholarships, internships and public services publish their rules as notices, then revise them through corrigenda. A student prepares every document against the notice as first published. When an update quietly changes one rule, some of those documents are now wrong, and nothing tells the student until a counter turns them away.

NIYOM keeps every version of a notice, compares them word for word, and tells you exactly which of the papers you already prepared an update has made invalid. Small edits that do not change what you need to submit—like a moved helpdesk room—are recognized and left off your checklist.

> Built for the Credosis Internship Program, Phase 02 (Frontend track). The four dossiers are an illustrative dataset modelled on real Bangladeshi notices; they are not official.

## Contents

- [The idea in one interaction](#the-idea-in-one-interaction)
- [Features](#features)
- [A three-minute walkthrough](#a-three-minute-walkthrough)
- [Screens](#screens)
- [Design](#design)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Architecture](#architecture)
- [API](#api)
- [Data and storage](#data-and-storage)
- [Quality](#quality)
- [Deploy](#deploy)
- [Project documents](#project-documents)
- [Limitations](#limitations)

## The idea in one interaction

The Overview opens on a notice with its published versions as a switch. The applicant shown has prepared every paper for the original, so readiness reads 100%. Switch to the latest update and the sheet rewrites the clauses it changed, the corrigendum stamp lands, and readiness falls to what that update really leaves standing:

| Dossier | Original | After the latest update |
| --- | --- | --- |
| Merit Grant 2026 | 100% | **57%**: two prepared papers changed, one new paper required (a cosmetic Update 1 in between leaves it at 100%) |
| Railway e-ticket refund | 100% | **80%**: a new SMS two-factor rule |
| ICT SE Fellowship 2026 | 100% | **60%**: the deadline moved, a GitHub portfolio was added |
| e-Passport checklist | 100% | **50%**: the identity-document wording changed, an enrolment certificate was added |

None of these figures are typed into the interface; the readiness engine computes them and `tests/domain/prepared.test.ts` pins them. **Try it on my checklist** then applies the same update to your own plan.

## Features

**Core feature: version-aware readiness.** Every check records the exact wording you prepared against. When a later version changes that wording, the check turns *stale* until you re-verify it, and readiness counts only what still holds.

**Supporting features**

| Feature | What it gives the applicant |
| --- | --- |
| Word-level redline | What actually changed between two versions, word by word, with deadline shifts in days |
| Noise filter | Contact-detail edits are marked cosmetic and never touch your checklist |
| Alerts | The bell tells you when a notice you follow is revised and which of your checks it broke |
| Applicability per profile | Whether each rule applies to you, with the comparison used (for example, CGPA 3.78 ≥ 3.25); a missing profile field is never read as ineligible |
| When to start | The working days your remaining papers need at the offices that issue them, over the Sunday–Thursday week, giving the latest safe start date and the visits in order |
| Deadlines | Days left and an **Add to calendar** `.ics` file with a three-day reminder |
| Conflicting sources | When two official documents disagree, both are quoted with a safe course of action |
| Field reports | What applicants report from counters, kept apart from policy and marked pending until three devices confirm it |
| A note on each paper | Which paper in your folder covers a requirement (a serial or receipt number), printed on the readiness slip |
| Readiness slip | A one-page printable checklist to keep with the physical documents |
| Share a checklist | A link that opens a dossier at a given version, carrying nothing about you |
| Works offline | Changes are saved on the device and sent when the connection returns |

## A three-minute walkthrough

```bash
npm install
npm run dev        # http://localhost:3000
```

1. **Overview, hero.** Switch the Merit Grant from *Original* to *Update 2*: the changed clauses are struck and rewritten, the stamp lands, readiness falls from 100% to 57%. Try *Update 1* (a cosmetic edit: still 100%) and the other three dossier tabs. Point at a clause to see the office that issues the paper and its lead time.
2. **Try it on my checklist.** The update is applied to your own plan: a notification arrives, the bell shows an alert, and the page scrolls to *Your next steps*, where each changed paper shows what you prepared against what the notice now says. Click **I have the updated document** and readiness climbs back.
3. **Keep scrolling.** *The corrigendum, word by word* replays the update as an old picture show, then each dossier's chapter opens its notice like a bundle of papers.
4. **My plan.** Set household income to *I don't know*: the income certificate moves to *Needs your profile*. Read *When to start*, add a note to a paper, and print the readiness slip.
5. **Changes.** The full redline between any two versions, with the cosmetic edits filtered out.
6. **The railway case** (Walkthrough menu, top right). Two official sources give different refund timelines; field reports sit beside them, apart from policy. **Report a change** files your own.
7. **Live API** (footer). The server's JSON for the dossier on screen, and whether your work is backed up.

The **Walkthrough** menu runs the same steps and can reset the demo.

## Screens

| Screen | Purpose |
| --- | --- |
| Overview | The hero, the corrigendum scene, your next steps, when to start, and one chapter per dossier |
| Directory | Every dossier with search, category tabs, filters, and a sortable table view |
| Specification | One dossier's requirements by group, its versions, sources and field reports |
| Changes | The redline between two versions, filterable by what matters and what is cosmetic |
| My plan | Your profile, readiness per dossier, the visit plan, notes, the slip and a share link |
| Panels | Search (Ctrl K), alerts, requirement inspector, report form, help, Live API |

## Design

The interface follows the reading model of Stripe Press: one serif family (Newsreader, with Noto Serif Bengali), a pastel wash behind the opening screen, a colour field per dossier, and a section rail that swells with the scroll. Motion answers what you do (a version switch, a re-verify, a page change) or marks one moment (the corrigendum scene), and every animation has a reduced-motion fallback. Every screen works from 360px phones upward, and keyboard users can reach every control.

The reasoning behind each decision is in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Turbopack), React 19.3 (`<ViewTransition>`) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, CSS scroll-driven animations, native `<dialog>` and popover |
| Client state | Zustand, with an IndexedDB copy through Dexie |
| Validation | Zod v4, shared by the browser and the server |
| Server | Next.js Route Handlers |
| Database | PostgreSQL through `pg`: a hosted database via `DATABASE_URL`, or an embedded Postgres (PGlite) locally |
| Tests | Vitest |

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev          # development server at http://localhost:3000
npm run build        # production build
npm start            # serve the production build
```

No environment variables are needed. Without `DATABASE_URL` the server starts an embedded Postgres in `.data/pglite`. All settings are listed in [`.env.example`](.env.example).

## Architecture

```
src/
  domain/               Pure, framework-free engine
    comparison/         Version comparison, deadline deltas, text normalisation
    readiness/          Applicability, readiness, stale checks, the start-date plan
    schemas.ts          Zod schemas shared by the browser and the API
  data/
    seed/               The four dossiers and the default applicant profile
    persistence/        db.ts (IndexedDB in the browser), server-db.ts (chooses the server store),
                        server-pg.ts (Postgres store), ledger-model.ts (shared rules)
  hooks/                Zustand stores (domain, UI, follow), the sync queue, derived intelligence,
                        and the walkthrough scenarios
  lib/                  Alerts, deadlines, iCalendar, word diff, record merge, formatting
  app/                  Pages and the API (Route Handlers in app/api; _lib.ts holds identity,
                        validation, rate limits and error handling)
  components/
    layout/             Shell: top bar, rail, footer, alerts, search, panels
    ledger/             Requirement entries, the inspector, redlines
    screens/            One component per page
    ui/                 The hero, the notice objects, the corrigendum scene, primitives
tests/                  Engine, word diff, features, the API on memory and on Postgres, browser sync
```

The domain layer has no dependency on React, Next.js or storage, so the same engine runs in the browser (instant feedback, offline) and in the API (validation, the source of truth for each device). Components read derived state from hooks and never compute readiness themselves.

## API

Every route runs the same engine. Inputs are validated with Zod and checked against the dataset.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api` | This list, as JSON |
| GET | `/api/health` | Liveness, the database in use and ledger statistics (no applicant data); `503` when the store is unreachable |
| GET | `/api/dossiers?category=…` | Every dossier, the version you follow, report counts |
| GET / PATCH | `/api/dossiers/:id` | One dossier's ledger and reports / change the version your checklist follows |
| GET | `/api/compare?notice=…&from=1&to=3` | The redline between two versions, with word-level diffs, deadline shifts in days and a SHA-256 fingerprint of each version |
| POST | `/api/evaluate` | Readiness for a profile and checks (yours by default), with each item's office and lead time and the start-date plan |
| GET | `/api/plan?notice=…` | When to start: lead days, latest safe start date, visits in order, papers other dossiers need from the same place |
| GET / PUT / DELETE | `/api/state` | Your profile, checks and versions / save them (merged by `updatedAt`) / reset yours |
| GET / POST / PATCH | `/api/reports` | List field reports / file one (`201`) / confirm one (`403` own, `409` twice) |
| GET | `/api/calendar/:id` | The deadline as an iCalendar file |

**Identity.** There are no accounts. On first contact the server issues an anonymous device id in an `HttpOnly` cookie. Your profile, checks and followed versions are private to that device; field reports are public, and who filed or confirmed one is never exposed.

**Errors.** Every error is JSON (`{ error, status, … }`) with an `X-Request-Id` that matches the server log: `400` validation (with field-level issues), `404` unknown path, `413` body over 64 KB, `422` unknown ids or versions, `429` rate limited and `503` store unreachable (both with `Retry-After`).

**Rate limits** apply per device and, more loosely, per IP: filing a report 5 per 10 minutes (30 per IP), confirming 30 per 10 minutes (120 per IP), saving state 120 per minute (600 per IP).

The interface names versions in plain words (*Original*, *Update 1*, *Update 2*); the API keeps the official labels, such as `v2.0 Major Corrigendum`.

## Data and storage

| Setting | Where the server ledger lives | Use it for |
| --- | --- | --- |
| `DATABASE_URL` (or `POSTGRES_URL`) set | That Postgres, for example Neon. Tables are created on first use. | Deployments, including serverless and several instances |
| Not set, on a machine with a disk | An embedded Postgres (PGlite) in `.data/pglite`, reached through the same `pg` driver and SQL | `npm run dev` and `npm start`: a real database with nothing to install |
| Serverless without a database, or `NIYOM_STORE=file` | A JSON file in `.data/`, or memory on a read-only disk | Fallback only, also used if the embedded database cannot start |

In Postgres every write is a single statement whose rule the database enforces: an older check never overwrites a newer one, followed versions merge, and a confirmation is a unique (report, device) row, so any number of server instances can share one database. Only one process opens the embedded database at a time (a lock file guards it). `/api/health` reports the database in use and warns when data would not survive a restart.

In the browser, a copy of your state lives in IndexedDB, so the app keeps working offline. Changes are queued, sent one at a time, and retried with backoff (or after `Retry-After`) when a request fails, when the connection returns, and when you come back to the tab.

## Quality

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit (strict)
npm test            # Vitest: 81 tests in 8 files
npm run build       # production build
```

The tests cover the comparison and readiness engine, the per-dossier figures shown in the hero, the word diff, alerts, deadlines and iCalendar output, the whole API on an in-memory store and on Postgres (PGlite, through the production `pg` driver, no Docker needed), and browser-to-server sync.

Each release was also checked in a production build in Chrome at 360, 390, 768, 1366 and 1440px wide: no page scrolls sideways, every panel fits, the main flows complete, the console stays clean, and an idle page does no layout work.

## Deploy

On Vercel:

1. Import the repository.
2. Add a Postgres database from the Vercel Marketplace (for example Neon). This sets `DATABASE_URL`.
3. Deploy, then open `/api/health`. It should report `"database": "postgres (DATABASE_URL)"` and `"durable": true`.

Without a database, a serverless host keeps the ledger in memory per instance; the app still works, since each browser keeps its own copy, and `/api/health` warns about it.

## Project documents

| Document | Contents |
| --- | --- |
| [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) | Why the product looks and behaves as it does |
| [`NIYOM_EXECUTION_LOG.md`](NIYOM_EXECUTION_LOG.md) | How it was built and verified, phase by phase |

## Limitations

- The dossiers, offices and lead times are hand-modelled. A real product needs an ingestion pipeline from notice PDF to structured requirements, with human review.
- There are no accounts: your state follows your device, not you, and alerts appear only in the app.
- Rate limits are counted per server instance; a shared store such as Redis would make them exact across instances.

*The dossiers, office names and lead times are an illustrative dataset prepared for the Credosis Phase 02 demonstration. NIYOM is not affiliated with any institution named; always confirm with the issuing office.*
