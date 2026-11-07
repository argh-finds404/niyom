import { evaluateRequestSchema } from "@/domain/schemas";
import { getDeviceState, getReports, noticesFor, validateAgainstDataset } from "@/data/persistence/server-db";
import {
  calculateNoticeReadiness,
  compareNoticeVersions,
  isConsequentialChange,
  parseBody,
  problem,
  readDevice,
  route,
  withDevice,
} from "@/app/api/_lib";

/**
 * POST /api/evaluate — runs the readiness engine on the server for one dossier: applicability for this
 * profile, stale checks, conflicts, live field reports and the change set since the first version.
 * Profile and checks may be sent explicitly; otherwise this device's saved state is used.
 */
export const POST = route(async (request) => {
  const device = readDevice(request);
  const body = await parseBody(request, evaluateRequestSchema);
  if ("response" in body) return withDevice(body.response, device);

  const saved = await getDeviceState(device.id);
  const { noticeId, versionNumber, profile = saved.profile, readinessRecords = saved.readinessRecords } = body.data;
  const problems = validateAgainstDataset({ readinessRecords });
  if (problems.length) return withDevice(problem(422, "Checks refer to requirements that do not exist.", { issues: problems }), device);

  const base = noticesFor(saved.activeVersions).find((n) => n.id === noticeId);
  if (!base) return withDevice(problem(404, `No dossier with id "${noticeId}".`), device);
  const active = versionNumber ?? base.activeVersionNumber;
  const version = base.versions.find((v) => v.versionNumber === active);
  if (!version) return withDevice(problem(400, `Version ${active} was never published for this dossier.`), device);

  const notice = { ...base, activeVersionNumber: active };
  const summary = calculateNoticeReadiness(notice, profile, readinessRecords, await getReports(device.id, { noticeId }));
  const changes = active > base.versions[0].versionNumber ? compareNoticeVersions(base.versions[0], version) : [];

  return withDevice(
    Response.json({
      noticeId,
      version: { number: version.versionNumber, label: version.versionLabel, publishedAt: version.publishedAt },
      readiness: {
        percentage: summary.percentage,
        completedMandatory: summary.completedMandatoryCount,
        applicableMandatory: summary.totalApplicableMandatoryCount,
        staleChecks: summary.staleReverificationCount,
        needsProfileReview: summary.needsReviewCount,
        sourceConflicts: summary.conflictCount,
        fieldReports: summary.communityReportCount,
      },
      requirements: summary.items.map((i) => ({
        id: i.requirement.id,
        code: i.requirement.code,
        title: i.requirement.title,
        mandatory: i.requirement.mandatory,
        applicability: i.applicability,
        reason: i.applicabilityReason,
        status: i.readinessStatus,
        previouslyVerifiedValue: i.previouslyVerifiedValue ?? null,
        changedSinceFirstVersion: i.latestChange ? i.latestChange.type !== "unchanged" : false,
        fieldReportCount: i.communityReports.length,
      })),
      consequentialChangesSinceFirst: changes.filter(isConsequentialChange).length,
      engine: "niyom-domain (deterministic, no AI)",
    }),
    device
  );
});
