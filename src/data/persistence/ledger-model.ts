import type { ApplicantProfile, CommunityReport, ReadinessRecord } from "@/domain/types";
import type { SyncStatePatchInput } from "@/domain/schemas";
import { applicantProfileSchema } from "@/domain/schemas";
import { DEFAULT_APPLICANT_PROFILE, SEED_NOTICES } from "@/data/seed/notices.seed";

/*
 * The server ledger's data model, shared by every backing store.
 *
 * - Applicant state (profile, checks, followed versions) is private to one anonymous device.
 * - Community field reports are public; who filed or confirmed one is never exposed.
 *   Each device confirms a report at most once and never its own, so "corroborated" means
 *   independent devices agree.
 */

export const CORROBORATION_THRESHOLD = 3;
/** The most reports any listing returns, newest first. */
export const REPORT_LIST_LIMIT = 1000;

export type ScenarioStage = "v1_ready" | "v2_updated" | "custom";

export interface DeviceState {
  profile: ApplicantProfile;
  readinessRecords: ReadinessRecord[];
  activeVersions: Record<string, number>;
  demoScenarioStage: ScenarioStage;
  updatedAt: string;
}

/** A public report, flagged relative to the device asking. */
export interface ReportView extends CommunityReport {
  yours: boolean;
  confirmedByYou: boolean;
}

export interface ReportFilters {
  noticeId?: string | null;
  requirementId?: string | null;
  id?: string | null;
}

export type CorroborateResult =
  | { status: "ok" | "own" | "duplicate"; report: ReportView }
  | { status: "missing" };

export interface LedgerStats {
  devices: number;
  communityReports: number;
  corroboratedReports: number;
}

/** What every backing store implements. Both stores run the same API test suite. */
export interface LedgerStore {
  readonly kind: "postgres" | "json-file" | "memory";
  /** False when data would be lost on restart. */
  readonly durable: boolean;
  getDevice(id: string): Promise<DeviceState | null>;
  /** Merges a patch: checks by `updatedAt` (newer wins), versions by dossier, profile and stage replaced. */
  saveDevice(id: string, patch: SyncStatePatchInput): Promise<void>;
  deleteDevice(id: string): Promise<void>;
  listReports(deviceId: string | null, filters?: ReportFilters): Promise<ReportView[]>;
  insertReport(report: CommunityReport, authorDeviceId: string): Promise<void>;
  confirmReport(reportId: string, deviceId: string): Promise<CorroborateResult>;
  stats(): Promise<LedgerStats>;
  /** Tests only: back to the seed. Never reachable over HTTP. */
  reset(): Promise<void>;
}

/** Thrown when the backing store cannot be reached; the API answers 503 and clients retry. */
export class StoreUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The ledger store is unavailable.", { cause });
    this.name = "StoreUnavailableError";
  }
}

export function seedActiveVersions(): Record<string, number> {
  return Object.fromEntries(SEED_NOTICES.map((n) => [n.id, n.activeVersionNumber]));
}

export function defaultDeviceState(): DeviceState {
  return {
    profile: { ...DEFAULT_APPLICANT_PROFILE },
    readinessRecords: [],
    activeVersions: seedActiveVersions(),
    demoScenarioStage: "custom",
    updatedAt: new Date(0).toISOString(),
  };
}

/** A stored profile is re-validated on read, so a schema change can never serve a malformed one. */
export function readProfile(stored: unknown): ApplicantProfile {
  const parsed = applicantProfileSchema.safeParse(stored);
  return parsed.success ? parsed.data : { ...DEFAULT_APPLICANT_PROFILE };
}

export function statusFor(base: CommunityReport["verificationStatus"], count: number): CommunityReport["verificationStatus"] {
  return count >= CORROBORATION_THRESHOLD ? "corroborated_pattern" : base;
}

/** One canonical ISO form, so every store compares timestamps the same way. */
export const iso = (value: string | Date) => new Date(value).toISOString();
