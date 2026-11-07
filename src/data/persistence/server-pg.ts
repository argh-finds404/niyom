import type { Pool } from "pg";
import type { CommunityReport, ReadinessRecord } from "@/domain/types";
import { SEED_COMMUNITY_REPORTS } from "@/data/seed/notices.seed";
import { mergeRecords } from "@/lib/records";
import {
  CORROBORATION_THRESHOLD,
  REPORT_LIST_LIMIT,
  StoreUnavailableError,
  iso,
  readProfile,
  seedActiveVersions,
  statusFor,
  type DeviceState,
  type LedgerStore,
  type ReportFilters,
  type ReportView,
  type ScenarioStage,
} from "./ledger-model";

/*
 * Postgres ledger, used when DATABASE_URL (or POSTGRES_URL) is set.
 *
 * Every write is a single statement whose correctness the database enforces, so any number of
 * server instances can run at once:
 * - checks upsert with `WHERE excluded.updated_at >= current`, so an older write never wins;
 * - followed versions merge with jsonb `||`;
 * - a confirmation is a row keyed (report, device), so "once per device" holds under races.
 * Tables are created on first use; the statements are idempotent.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS niyom_devices (
  id uuid PRIMARY KEY,
  profile jsonb,
  active_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage text NOT NULL DEFAULT 'custom',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS niyom_records (
  device_id uuid NOT NULL REFERENCES niyom_devices(id) ON DELETE CASCADE,
  notice_id text NOT NULL,
  requirement_id text NOT NULL,
  checked boolean NOT NULL,
  verified_value text NOT NULL,
  verified_version integer NOT NULL,
  note text,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (device_id, notice_id, requirement_id)
);
ALTER TABLE niyom_records ADD COLUMN IF NOT EXISTS note text;
CREATE TABLE IF NOT EXISTS niyom_reports (
  id text PRIMARY KEY,
  notice_id text NOT NULL,
  requirement_id text,
  report_type text NOT NULL,
  observation text NOT NULL,
  evidence text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  base_status text NOT NULL DEFAULT 'pending_verification',
  base_count integer NOT NULL DEFAULT 1,
  author uuid
);
CREATE INDEX IF NOT EXISTS niyom_reports_notice_idx ON niyom_reports (notice_id, submitted_at DESC);
CREATE TABLE IF NOT EXISTS niyom_confirmations (
  report_id text NOT NULL REFERENCES niyom_reports(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, device_id)
);`;

const SEED_REPORTS = `
INSERT INTO niyom_reports (id, notice_id, requirement_id, report_type, observation, evidence, submitted_at, base_status, base_count)
SELECT s.id, s."noticeId", s."requirementId", s."reportType", s.observation, s."evidenceUrlOrRef", s."submittedAt", s."verificationStatus", s."corroborationCount"
FROM jsonb_to_recordset($1::text::jsonb) AS s(
  id text, "noticeId" text, "requirementId" text, "reportType" text, observation text,
  "evidenceUrlOrRef" text, "submittedAt" timestamptz, "verificationStatus" text, "corroborationCount" integer)
ON CONFLICT (id) DO NOTHING`;

const LIST_REPORTS = `
SELECT r.id, r.notice_id, r.requirement_id, r.report_type, r.observation, r.evidence, r.submitted_at, r.base_status,
       (r.base_count + count(c.device_id))::int AS count,
       COALESCE(r.author = $1::uuid, false) AS yours,
       COALESCE(bool_or(c.device_id = $1::uuid), false) AS confirmed_by_you
FROM niyom_reports r
LEFT JOIN niyom_confirmations c ON c.report_id = r.id
WHERE ($2::text IS NULL OR r.notice_id = $2::text)
  AND ($3::text IS NULL OR r.requirement_id = $3::text)
  AND ($4::text IS NULL OR r.id = $4::text)
GROUP BY r.id
ORDER BY r.submitted_at DESC, r.id
LIMIT ${REPORT_LIST_LIMIT}`;

interface ReportRow {
  id: string;
  notice_id: string;
  requirement_id: string | null;
  report_type: CommunityReport["reportType"];
  observation: string;
  evidence: string;
  submitted_at: Date | string;
  base_status: CommunityReport["verificationStatus"];
  count: number;
  yours: boolean;
  confirmed_by_you: boolean;
}

function toView(row: ReportRow): ReportView {
  const count = Number(row.count);
  return {
    id: row.id,
    noticeId: row.notice_id,
    ...(row.requirement_id ? { requirementId: row.requirement_id } : {}),
    reportType: row.report_type,
    observation: row.observation,
    evidenceUrlOrRef: row.evidence,
    submittedAt: iso(row.submitted_at),
    verificationStatus: statusFor(row.base_status, count),
    corroborationCount: count,
    yours: row.yours,
    confirmedByYou: row.confirmed_by_you,
  };
}

/** Postgres ignores concurrent "IF NOT EXISTS" races badly; these codes mean another instance won. */
const isDdlRace = (e: unknown) => ["23505", "42P07", "42710"].includes((e as { code?: string }).code ?? "");

export function createPostgresStore(db: Pick<Pool, "query">): LedgerStore {
  let ready: Promise<void> | null = null;

  function ensureReady(): Promise<void> {
    ready ??= (async () => {
      try {
        await db.query(SCHEMA);
      } catch (e) {
        if (!isDdlRace(e)) throw e;
        await db.query(SCHEMA);
      }
      await db.query(SEED_REPORTS, [JSON.stringify(SEED_COMMUNITY_REPORTS)]);
    })().catch((e) => {
      ready = null; // try again on the next request
      throw e;
    });
    return ready;
  }

  /** Every operation: make sure the schema exists, and turn driver failures into a 503. */
  async function run<T>(op: () => Promise<T>): Promise<T> {
    try {
      await ensureReady();
      return await op();
    } catch (e) {
      if ((e as { code?: string }).code === "42P01") ready = null; // tables gone (database restored or replaced): recreate next time
      throw e instanceof StoreUnavailableError ? e : new StoreUnavailableError(e);
    }
  }

  const listReports = (deviceId: string | null, f: ReportFilters = {}) =>
    run(async () => {
      const { rows } = await db.query<ReportRow>(LIST_REPORTS, [deviceId, f.noticeId ?? null, f.requirementId ?? null, f.id ?? null]);
      return rows.map(toView);
    });

  return {
    kind: "postgres",
    durable: true,

    getDevice: (id) =>
      run(async () => {
        const [device, records] = await Promise.all([
          db.query(`SELECT profile, active_versions, stage, updated_at FROM niyom_devices WHERE id = $1::uuid`, [id]),
          db.query(
            `SELECT notice_id, requirement_id, checked, verified_value, verified_version, note, updated_at
             FROM niyom_records WHERE device_id = $1::uuid ORDER BY notice_id, requirement_id`,
            [id]
          ),
        ]);
        const row = device.rows[0];
        if (!row) return null;
        const state: DeviceState = {
          profile: readProfile(row.profile),
          readinessRecords: records.rows.map(
            (r): ReadinessRecord => ({
              noticeId: r.notice_id,
              requirementId: r.requirement_id,
              checked: r.checked,
              verifiedAgainstValue: r.verified_value,
              verifiedAgainstVersion: Number(r.verified_version),
              ...(r.note ? { note: r.note } : {}),
              updatedAt: iso(r.updated_at),
            })
          ),
          activeVersions: { ...seedActiveVersions(), ...(row.active_versions as Record<string, number>) },
          demoScenarioStage: row.stage as ScenarioStage,
          updatedAt: iso(row.updated_at),
        };
        return state;
      }),

    saveDevice: (id, patch) =>
      run(async () => {
        await db.query(
          `INSERT INTO niyom_devices (id, profile, active_versions, stage)
           VALUES ($1::uuid, $2::text::jsonb, COALESCE($3::text::jsonb, '{}'::jsonb), COALESCE($4::text, 'custom'))
           ON CONFLICT (id) DO UPDATE SET
             profile = COALESCE(EXCLUDED.profile, niyom_devices.profile),
             active_versions = niyom_devices.active_versions || EXCLUDED.active_versions,
             stage = COALESCE($4::text, niyom_devices.stage),
             updated_at = now()`,
          [
            id,
            patch.profile ? JSON.stringify(patch.profile) : null,
            patch.activeVersions ? JSON.stringify(patch.activeVersions) : null,
            patch.demoScenarioStage ?? null,
          ]
        );
        if (!patch.readinessRecords?.length) return;
        // One row per requirement (the newest), or Postgres refuses to update a row twice in one statement.
        const records = mergeRecords([], patch.readinessRecords).map((r) => ({ ...r, updatedAt: iso(r.updatedAt) }));
        await db.query(
          `INSERT INTO niyom_records (device_id, notice_id, requirement_id, checked, verified_value, verified_version, note, updated_at)
           SELECT $1::uuid, r."noticeId", r."requirementId", r.checked, r."verifiedAgainstValue", r."verifiedAgainstVersion", r.note, r."updatedAt"
           FROM jsonb_to_recordset($2::text::jsonb) AS r(
             "noticeId" text, "requirementId" text, checked boolean, "verifiedAgainstValue" text,
             "verifiedAgainstVersion" integer, note text, "updatedAt" timestamptz)
           ON CONFLICT (device_id, notice_id, requirement_id) DO UPDATE SET
             checked = EXCLUDED.checked,
             verified_value = EXCLUDED.verified_value,
             verified_version = EXCLUDED.verified_version,
             note = EXCLUDED.note,
             updated_at = EXCLUDED.updated_at
           WHERE EXCLUDED.updated_at >= niyom_records.updated_at`,
          [id, JSON.stringify(records)]
        );
      }),

    deleteDevice: (id) =>
      run(async () => {
        await db.query(`DELETE FROM niyom_devices WHERE id = $1::uuid`, [id]); // checks cascade
      }),

    listReports,

    insertReport: (report, author) =>
      run(async () => {
        await db.query(
          `INSERT INTO niyom_reports (id, notice_id, requirement_id, report_type, observation, evidence, submitted_at, base_status, base_count, author)
           VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10::uuid)`,
          [
            report.id,
            report.noticeId,
            report.requirementId ?? null,
            report.reportType,
            report.observation,
            report.evidenceUrlOrRef,
            report.submittedAt,
            report.verificationStatus,
            report.corroborationCount,
            author,
          ]
        );
      }),

    confirmReport: (reportId, deviceId) =>
      run(async () => {
        const found = await db.query<{ author: string | null }>(`SELECT author FROM niyom_reports WHERE id = $1`, [reportId]);
        if (!found.rows.length) return { status: "missing" as const };
        const one = async () => (await listReports(deviceId, { id: reportId }))[0];
        if (found.rows[0].author === deviceId) return { status: "own" as const, report: await one() };
        const inserted = await db.query(
          `INSERT INTO niyom_confirmations (report_id, device_id) VALUES ($1, $2::uuid)
           ON CONFLICT (report_id, device_id) DO NOTHING RETURNING report_id`,
          [reportId, deviceId]
        );
        return { status: inserted.rows.length ? ("ok" as const) : ("duplicate" as const), report: await one() };
      }),

    stats: () =>
      run(async () => {
        const { rows } = await db.query<{ devices: number; reports: number; corroborated: number }>(
          `SELECT (SELECT count(*) FROM niyom_devices)::int AS devices,
                  (SELECT count(*) FROM niyom_reports)::int AS reports,
                  (SELECT count(*) FROM (
                     SELECT r.id FROM niyom_reports r LEFT JOIN niyom_confirmations c ON c.report_id = r.id
                     GROUP BY r.id
                     HAVING r.base_status = 'corroborated_pattern' OR r.base_count + count(c.device_id) >= $1
                   ) corroborated)::int AS corroborated`,
          [CORROBORATION_THRESHOLD]
        );
        const s = rows[0];
        return { devices: Number(s.devices), communityReports: Number(s.reports), corroboratedReports: Number(s.corroborated) };
      }),

    reset: () =>
      run(async () => {
        await db.query(`TRUNCATE niyom_confirmations, niyom_records, niyom_reports, niyom_devices`);
        ready = null; // re-seeds on the next call
        await ensureReady();
      }),
  };
}
