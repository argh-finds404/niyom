import { communityReportCorroborateSchema, communityReportInputSchema } from "@/domain/schemas";
import { MINUTE, limitAction, parseBody, problem, readDevice, route, withDevice } from "@/app/api/_lib";
import { CORROBORATION_THRESHOLD, addReport, corroborateReport, findSeedNotice, getReports } from "@/data/persistence/server-db";

/** GET /api/reports?noticeId=…&requirementId=… — public field reports, flagged relative to the requesting device. */
export const GET = route(async (request) => {
  const device = readDevice(request);
  const q = new URL(request.url).searchParams;
  const reports = await getReports(device.id, { noticeId: q.get("noticeId"), requirementId: q.get("requirementId") });
  return withDevice(
    Response.json({
      count: reports.length,
      corroboratedCount: reports.filter((r) => r.verificationStatus === "corroborated_pattern").length,
      pendingCount: reports.filter((r) => r.verificationStatus === "pending_verification").length,
      corroborationThreshold: CORROBORATION_THRESHOLD,
      reports,
    }),
    device
  );
});

/**
 * POST /api/reports — validates, stamps and stores a field report as "pending_verification".
 * Reports are never merged into official requirements. 5 per device and 30 per IP per 10 minutes.
 */
export const POST = route(async (request) => {
  const device = readDevice(request);
  const limited = limitAction(request, device, "report", 5, 30, 10 * MINUTE);
  if (limited) return withDevice(limited, device);

  const body = await parseBody(request, communityReportInputSchema);
  if ("response" in body) return withDevice(body.response, device);
  const notice = findSeedNotice(body.data.noticeId);
  if (!notice) return withDevice(problem(404, `No dossier with id "${body.data.noticeId}".`), device);
  const { requirementId } = body.data;
  if (requirementId && !notice.versions.some((v) => v.requirements.some((r) => r.id === requirementId))) {
    return withDevice(problem(400, `Requirement "${requirementId}" does not belong to this dossier.`), device);
  }

  const created = await addReport(body.data, device.id);
  return withDevice(Response.json(created, { status: 201 }), device);
});

/**
 * PATCH /api/reports — "I saw this too". One confirmation per device, never on your own report;
 * a report becomes a corroborated pattern once enough independent devices agree.
 */
export const PATCH = route(async (request) => {
  const device = readDevice(request);
  const limited = limitAction(request, device, "corroborate", 30, 120, 10 * MINUTE);
  if (limited) return withDevice(limited, device);

  const body = await parseBody(request, communityReportCorroborateSchema);
  if ("response" in body) return withDevice(body.response, device);

  const result = await corroborateReport(body.data.id, device.id);
  switch (result.status) {
    case "missing":
      return withDevice(problem(404, `No field report with id "${body.data.id}".`), device);
    case "own":
      return withDevice(problem(403, "You cannot confirm a report you filed yourself.", { report: result.report }), device);
    case "duplicate":
      return withDevice(problem(409, "You have already confirmed this report.", { report: result.report }), device);
    case "ok":
      return withDevice(Response.json(result.report), device);
  }
});
