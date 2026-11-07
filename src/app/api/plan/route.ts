import { getDeviceState, getReports, noticesFor } from "@/data/persistence/server-db";
import {
  calculateNoticeReadiness,
  problem,
  readDevice,
  route,
  specChecksum,
  withDevice,
} from "@/app/api/_lib";
import { computePreparationTimeline, computeSharedFolderGroups } from "@/domain";

/**
 * GET /api/plan?notice=… — computes the deterministic counter-day preparation schedule
 * (Bangladesh Sun–Thu office calendar, latest safe start date, 3-stage sequence) and
 * cross-dossier shared physical folder equivalence across all four notices.
 */
export const GET = route(async (request) => {
  const device = readDevice(request);
  const url = new URL(request.url);
  const noticeId = url.searchParams.get("notice") ?? "notice-merit-2026";

  const saved = await getDeviceState(device.id);
  const notices = noticesFor(saved.activeVersions);
  const notice = notices.find((n) => n.id === noticeId);
  if (!notice) return withDevice(problem(404, `No dossier with id "${noticeId}".`), device);

  const version = notice.versions.find((v) => v.versionNumber === notice.activeVersionNumber) ?? notice.versions[0];
  const summary = calculateNoticeReadiness(
    notice,
    saved.profile,
    saved.readinessRecords,
    await getReports(device.id, { noticeId: notice.id })
  );
  const timeline = computePreparationTimeline(notice, summary, new Date());
  const sharedFolderGroups = computeSharedFolderGroups(notices, saved.profile, saved.readinessRecords);

  return withDevice(
    Response.json({
      noticeId: notice.id,
      version: {
        number: version.versionNumber,
        label: version.versionLabel,
        publishedAt: version.publishedAt,
        specChecksum: specChecksum(version),
      },
      timeline,
      sharedFolderGroups,
      engine: "niyom-domain (deterministic, no AI)",
    }),
    device
  );
});

