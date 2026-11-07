# NIYOM — Phase A Execution & Verification Log
- **Lead Engineer**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Repository**: `niyom`
- **Architecture**: Modular Monolith (Pure TypeScript Domain Engine + Zustand + Dexie IndexedDB + Next.js App Router)

## Execution Progress
- [x] **Step 0**: Execution Log Initialized — *Completed at 2026-11-04 10:23:00 +06:00. Execution log initialized, ANTIGRAVITY_INIT.md specification verified.*
- [x] **Step 1**: Next.js Project Scaffolded & Dependencies Installed (`zod`, `zustand`, `dexie`, `lucide-react`, `vitest`) — *Completed at 2026-11-04 10:31:00 +06:00. Next.js 16 (App Router) scaffolded, runtime & testing dependencies installed, package.json scripts and vitest.config.mts configured.*
- [x] **Step 2**: Git Identity Locked (`Shoumik Orgho <orghodutta@gmail.com>`) & Git Hooks Installed (`commit-msg`, `pre-commit`, `pre-push`) — *Completed at 2026-11-04 10:31:40 +06:00. Git user configured to Shoumik Orgho <orghodutta@gmail.com>, hooks created in .githooks and .git/hooks, core.hooksPath set to .githooks.*
- [x] **Step 3**: Modular Directory Tree, Font Setup (`Geist`, `Geist_Mono`, `Inter`) & `cn()` Utility Created — *Completed at 2026-11-04 10:32:15 +06:00. Directory tree created, src/lib/utils.ts with cn() helper created, fonts and metadata configured in src/app/layout.tsx.*
- [x] **Step 4**: Canonical TypeScript Domain Contracts (`src/domain/types.ts`) & Zod Schemas (`src/domain/schemas.ts`) Implemented — *Completed at 2026-11-04 10:33:00 +06:00. Created canonical types and Zod validation schemas for ApplicantProfile, CommunityReport, and ReadinessRecord.*
- [x] **Step 5**: Deterministic Comparison, Deadline Delta, Applicability & Readiness Engine Implemented (`src/domain/`) — *Completed at 2026-11-04 10:34:30 +06:00. Implemented normaliseText, compareDeadlines, compareNoticeVersions with duplicate validation and deterministic impact classification, evaluateApplicability with null-safety, and calculateNoticeReadiness.*
- [x] **Step 6**: 4-Dossier Bangladesh Seed Dataset Implemented (`src/data/seed/notices.seed.ts`) — *Completed at 2026-11-04 10:36:10 +06:00. Built complete 4-dossier Bangladesh seed dataset (Merit Grant v1.0/v1.1/v2.0, Railway Refund, ICT Internship, e-Passport), DEFAULT_APPLICANT_PROFILE, and SEED_COMMUNITY_REPORTS.*
- [x] **Step 7**: SSR-Safe Dexie IndexedDB Wrapper (`src/data/persistence/db.ts`) & Zustand Store (`src/hooks/useNiyomStore.ts`) Implemented — *Completed at 2026-11-04 10:37:30 +06:00. Built SSR-safe Dexie storage layer and unified Zustand store with zero-flash seed boot, client hydration, toggle/reverify actions, and one-click demo scenario transitions.*
- [ x] **Step 8**: Next.js 15+ Async Route Placeholders & Vitest Unit Test Suite Created (`tests/domain/`)
- [x ] **Step 9**: Verification Gate Passed (`typecheck`, `test`, `build` = 0 errors) & Pushed to GitHub

## Verification Logs & Milestones
- **Step 0 Completed**: Workspace verified at `d:\NIYOM`. Specification confirmed and execution plan initialized.
- **Step 1 Completed**: Next.js app created and configured at root with name `niyom`. Installed runtime dependencies `zod`, `zustand`, `dexie`, `lucide-react`, `clsx`, `tailwind-merge` and dev dependencies `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `vite-tsconfig-paths`. Created `vitest.config.mts`.
- **Step 2 Completed**: Git identity locked to Shoumik Orgho <orghodutta@gmail.com>. Installed `.githooks/pre-commit` (identity validation), `.githooks/commit-msg` (AI co-author stripper), and `.githooks/pre-push` (author verification and push lock). Configured `core.hooksPath`.
- **Step 3 Completed**: Structured `src/app/`, `src/components/`, `src/domain/`, `src/data/`, `src/hooks/`, `src/lib/`, and `tests/domain/`. Added `src/lib/utils.ts` (`cn()`) and configured `Geist`, `Geist_Mono`, `Inter` fonts and metadata in `src/app/layout.tsx`.
- **Step 4 Completed**: Defined `src/domain/types.ts` with all 22 domain contracts (DossierCategory, Requirement, Notice, NoticeVersion, ApplicantProfile, ReadinessRecord, RequirementChange, ReadinessSummary, etc.) and `src/domain/schemas.ts` with Zod validation.
- **Step 5 Completed**: Pure TypeScript intelligence engines built under `src/domain/comparison` and `src/domain/readiness`. Covered text normalization, UTC deadline delta comparisons, duplicate ID checks, cosmetic change classification, applicability rules, stale check invalidation, and readiness percentage scoring.
- **Step 6 Completed**: Implemented 4 high-fidelity Bangladesh dossiers covering scholarship corrigendum, transport refund disputes with community corroborated reports, accelerated tech internship deadline/repo requirements, and e-passport student quota verification.
- **Step 7 Completed**: SSR-safe Dexie database layer with non-window defensive guards and Zustand store with scenario transition helpers (`loadScenarioV1Ready`, `simulateV2UpdateArrival`, `resetDemoData`).

---

## Phase C — Full-Stack MVP Backend Audit, Persistent Server Ledger & Live Store Sync
- **Date**: 2026-11-07
- **Scope**: End-to-end backend audit, server-side persistence ledger, Zod v4 schema hardening, bidirectional Zustand-to-API synchronization, interactive Live API Inspector, and automated backend test suite.

### Audit Findings & Upgrades Implemented
- [x] **Server-Side Persistence Engine** (`src/data/persistence/server-db.ts`): Replaced stateless read-only seed lookups with a durable server ledger (`.data/niyom-server-state.json` + in-memory cache fallback) storing applicant `profile`, `readinessRecords`, `communityReports`, `activeVersions`, and `demoScenarioStage`.
- [x] **Zod Runtime Schema Hardening** (`src/domain/schemas.ts`): Strengthened `applicantProfileSchema` (non-negative income bounds, string trimming, length caps), `communityReportInputSchema`, `communityReportSchema`, `communityReportCorroborateSchema`, `evaluateRequestSchema`, `compareQuerySchema`, `syncStatePatchSchema`, and `dossierVersionPatchSchema`.
- [x] **Complete Dynamic REST API Suite** (`src/app/api/`):
  - `GET /api/health`: Live server health, engine telemetry, and ledger record counts.
  - `GET /api/dossiers`: Dynamic dossier listing with live `activeVersionNumber`, conflict counts, and field report counts (`?category=` filter supported).
  - `GET & PATCH /api/dossiers/[id]`: Full versioned requirement ledger + live community reports; `PATCH` updates tracked active version on the server.
  - `GET /api/compare`: Deterministic version redline diff with Zod query validation.
  - `POST /api/evaluate`: Evaluates readiness against live server-stored `communityReports` and falls back to server-persisted `profile` and `readinessRecords` when omitted.
  - `GET, POST & PATCH /api/reports`: Lists, validates, stamps, persists, and corroborates (`+1`, auto-promoting to `corroborated_pattern` at `>= 3`) field reports.
  - `GET, PUT & DELETE /api/state`: Full bidirectional state synchronization and pre-computed readiness summaries across all 4 dossiers.
  - `GET /api/calendar/[id]`: RFC-5545 `.ics` deadline attachment generator.
- [x] **Live Frontend-to-Backend Synchronization** (`src/hooks/useNiyomStore.ts`, `DiscrepancyDrawer.tsx`, `ApiInspector.tsx`, `NoticeScreen.tsx`, `parts.tsx`):
  - `useNiyomStore` now synchronizes live with `/api/state` and `/api/reports` alongside local Dexie IndexedDB offline-first storage, tracking `backendStatus` (`online` | `connecting` | `offline`) and `lastSyncedAt`.
  - `DiscrepancyDrawer` preserves the exact server-stamped `CommunityReport` (`id`, `submittedAt`) returned by `POST /api/reports`.
  - Added `+1 I saw this too` corroboration button in `FieldReports` connected to `PATCH /api/reports`.
  - Upgraded `ApiInspector` modal with live connection status badge and 6 interactive tabs (`Evaluate`, `Compare`, `Server state`, `Field reports`, `Dossiers`, `System health`).
  - Guarded `getDb()` in `src/data/persistence/db.ts` with `typeof indexedDB !== "undefined"` for clean headless/jsdom execution.
- [x] **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm test`: 5 test files, 26/26 tests passing (including 8 new full-stack API & store integration tests in `tests/api/backend.test.ts`).
  - `npm run build`: Next.js 16.4.5 production build passed; all 8 `/api/*` endpoints verified as `ƒ (Dynamic)`.

## Phase C.1 — Backend audit and hardening (after the Antigravity MVP pass)
- **Date**: 2026-11-07
- **Audit**: `reviews/backend-audit.md` (10 findings; routes and schemas kept, data model rebuilt).
- [x] Per-device applicant state via anonymous HttpOnly device cookie; community reports public with hidden authorship.
- [x] Reset scoped to the caller; reports never wiped.
- [x] Corroboration: once per device, never own (403/409), pattern at 3 distinct devices; UI shows "You reported this" / "You confirmed this".
- [x] Record-level merge by `updatedAt` (`src/lib/records.ts`, shared by server and client); client sync queue sends only changes, one at a time, retried on reconnect; offline reports uploaded later.
- [x] Atomic ledger writes; corrupt files quarantined; dataset validation (422), body cap (413), rate limits (429); memory-only ledger in tests; `NIYOM_DATA_DIR` override.
- [x] Verified end to end over HTTP with two cookie jars (privacy, 403/200/409, reset scope, 422, on-disk format) and in the browser (confirm persists across reload).
- [x] Tests: 34/34 across 5 files.

## Phase C.2 — Backend finished for a live deployment
- **Date**: 2026-11-07
- **Audit**: `reviews/backend-audit.md`, second pass (findings 11–21).
- [x] Postgres store (`src/data/persistence/server-pg.ts`) behind one `LedgerStore` interface (`ledger-model.ts`). Selected by `DATABASE_URL`/`POSTGRES_URL`; JSON file otherwise; memory in tests. Writes are single statements the database enforces. The schema is created on first use and recreated if the database is replaced.
- [x] Every handler wrapped: JSON `503` + `Retry-After` on outage, JSON `500` on bugs, `X-Request-Id`, `Cache-Control: no-store`. Added a `GET /api` index and JSON 404s for unknown API paths. `/api/health` reports store and durability, and `503 degraded` when the store is unreachable.
- [x] Per-IP rate limits alongside per-device; bounded timestamps; `Secure` cookie behind https proxies; security headers on every route.
- [x] Client: retries with backoff or Retry-After on `429`, `5xx` and network failure. Re-syncs on reconnect and tab focus, one sync at a time. Offline reports are uploaded on the next sync and kept as yours. The drawer no longer re-POSTs straight after its own failed attempt.
- [x] Footer: the Credosis line is replaced by a live backup status and the sample-data disclaimer. The Live API dot reflects the real state.
- [x] `@types/node@^22` fixes the vitest peer conflict that broke clean installs; `.env.example` added.
- [x] Tests: 71/71 across 7 files: the API suite on memory and on Postgres (`pg` + PGlite), outage tests, and browser-to-server sync. Typecheck and build clean.
- [x] Verified on the production build:
  - two instances on one Postgres;
  - a database outage and recovery;
  - the UI walkthrough and cross-browser confirmation;
  - JSON-file mode.

## Phase D — Phones, tablets and notifications
- **Date**: 2026-11-07
- **Audit**: every screen at 360, 390 and 768px (sideways overflow, controls under 32px, text under 12px), plus every overlay at 390px.
- [x] Rail hidden below 640px (`--rail-w: 0`); phones get even 16px margins. Tablets and desktops are unchanged.
- [x] Sideways overflow on two Specification pages fixed: `grid-cols-1` on every grid that only gains columns at a breakpoint.
- [x] `.tap`: a 44px touch area on small controls under `pointer: coarse`. Rail ticks are spaced 34px apart on touch tablets.
- [x] The Live API description now spans the panel instead of a narrow column beside the buttons.
- [x] Notifications redesigned as Apple-style banners:
  - translucent material, app icon, system font, "now";
  - a spring drop-in;
  - swipe to dismiss, with spring-back;
  - an invisible timer that pauses on hover, focus or hold, and a close button on hover;
  - "You're offline" pinned; slots collapse smoothly.

  The `{ tone, title, body }` API and all 11 call sites are unchanged.
- [x] Fixed: with Reduce Motion on, notifications disappeared instantly (their timer was shortened to 1ms with all other animations).
- [x] Verified:
  - all screens at 360 and 390px have no sideways overflow;
  - swipe-up dismisses without scrolling the page, and a short drag springs back;
  - the offline and back-online banners work on phone and desktop;
  - typecheck, 71/71 tests and the build are clean.


## Phase E — Counter-day intelligence, shared physical folders, Three.js & Framer Motion videography
- **Date**: 2026-11-07
- [x] **Cross-Dossier Document Reuse ("Shared Physical Folder")**: `computeSharedFolderGroups` and `findCrossDossierLinksForRequirement` in `src/domain/readiness/intelligence.ts` link physical folder pockets across notices by institutional strictness (`Tier 1–3`).
- [x] **Office Lead-Time & Safe-Start Calendar**: `subtractWorkingDays` and `computePreparationTimeline` calculate Bangladesh Sun–Thu working-day lead times and the latest safe start date before each filing deadline.
- [x] **Personal Evidence Memo (`note`)**: Added `note?: string` to `ReadinessRecord`, persisted across IndexedDB, JSON/memory store, and Postgres (`niyom_records.note`), with live debounced auto-save in `Inspector.tsx` and a dedicated column on the printed Readiness Slip.
- [x] **Backend Route `GET /api/plan` & Live API Console**: Returns preparation timelines, shared folder reuse groups, and per-dossier readiness in one call; added interactive tab to `ApiInspector.tsx`.
- [x] **Three.js + Framer Motion + Videography Flow**:
  - `AmbientFlow.tsx` combines a procedural Three.js WebGL 3D archival coordinate mesh (`ThreeArchivalField`), Framer Motion spring-interpolated multi-plane videography (`/media/archive-engraving-loop.mp4`, `/media/editorial-ledger-reel.mp4`, `/media/archive-plate.jpg`), and scroll-velocity playback rate modulation.
  - `MotionGraph.tsx` provides an interactive 3-stage institutional counter graph and shared folder matrix with synchronized reel playback.
- [x] **20/20 UI/UX Engineering Patterns**: Added `useDebouncedValue.ts`, `ConfirmAction.tsx` (two-step destructive action protection), `LedgerDataTable.tsx` (sortable data table on `ExploreScreen` and `MyPlanScreen`), bulk checklist actions (`reverifyBulk`, `checkAllRequired`, `clearDossierChecks`), and civic referral/handoff link sharing.
- [x] **Verified**: `npm run typecheck` (0 errors), `npm run lint` (0 warnings), `npm test` (77/77 passing across 7 suites), and `npm run build` (25/25 routes).

## Phase E.1 — Planning features made honest; ambient background removed
- **Date**: 2026-11-07
- **Audit**:
  - Every file changed in Phase E, read in full.
  - Production build measured on phone and desktop: bytes, idle work and console.
  - Screenshots of every new surface at 1280 and 390px.
- [x] Removed (the files are kept outside the repo in case they are wanted back):
  - `AmbientFlow.tsx` (Three.js grid + two videos + poster);
  - `MotionGraph.tsx`;
  - `public/media/*`;
  - the `three`, `@types/three`, `framer-motion` and `motion` packages.
- [x] Home on a phone:
  - scripts went from 478 KB to 283 KB;
  - images and video went from ~1,040 KB to 0;
  - idle layouts and style recalculations went from 159 and 319 to 0 and 26.
- [x] `PrepSchedule.tsx` replaces the motion graph. It shows a start-by sentence, the visits in order and papers from the same place; Overview shows only the sentence.
- [x] Shared folder regrouped honestly: documents only, by issuing office, with no "satisfies" claims. The tier fields were removed from the domain and the API.
- [x] Timeline counts only papers and procedures. The fallback office no longer invents "Issuing Authority Desk, 1 day".
- [x] Memo presets carry no invented IDs; the memo saves on close.
- [x] Share link: no personal data in the URL, applied once, published versions only.
- [x] "Check all required" removed (with its store action); ConfirmAction and LedgerDataTable rewritten without Framer Motion.
- [x] Missing tokens `--hair`, `sunken` and `info` defined; table headers in sentence case; Help explains when to start; the palette pluralises results.
- [x] Typecheck, lint, 77/77 tests and the build are clean. Verified in the browser:
  - the memo is saved on close;
  - the share link opens the right dossier and version and does not snap back;
  - "Clear checks" needs two clicks;
  - the walkthrough reaches 57%;
  - no page is wider than the screen at 390px;
  - the console is clean.

## Phase F — Motion and brand finish
- **Date**: 2026-11-07
- [x] `CorrigendumScene.tsx` on Overview: the Merit Grant's v1.0 → v2.0 changes rewrite word by word as you scroll.
  - Readiness 100 → 83 → 71 → 57 is computed by the engine; the stamp lands at the end.
  - It listens only while on screen; an accessible list carries the same story; Reduce Motion shows the final state.
- [x] Drifting type: নিয়ম behind the hero and each chapter's version behind its band. Pure CSS scroll-driven animations.
- [x] New app icon: a forest notice sheet with a folded corner. The favicon uses a solid N (crisp at 16px); the Apple icon keeps the engraved N. The header lockup adds নিয়ম.
- [x] New footer: the promise, dossier links with live readiness, pages, tools, sync status, disclaimer and a large wordmark. It takes the chapter's cover colour.
- [x] Fixed: the planner read today's date during prerender (build error on `/_not-found`). Today is now an explicit input, known only after hydration on the client and passed by the API on the server.
- [x] Typecheck, lint, 77/77 tests and the build (25/25 routes) are clean.
- [x] Browser checks:
  - the memo, share link, clear and walkthrough flows pass;
  - home on a phone stays still while idle (0 layouts) at about 285 KB of script;
  - no page is wider than the screen at 390px, and the console is clean.

## Phase G — Motion polish, open books and visuals
- **Date**: 2026-11-07
- [x] Scene:
  - word-by-word strikes (a drawn line) and arrivals (a marker sweep);
  - progress eased towards the scroll;
  - clauses run as a teleprompter column, with no blank or overlapping frame (the most visible clause never drops below 45% opacity at a hand-over).
- [x] Notice objects open like books (`open="scroll"` in chapters, `open="view"` + `pinned` on dossier pages). The details page is ticked live from the store. `--open` is a registered CSS property, so it can transition.
- [x] Dossier page: wider sidebar, and nothing clips the 3D book.
- [x] Top bar tucks into a floating pill on scroll, at constant height.
- [x] Footer fits under the bar at the end of the page at 360, 390 and 1440px. The wordmark is set in a fixed-height band; the promise sentence is hidden on phones.
- [x] Visuals over numbers: `ReadinessRing` and `VersionTrack` (`src/components/ui/Visuals.tsx`) on the hero card, the chapters and Directory cards. Icons on the dossier facts.
- [x] Measured on the production build:
  - routes paint in 90–180 ms (the first, cold visit to `/` in about 1 s);
  - the slowness seen locally was `next dev` compiling each route on first visit.
- [x] Typecheck, lint, 77/77 tests and the build are clean. Flows pass, the home page stays still while idle, and no page is wider than the screen.

## Phase H — Old-film scene, papers instead of rings, timing and clipping fixes
- **Date**: 2026-11-07
- [x] Removed the white gap before the footer (a redundant top margin; normal pages already end with padding).
- [x] Hero and chapter bands no longer clip the paper stacks and books; only the big drifting type is clipped, in its own layer.
- [x] `PaperRow` (one sheet per required paper) replaces `ReadinessRing` on the hero card, chapters and Directory cards; the hero card keeps its serif figure.
- [x] Corrigendum scene as an old picture show. It runs full-bleed under the rail (cream ticks) and has:
  - a dark sepia screen;
  - sprockets moving with the scroll;
  - grain and flicker only while on screen;
  - a vignette and credits-style roll;
  - a title-card readiness figure that rolls on change.
- [x] Books open once seen (350 ms, then a 1.3 s spring) and stay open; fully open in about 1.2–1.6 s after arriving, starting at 15% visibility.
- [x] Liniqo MCP server registered for this project (`claude mcp add --transport http liniqo https://liniqo.com/mcp`); its tools load in the next session.
- [x] Typecheck, lint, 77/77 tests and the build are clean.
- [x] Browser checks:
  - the flows pass;
  - the home page stays still while idle;
  - no page is wider than the screen at 390 or 1440px;
  - the console is clean.

## Phase I — Riffling pages, a breathing rail, a taller footer
- **Date**: 2026-11-08
- [x] Notice objects open like a bundle of papers:
  - the cover swings over;
  - three pages riffle after it, 180 ms apart;
  - the last lands on top with the version page.
- [x] Fixed the 3D context so the riffled pages sort in depth. The sheet wrapper lacked `preserve-3d`, so the cover was painted over every page.
- [x] The passport opens on maroon endpapers onto a guilloche visa page.
- [x] Fixed an intermittent miss: books sometimes never opened after a fast smooth scroll.
  - The cause: the observer read the oldest of several batched entries.
  - The book observers and the film scene now act on the latest entry.
- [x] Books open at 40% visibility.
- [x] Rail rebuilt after the Stripe Press reference:
  - long lines that swell around the reading position and under the pointer;
  - the section name shown in bold serif beside its line;
  - light ink over the dark footer.
- [x] Footer has more vertical room on tablets and desktops (top padding, gaps, the status row and the wordmark). It still clears the top bar at the end of the page: footer top at 177 px on a 900 px desktop screen, 93 px on a phone.
- [x] The page shell clips sideways overflow with `overflow-x: clip`. The open book's shifted wrapper no longer makes phones scroll sideways, and full-bleed bands still reach under the rail.
- [x] Typecheck, lint, 77/77 tests and the build are clean.
- [x] Browser checks at 360, 390 and 1440 px:
  - every book opens in about 1.3 s, 9 of 9 repeated runs;
  - no sideways scroll;
  - no gap before the footer;
  - the flows pass;
  - the page is still while idle (0 layouts);
  - the console is clean.

## Phase J — Printed pages, plain version names, footer, report form
- **Date**: 2026-11-08
- [x] Books:
  - pages that turn carry the notice's clauses;
  - pages land flat, with the depth offset inside the turn, so no gap at the spine;
  - the spread faces the reader square-on;
  - page edges, a gutter shade and a ground shadow;
  - other versions fade as the book opens.
- [x] Versions are named *Original*, *Update 1*, *Update 2* across the interface (`versionTag`, `versionPhrase`); the API keeps official labels.
- [x] Footer:
  - at least one screen tall, so no band shows behind the floating bar at the end of a page;
  - the headline clears the bar: 144 px on a 900 px desktop screen, 84 px on a 390 px phone;
  - underlines draw in from the left;
  - the next closing date (with a calendar file) replaces the sync line;
  - room below the wordmark.
- [x] Overview: a sticky "your folder" card fills the column beside the next steps.
- [x] Report form:
  - custom listboxes for dossier and requirement, keyboard and Escape handled;
  - report kinds as icon cards;
  - a character count;
  - thin scrollbars everywhere.
- [x] Rail labels are smaller (12 px) and always shown in full; the film scene's label is "The corrigendum".
- [x] The corrigendum stamp is larger, with a double rule.
- [x] The engraved version name in chapters is smaller and sits inside the band.
- [x] Every page has an engraved word that drifts with the scroll.
- [x] Opening a specification no longer scrolls up visibly from the footer (`data-scroll-behavior="smooth"`, Next 16).
- [x] Typecheck, lint, 77/77 tests and the build are clean.
- [x] Browser checks at 360, 390, 768 and 1440 px:
  - the flows pass;
  - books open every time;
  - no sideways scroll;
  - the page is still while idle (0 layouts);
  - the console is clean.
