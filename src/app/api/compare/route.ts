import { compareNoticeVersions, problem, route } from "@/app/api/_lib";
import { findSeedNotice } from "@/data/persistence/server-db";
import { compareQuerySchema } from "@/domain/schemas";

/** GET /api/compare?notice=…&from=1&to=3 — the deterministic redline between two published versions. */
export const GET = route(async (request) => {
  const q = new URL(request.url).searchParams;
  const rawNotice = q.get("notice") ?? "";
  const notice = findSeedNotice(rawNotice);
  if (!notice) return problem(404, "Unknown or missing `notice`.");

  const parsedQuery = compareQuerySchema.safeParse({
    notice: rawNotice,
    from: q.get("from") ?? notice.versions[0].versionNumber,
    to: q.get("to") ?? notice.versions[notice.versions.length - 1].versionNumber,
  });

  if (!parsedQuery.success) {
    return problem(400, "`from` and `to` must be published version numbers.", {
      versions: notice.versions.map((v) => v.versionNumber),
      issues: parsedQuery.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const from = notice.versions.find((v) => v.versionNumber === parsedQuery.data.from);
  const to = notice.versions.find((v) => v.versionNumber === parsedQuery.data.to);
  if (!from || !to) {
    return problem(400, "`from` and `to` must be published version numbers.", {
      versions: notice.versions.map((v) => v.versionNumber),
    });
  }
  if (from.versionNumber >= to.versionNumber) {
    return problem(400, "`from` must be earlier than `to`.");
  }

  const changes = compareNoticeVersions(from, to);
  return Response.json({
    notice: notice.id,
    from: { number: from.versionNumber, label: from.versionLabel, publishedAt: from.publishedAt },
    to: { number: to.versionNumber, label: to.versionLabel, publishedAt: to.publishedAt },
    summary: {
      critical: changes.filter((c) => c.type !== "unchanged" && c.impact === "critical").length,
      actionNeeded: changes.filter((c) => c.type !== "unchanged" && c.impact === "action-needed").length,
      cosmetic: changes.filter((c) => c.type !== "unchanged" && c.impact === "informational").length,
      unchanged: changes.filter((c) => c.type === "unchanged").length,
    },
    changes: changes.map(({ previous, current, ...c }) => ({
      ...c,
      before: previous?.value ?? null,
      after: current?.value ?? null,
    })),
  });
});
