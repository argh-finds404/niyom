import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { Pool } from "pg";
import type { CommunityReport, Notice } from "@/domain/types";
import type { CommunityReportInput, SyncStatePatchInput } from "@/domain/schemas";
import { SEED_COMMUNITY_REPORTS, SEED_NOTICES } from "@/data/seed/notices.seed";
import { mergeRecords } from "@/lib/records";
import { createPostgresStore } from "./server-pg";
import {
  REPORT_LIST_LIMIT,
  defaultDeviceState,
  iso,
  readProfile,
  statusFor,
  type CorroborateResult,
  type DeviceState,
  type LedgerStore,
  type ReportFilters,
  type ReportView,
} from "./ledger-model";

export { CORROBORATION_THRESHOLD, StoreUnavailableError } from "./ledger-model";
export type { CorroborateResult, DeviceState, LedgerStore, ReportView, ScenarioStage } from "./ledger-model";

/*
 * Server ledger: the one entry point the API uses.
 *
 * Where data lives is chosen at start-up. It is a real Postgres database in every case but one:
 * - DATABASE_URL (or POSTGRES_URL) set: that Postgres (e.g. Neon). Durable and safe with many server instances.
 * - Otherwise, on a machine with a disk (`npm run dev`, `npm start`): an embedded Postgres (PGlite) in
 *   NIYOM_DATA_DIR/pglite (default `.data/pglite`), spoken to through the same `pg` driver and SQL as production.
 * - Serverless without a database, the production build, or NIYOM_STORE=file: one JSON file in NIYOM_DATA_DIR,
 *   or memory on a read-only disk (/api/health says so). Also the fallback if the embedded database cannot start.
 * - Under tests: memory (and a separate suite runs the Postgres store against PGlite).
 */

const IN_TEST = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";

/* ───────────── JSON-file / memory store ───────────── */

interface ReportMeta {
  author: string | null;
  corroborators: string[];
  /** The count the report carried before any device on this server confirmed it (seed data). */
  baseCount: number;
}

interface Ledger {
  schemaVersion: 2;
  devices: Record<string, DeviceState>;
  communityReports: CommunityReport[];
  reportMeta: Record<string, ReportMeta>;
  updatedAt: string;
}

const MAX_DEVICES = 10_000;
const MAX_REPORTS = 5_000;

function seedLedger(): Ledger {
  return {
    schemaVersion: 2,
    devices: {},
    communityReports: SEED_COMMUNITY_REPORTS.map((r) => ({ ...r })),
    reportMeta: Object.fromEntries(SEED_COMMUNITY_REPORTS.map((r) => [r.id, { author: null, corroborators: [], baseCount: r.corroborationCount }])),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * shortcut: one JSON file on one Node process (every operation is synchronous, so none interleave).
 * Fine for a single server with a disk; set DATABASE_URL for anything else.
 */
export function createFileStore(options: { dir?: string; memoryOnly?: boolean } = {}): LedgerStore {
  const dir = options.dir ?? (process.env.NIYOM_DATA_DIR || path.join(process.cwd(), ".data")); // empty means unset
  const file = path.join(dir, "niyom-server-state.json");
  let writable = !options.memoryOnly;
  let ledger: Ledger | null = null;

  function readFromDisk(): Ledger | null {
    if (!writable || !fs.existsSync(file)) return null;
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<Ledger>;
      const base = seedLedger();
      const reports = Array.isArray(parsed.communityReports) ? parsed.communityReports : [];
      const known = new Set(reports.map((r) => r.id));
      const communityReports = [...reports, ...base.communityReports.filter((r) => !known.has(r.id))];
      const reportMeta: Record<string, ReportMeta> = { ...base.reportMeta, ...(parsed.reportMeta ?? {}) };
      for (const r of communityReports) reportMeta[r.id] ??= { author: null, corroborators: [], baseCount: r.corroborationCount };
      return {
        schemaVersion: 2,
        // A v1 file held one global profile that cannot be attributed to anyone, so it is dropped.
        devices: parsed.schemaVersion === 2 && parsed.devices ? parsed.devices : {},
        communityReports,
        reportMeta,
        updatedAt: parsed.updatedAt ?? base.updatedAt,
      };
    } catch (error) {
      // Never silently overwrite data we could not read: set the file aside and start clean.
      const aside = `${file}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(file, aside);
      } catch {}
      console.error(`[niyom] Could not parse ${file}; moved it to ${aside}.`, error);
      return null;
    }
  }

  function writeToDisk(next: Ledger): void {
    if (!writable) return;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next), "utf8");
      fs.renameSync(tmp, file); // atomic on the same filesystem
    } catch (error) {
      writable = false; // read-only or ephemeral disk: keep serving from memory, and say so in /api/health
      console.warn("[niyom] The ledger cannot be written to disk and is now in memory only. Set DATABASE_URL.", (error as Error).message);
    }
  }

  const load = (): Ledger => (ledger ??= readFromDisk() ?? seedLedger());

  function commit(next: Ledger): void {
    next.updatedAt = new Date().toISOString();
    ledger = next;
    writeToDisk(next);
  }

  function view(r: CommunityReport, deviceId: string | null): ReportView {
    const meta = load().reportMeta[r.id];
    return {
      ...r,
      yours: Boolean(deviceId) && meta?.author === deviceId,
      confirmedByYou: Boolean(deviceId) && Boolean(meta?.corroborators.includes(deviceId!)),
    };
  }

  return {
    get kind() {
      return writable ? "json-file" : "memory";
    },
    get durable() {
      return writable;
    },

    async getDevice(id) {
      const d = load().devices[id];
      return d ? { ...d, profile: readProfile(d.profile) } : null;
    },

    async saveDevice(id, patch) {
      const l = load();
      const current = l.devices[id] ?? defaultDeviceState();
      const next: DeviceState = {
        profile: patch.profile ?? current.profile,
        readinessRecords: patch.readinessRecords
          ? mergeRecords(current.readinessRecords, patch.readinessRecords.map((r) => ({ ...r, updatedAt: iso(r.updatedAt) })))
          : current.readinessRecords,
        activeVersions: { ...current.activeVersions, ...(patch.activeVersions ?? {}) },
        demoScenarioStage: patch.demoScenarioStage ?? current.demoScenarioStage,
        updatedAt: new Date().toISOString(),
      };
      const devices = { ...l.devices, [id]: next };
      // Bound the file: forget the least recently active devices.
      const ids = Object.keys(devices);
      if (ids.length > MAX_DEVICES) {
        ids
          .sort((a, b) => Date.parse(devices[a].updatedAt) - Date.parse(devices[b].updatedAt))
          .slice(0, ids.length - MAX_DEVICES)
          .forEach((x) => delete devices[x]);
      }
      commit({ ...l, devices });
    },

    async deleteDevice(id) {
      const l = load();
      if (!l.devices[id]) return;
      const devices = { ...l.devices };
      delete devices[id];
      commit({ ...l, devices });
    },

    async listReports(deviceId, f: ReportFilters = {}) {
      return load()
        .communityReports.filter(
          (r) =>
            (!f.noticeId || r.noticeId === f.noticeId) && (!f.requirementId || r.requirementId === f.requirementId) && (!f.id || r.id === f.id)
        )
        .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || a.id.localeCompare(b.id))
        .slice(0, REPORT_LIST_LIMIT)
        .map((r) => view(r, deviceId));
    },

    async insertReport(report, author) {
      const l = load();
      commit({
        ...l,
        communityReports: [report, ...l.communityReports].slice(0, MAX_REPORTS),
        reportMeta: { ...l.reportMeta, [report.id]: { author, corroborators: [], baseCount: report.corroborationCount } },
      });
    },

    async confirmReport(reportId, deviceId): Promise<CorroborateResult> {
      const l = load();
      const idx = l.communityReports.findIndex((r) => r.id === reportId);
      if (idx < 0) return { status: "missing" };
      const target = l.communityReports[idx];
      const meta = l.reportMeta[reportId] ?? { author: null, corroborators: [], baseCount: target.corroborationCount };
      if (meta.author === deviceId) return { status: "own", report: view(target, deviceId) };
      if (meta.corroborators.includes(deviceId)) return { status: "duplicate", report: view(target, deviceId) };

      const corroborators = [...meta.corroborators, deviceId];
      const count = meta.baseCount + corroborators.length;
      const updated: CommunityReport = { ...target, corroborationCount: count, verificationStatus: statusFor(target.verificationStatus, count) };
      const communityReports = [...l.communityReports];
      communityReports[idx] = updated;
      commit({ ...l, communityReports, reportMeta: { ...l.reportMeta, [reportId]: { ...meta, corroborators } } });
      return { status: "ok", report: view(updated, deviceId) };
    },

    async stats() {
      const l = load();
      return {
        devices: Object.keys(l.devices).length,
        communityReports: l.communityReports.length,
        corroboratedReports: l.communityReports.filter((r) => r.verificationStatus === "corroborated_pattern").length,
      };
    },

    async reset() {
      ledger = seedLedger();
    },
  };
}

/* ───────────── Embedded Postgres ───────────── */

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

/**
 * Postgres compiled to WebAssembly (PGlite), kept on this machine's disk and served on a local port,
 * so the production driver and SQL run unchanged. One instance per process, also across dev reloads.
 * If it cannot start, the ledger falls back to the JSON file and says so in the log.
 */
function createEmbeddedStore(dir: string): LedgerStore {
  const g = globalThis as typeof globalThis & { __niyomEmbedded?: Promise<LedgerStore> };
  g.__niyomEmbedded ??= (async () => {
    try {
      const { PGlite } = await import("@electric-sql/pglite");
      const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
      fs.mkdirSync(dir, { recursive: true });
      // One process per data folder: a second server (say `next dev` beside `next start`) must not open the same files.
      const lock = path.join(dir, "pglite.lock");
      try {
        const owner = Number(fs.readFileSync(lock, "utf8"));
        if (owner && owner !== process.pid) {
          process.kill(owner, 0); // throws ESRCH when that process is gone
          throw new Error(`the database in ${dir} is open in process ${owner}`);
        }
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ESRCH") throw e;
      }
      fs.writeFileSync(lock, String(process.pid));
      process.once("exit", () => {
        try {
          if (fs.readFileSync(lock, "utf8") === String(process.pid)) fs.unlinkSync(lock);
        } catch {
          // already gone
        }
      });
      const db = await PGlite.create(path.join(dir, "pglite"));
      const port = await freePort();
      const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 8 });
      await server.start();
      const pool = new Pool({ host: "127.0.0.1", port, user: "postgres", database: "postgres", max: 4 });
      pool.on("error", (e) => console.error("[niyom] Embedded Postgres connection error:", e.message));
      return createPostgresStore(pool);
    } catch (error) {
      console.warn("[niyom] The embedded Postgres could not start; using the JSON file store.", (error as Error).message);
      return createFileStore({ dir });
    }
  })();
  const ready = g.__niyomEmbedded;
  let resolved: LedgerStore | null = null;
  // Set here, not inside the start-up promise: after a dev reload this module is new but the database is not.
  void ready.then((s) => {
    resolved = s;
    engine = s.kind === "postgres" ? "postgres (embedded PGlite)" : "json-file (embedded Postgres unavailable)";
  });
  const via =
    <K extends Exclude<keyof LedgerStore, "kind" | "durable">>(k: K) =>
    (async (...args: unknown[]) => ((await ready)[k] as (...a: unknown[]) => unknown)(...args)) as LedgerStore[K];
  return {
    get kind() {
      return resolved?.kind ?? "postgres";
    },
    get durable() {
      return resolved?.durable ?? true;
    },
    getDevice: via("getDevice"),
    saveDevice: via("saveDevice"),
    deleteDevice: via("deleteDevice"),
    listReports: via("listReports"),
    insertReport: via("insertReport"),
    confirmReport: via("confirmReport"),
    stats: via("stats"),
    reset: via("reset"),
  };
}

/* ───────────── Choosing the store ───────────── */

let active: LedgerStore | null = null;
/** Which database answers, in words, for /api/health. */
let engine = "";

function store(): LedgerStore {
  if (active) return active;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url && !IN_TEST) {
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.NIYOM_PG_POOL_MAX) || 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
    });
    // An idle client dropped by the server must not crash the process.
    pool.on("error", (e) => console.error("[niyom] Postgres connection error:", e.message));
    active = createPostgresStore(pool);
    engine = "postgres (DATABASE_URL)";
  } else if (!IN_TEST && !process.env.VERCEL && process.env.NEXT_PHASE !== "phase-production-build" && process.env.NIYOM_STORE !== "file") {
    active = createEmbeddedStore(process.env.NIYOM_DATA_DIR || path.join(process.cwd(), ".data"));
    engine ||= "postgres (embedded PGlite, starting)";
  } else {
    active = createFileStore({ memoryOnly: IN_TEST });
    engine = IN_TEST ? "memory (tests)" : "json-file";
    if (!IN_TEST && process.env.VERCEL) {
      console.warn("[niyom] No DATABASE_URL on a serverless host: data is not shared between instances and is lost on restart.");
    }
  }
  return active;
}

/* ───────────── Dataset checks (pure) ───────────── */

export function findSeedNotice(id: string): Notice | null {
  return SEED_NOTICES.find((n) => n.id === id) ?? null;
}

/** Every dossier, with the versions a device follows applied. */
export function noticesFor(activeVersions: Record<string, number>): Notice[] {
  return SEED_NOTICES.map((n) => ({ ...n, activeVersionNumber: activeVersions[n.id] ?? n.activeVersionNumber }));
}

/** Returns problems with ids and versions the client sent; empty when everything refers to real data. */
export function validateAgainstDataset(patch: Pick<SyncStatePatchInput, "readinessRecords" | "activeVersions">): string[] {
  const problems: string[] = [];
  for (const [noticeId, v] of Object.entries(patch.activeVersions ?? {})) {
    const n = findSeedNotice(noticeId);
    if (!n) problems.push(`activeVersions: unknown dossier "${noticeId}"`);
    else if (!n.versions.some((x) => x.versionNumber === v)) problems.push(`activeVersions.${noticeId}: version ${v} was never published`);
  }
  for (const [i, r] of (patch.readinessRecords ?? []).entries()) {
    const n = findSeedNotice(r.noticeId);
    if (!n) problems.push(`readinessRecords.${i}: unknown dossier "${r.noticeId}"`);
    else if (!n.versions.some((v) => v.requirements.some((q) => q.id === r.requirementId)))
      problems.push(`readinessRecords.${i}: "${r.requirementId}" is not a requirement of ${r.noticeId}`);
    else if (!n.versions.some((v) => v.versionNumber === r.verifiedAgainstVersion))
      problems.push(`readinessRecords.${i}: version ${r.verifiedAgainstVersion} was never published`);
  }
  return problems;
}

/* ───────────── Applicant state (private, per device) ───────────── */

export async function getDeviceState(deviceId: string): Promise<DeviceState> {
  return (await store().getDevice(deviceId)) ?? defaultDeviceState();
}

export async function updateDeviceState(deviceId: string, patch: SyncStatePatchInput): Promise<void> {
  await store().saveDevice(deviceId, patch);
}

/** Clears this device's applicant state only. Community reports are untouched. */
export async function resetDeviceState(deviceId: string): Promise<void> {
  await store().deleteDevice(deviceId);
}

/** A dossier with the version this device follows (or the published default when no device is given). */
export async function getNoticeFor(id: string, deviceId?: string): Promise<Notice | null> {
  if (!findSeedNotice(id)) return null;
  const versions = deviceId ? (await getDeviceState(deviceId)).activeVersions : {};
  return noticesFor(versions).find((n) => n.id === id) ?? null;
}

/* ───────────── Community reports (public) ───────────── */

export function getReports(deviceId: string | null, filters?: ReportFilters): Promise<ReportView[]> {
  return store().listReports(deviceId, filters);
}

export async function addReport(input: CommunityReportInput, deviceId: string): Promise<ReportView> {
  const report: CommunityReport = {
    noticeId: input.noticeId,
    requirementId: input.requirementId,
    reportType: input.reportType,
    observation: input.observation,
    evidenceUrlOrRef: input.evidenceUrlOrRef,
    id: `rep-${crypto.randomUUID()}`,
    submittedAt: new Date().toISOString(),
    verificationStatus: "pending_verification",
    corroborationCount: 1,
  };
  await store().insertReport(report, deviceId);
  return { ...report, yours: true, confirmedByYou: false };
}

/** One confirmation per device, never on your own report. Corroborated once enough independent devices agree. */
export function corroborateReport(reportId: string, deviceId: string): Promise<CorroborateResult> {
  return store().confirmReport(reportId, deviceId);
}

/* ───────────── Health ───────────── */

/** Store kind, durability and counts. Throws StoreUnavailableError when the store cannot be reached. */
export async function ledgerHealth() {
  const s = store();
  const started = Date.now();
  const stats = await s.stats();
  return { persistence: s.kind, database: engine, durable: s.durable, ...stats, latencyMs: Date.now() - started };
}

export function ledgerKind() {
  return store().kind;
}

/* ───────────── Test hooks (never exposed over HTTP) ───────────── */

export function __useStoreForTests(next: LedgerStore): void {
  active = next;
}

export async function __resetLedgerForTests(): Promise<void> {
  await store().reset();
}
