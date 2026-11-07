import { compareNoticeVersions, isConsequentialChange, readDevice, route, withDevice } from "@/app/api/_lib";
import { getDeviceState, getReports, noticesFor } from "@/data/persistence/server-db";

/** GET /api/dossiers?category=… — every monitored dossier, with the version this device follows and live report counts. */
export const GET = route(async (request) => {
  const device = readDevice(request);
  const category = new URL(request.url).searchParams.get("category");
  const [state, reports] = await Promise.all([getDeviceState(device.id), getReports(null)]);
  const notices = noticesFor(state.activeVersions).filter((n) => !category || n.category === category);

  return withDevice(
    Response.json({
      count: notices.length,
      dossiers: notices.map((n) => {
        const first = n.versions[0];
        const latest = n.versions[n.versions.length - 1];
        const active = n.versions.find((v) => v.versionNumber === n.activeVersionNumber) ?? latest;
        return {
          id: n.id,
          slug: n.slug,
          title: n.title,
          institution: n.institution,
          departmentOrTrust: n.departmentOrTrust,
          category: n.category,
          zone: n.zone,
          activeVersionNumber: n.activeVersionNumber,
          latestVersion: latest.versionNumber,
          versions: n.versions.map((v) => ({
            number: v.versionNumber,
            label: v.versionLabel,
            publishedAt: v.publishedAt,
            requirementCount: v.requirements.length,
          })),
          consequentialChangesSinceFirst:
            n.versions.length > 1 ? compareNoticeVersions(first, latest).filter(isConsequentialChange).length : 0,
          sourceConflicts: active.requirements.filter((r) => r.reviewState === "conflict").length,
          fieldReportsCount: reports.filter((r) => r.noticeId === n.id).length,
          sources: n.sources.length,
          links: {
            self: `/api/dossiers/${n.id}`,
            compare: `/api/compare?notice=${n.id}&from=${first.versionNumber}&to=${latest.versionNumber}`,
            calendar: `/api/calendar/${n.id}`,
          },
        };
      }),
    }),
    device
  );
});
