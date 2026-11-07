import type { NoticeVersion, Requirement } from "@/domain/types";
import { isIsoDate } from "./format";

/** The dated deadline in a version, if it has one ("6 hours before departure" is not a date). */
export function deadlineOf(version: NoticeVersion): { requirement: Requirement; date: string } | null {
  const r = version.requirements.find((x) => x.category === "deadline" && isIsoDate(x.value));
  return r ? { requirement: r, date: r.value } : null;
}

/** Whole days from `today` (local calendar date) to an ISO date. Negative once it has passed. */
export function daysUntil(dateIso: string, today: Date = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.parse(`${dateIso}T00:00:00Z`) - t) / 86_400_000);
}

export function daysPhrase(days: number): string {
  if (days < 0) return `closed ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "closes today";
  if (days === 1) return "closes tomorrow";
  return `${days} days left`;
}
