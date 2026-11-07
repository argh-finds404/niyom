import { problem, route } from "@/app/api/_lib";
import { findSeedNotice } from "@/data/persistence/server-db";
import { buildDeadlineIcs } from "@/lib/ics";
import { deadlineOf } from "@/lib/deadline";
import { formatDate } from "@/lib/format";

/** GET /api/calendar/:id?version=3 — the dossier's submission deadline as an .ics calendar event. */
export const GET = route(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const notice = findSeedNotice(id);
  if (!notice) return problem(404, `No dossier with id "${id}".`);
  const asked = Number(new URL(request.url).searchParams.get("version"));
  const version = notice.versions.find((v) => v.versionNumber === asked) ?? notice.versions[notice.versions.length - 1];
  const deadline = deadlineOf(version);
  if (!deadline) return problem(404, "This dossier has no dated deadline in that version.");

  const ics = buildDeadlineIcs({
    uid: `${notice.id}-${version.versionNumber}-deadline@niyom`,
    title: `${notice.title}: ${deadline.requirement.title}`,
    date: deadline.date,
    description: `${deadline.requirement.evidence.excerpt} (${version.versionLabel}, published ${formatDate(version.publishedAt)}). Re-check NIYOM before submitting.`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${notice.id}-deadline.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
});
