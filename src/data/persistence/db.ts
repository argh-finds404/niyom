import Dexie, { type Table } from "dexie";
import {
  ApplicantProfile,
  CommunityReport,
  ReadinessRecord,
} from "../../domain/types";

export interface StoredActiveVersion {
  noticeId: string;
  versionNumber: number;
}

export interface StoredProfile {
  id: string; // "applicant_profile"
  data: ApplicantProfile;
}

export class NiyomDexieDB extends Dexie {
  readinessRecords!: Table<ReadinessRecord, [string, string]>;
  communityReports!: Table<CommunityReport, string>;
  activeVersions!: Table<StoredActiveVersion, string>;
  profile!: Table<StoredProfile, string>;

  constructor() {
    super("NiyomDB");
    this.version(1).stores({
      readinessRecords: "[noticeId+requirementId], noticeId, requirementId",
      communityReports: "id, noticeId, reportType",
      activeVersions: "noticeId",
      profile: "id",
    });
  }
}

let dbInstance: NiyomDexieDB | null = null;

/** Lets the UI tell the user that local saving failed, without coupling this layer to React. */
export const STORAGE_ERROR_EVENT = "niyom:storage-error";
function signalStorageError(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STORAGE_ERROR_EVENT));
}

export function getDb(): NiyomDexieDB | null {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return null;
  }
  if (!dbInstance) {
    dbInstance = new NiyomDexieDB();
  }
  return dbInstance;
}

export async function loadPersistedState(): Promise<{
  profile: ApplicantProfile | null;
  readinessRecords: ReadinessRecord[];
  communityReports: CommunityReport[];
  activeVersions: Record<string, number>;
}> {
  const db = getDb();
  if (!db) {
    return {
      profile: null,
      readinessRecords: [],
      communityReports: [],
      activeVersions: {},
    };
  }

  try {
    const [storedProfile, records, reports, versions] = await Promise.all([
      db.profile.get("applicant_profile"),
      db.readinessRecords.toArray(),
      db.communityReports.toArray(),
      db.activeVersions.toArray(),
    ]);

    const activeVersionMap: Record<string, number> = {};
    versions.forEach((v) => {
      activeVersionMap[v.noticeId] = v.versionNumber;
    });

    return {
      profile: storedProfile ? storedProfile.data : null,
      readinessRecords: records,
      communityReports: reports,
      activeVersions: activeVersionMap,
    };
  } catch (error) {
    console.warn("Could not load from IndexedDB:", error);
    signalStorageError();
    return {
      profile: null,
      readinessRecords: [],
      communityReports: [],
      activeVersions: {},
    };
  }
}

export async function persistReadinessRecord(record: ReadinessRecord): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.readinessRecords.put(record);
  } catch (error) {
    console.warn("Failed to persist readiness record:", error);
    signalStorageError();
  }
}

export async function persistAllReadinessRecords(records: ReadinessRecord[]): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.readinessRecords.clear();
    await db.readinessRecords.bulkPut(records);
  } catch (error) {
    console.warn("Failed to bulk persist readiness records:", error);
    signalStorageError();
  }
}

export async function persistProfile(profile: ApplicantProfile): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.profile.put({ id: "applicant_profile", data: profile });
  } catch (error) {
    console.warn("Failed to persist profile:", error);
    signalStorageError();
  }
}

export async function persistCommunityReport(report: CommunityReport): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.communityReports.put(report);
  } catch (error) {
    console.warn("Failed to persist community report:", error);
    signalStorageError();
  }
}

export async function deleteCommunityReport(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.communityReports.delete(id);
  } catch (error) {
    console.warn("Failed to delete community report:", error);
  }
}

export async function persistActiveVersion(
  noticeId: string,
  versionNumber: number
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.activeVersions.put({ noticeId, versionNumber });
  } catch (error) {
    console.warn("Failed to persist active version:", error);
    signalStorageError();
  }
}

export async function clearPersistedData(): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await Promise.all([
      db.readinessRecords.clear(),
      db.communityReports.clear(),
      db.activeVersions.clear(),
      db.profile.clear(),
    ]);
  } catch (error) {
    console.warn("Failed to clear persisted data:", error);
    signalStorageError();
  }
}
