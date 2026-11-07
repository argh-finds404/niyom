import { syncStatePatchSchema } from "@/domain/schemas";
import { calculateNoticeReadiness, limitStateWrite, parseBody, problem, readDevice, route, withDevice } from "@/app/api/_lib";
import {
  getDeviceState,
  getReports,
  noticesFor,
  resetDeviceState,
  updateDeviceState,
  validateAgainstDataset,
} from "@/data/persistence/server-db";

/** This device's state, the public field reports (flagged "yours"/"confirmed by you"), and readiness per dossier. */
async function payload(deviceId: string) {
  const [state, reports] = await Promise.all([getDeviceState(deviceId), getReports(deviceId)]);
  const summaries = Object.fromEntries(
    noticesFor(state.activeVersions).map((n) => {
      const s = calculateNoticeReadiness(n, state.profile, state.readinessRecords, reports);
      return [
        n.id,
        {
          versionLabel: s.versionLabel,
          percentage: s.percentage,
          completedMandatory: s.completedMandatoryCount,
          applicableMandatory: s.totalApplicableMandatoryCount,
          staleChecks: s.staleReverificationCount,
          conflicts: s.conflictCount,
          fieldReports: s.communityReportCount,
        },
      ];
    })
  );
  return { ...state, communityReports: reports, summaries };
}

/** GET /api/state — the requesting device's applicant state. A new device gets a fresh default state. */
export const GET = route(async (request) => {
  const device = readDevice(request);
  return withDevice(Response.json(await payload(device.id)), device);
});

/**
 * PUT /api/state — saves this device's profile, checks and followed versions.
 * Checks merge record by record (newer `updatedAt` wins), so out-of-order requests cannot lose data.
 */
export const PUT = route(async (request) => {
  const device = readDevice(request);
  const limited = limitStateWrite(request, device);
  if (limited) return withDevice(limited, device);
  const body = await parseBody(request, syncStatePatchSchema);
  if ("response" in body) return withDevice(body.response, device);
  const problems = validateAgainstDataset(body.data);
  if (problems.length) return withDevice(problem(422, "State refers to dossiers, requirements or versions that do not exist.", { issues: problems }), device);
  await updateDeviceState(device.id, body.data);
  return withDevice(Response.json(await payload(device.id)), device);
});

/** DELETE /api/state — clears this device's applicant state only. Nobody else's data, and no field reports, are touched. */
export const DELETE = route(async (request) => {
  const device = readDevice(request);
  const limited = limitStateWrite(request, device);
  if (limited) return withDevice(limited, device);
  await resetDeviceState(device.id);
  return withDevice(Response.json(await payload(device.id)), device);
});
