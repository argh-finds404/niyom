import type { Notice } from "@/domain/types";
import { compareNoticeVersions } from "@/domain/comparison/compare";
import { isConsequential, isCosmetic } from "./format";

export interface ChangeAlert {
  noticeId: string;
  fromVersion: number;
  toVersion: number;
  consequential: number;
  cosmetic: number;
  staleChecks: number;
  publishedAt: string;
}

/**
 * An alert exists while the version your checklist follows is newer than the last one you
 * reviewed. Derived, never stored: marking as read just moves `lastSeen` forward.
 */
export function deriveAlerts(
  notices: Notice[],
  lastSeen: Record<string, number>,
  unfollowed: string[],
  staleByNotice: Record<string, number>,
  seedSeen: Record<string, number>
): ChangeAlert[] {
  return notices.flatMap((n) => {
    if (unfollowed.includes(n.id)) return [];
    const seen = lastSeen[n.id] ?? seedSeen[n.id] ?? n.activeVersionNumber;
    if (n.activeVersionNumber <= seen) return [];
    const from = n.versions.find((v) => v.versionNumber === seen) ?? n.versions[0];
    const to = n.versions.find((v) => v.versionNumber === n.activeVersionNumber) ?? n.versions[n.versions.length - 1];
    const changes = compareNoticeVersions(from, to);
    return [
      {
        noticeId: n.id,
        fromVersion: from.versionNumber,
        toVersion: to.versionNumber,
        consequential: changes.filter(isConsequential).length,
        cosmetic: changes.filter(isCosmetic).length,
        staleChecks: staleByNotice[n.id] ?? 0,
        publishedAt: to.publishedAt,
      },
    ];
  });
}
