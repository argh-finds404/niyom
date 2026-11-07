import type { ReadinessRecord } from "@/domain/types";

const key = (r: ReadinessRecord) => `${r.noticeId}::${r.requirementId}`;

/**
 * Merges two sets of checks record by record; the newer `updatedAt` wins. Used by the server and
 * the browser alike, so a late or repeated request can never undo a newer change.
 */
export function mergeRecords(current: ReadinessRecord[], incoming: ReadinessRecord[]): ReadinessRecord[] {
  const byKey = new Map(current.map((r) => [key(r), r]));
  for (const r of incoming) {
    const prev = byKey.get(key(r));
    if (!prev || Date.parse(r.updatedAt) >= Date.parse(prev.updatedAt)) byKey.set(key(r), r);
  }
  return [...byKey.values()];
}
