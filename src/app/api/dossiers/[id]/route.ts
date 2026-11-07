import { findNotice, limitStateWrite, parseBody, problem, readDevice, route, specChecksum, withDevice } from "@/app/api/_lib";
import { dossierVersionPatchSchema } from "@/domain/schemas";
import { findSeedNotice, getReports, updateDeviceState, validateAgainstDataset } from "@/data/persistence/server-db";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/dossiers/:id — the full versioned requirement ledger and live field reports for one dossier. */
export const GET = route(async (request, ctx: Ctx) => {
  const device = readDevice(request);
  const { id } = await ctx.params;
  const notice = await findNotice(id, device.id);
  if (!notice) return withDevice(problem(404, `No dossier with id "${id}".`), device);
  const activeVer = notice.versions.find((v) => v.versionNumber === notice.activeVersionNumber) ?? notice.versions[notice.versions.length - 1];
  return withDevice(
    Response.json({
      ...notice,
      activeSpecChecksum: specChecksum(activeVer),
      communityReports: await getReports(device.id, { noticeId: id }),
    }),
    device
  );
});

/** PATCH /api/dossiers/:id — changes which published version this device's checklist follows. */
export const PATCH = route(async (request, ctx: Ctx) => {
  const device = readDevice(request);
  const { id } = await ctx.params;
  if (!findSeedNotice(id)) return withDevice(problem(404, `No dossier with id "${id}".`), device);
  const limited = limitStateWrite(request, device);
  if (limited) return withDevice(limited, device);

  const body = await parseBody(request, dossierVersionPatchSchema);
  if ("response" in body) return withDevice(body.response, device);
  const activeVersions = { [id]: body.data.activeVersionNumber };
  const problems = validateAgainstDataset({ activeVersions });
  if (problems.length) return withDevice(problem(400, `Version ${body.data.activeVersionNumber} does not exist for dossier "${id}".`, { issues: problems }), device);

  await updateDeviceState(device.id, { activeVersions });
  const updated = await findNotice(id, device.id);
  const activeVer = updated!.versions.find((v) => v.versionNumber === updated!.activeVersionNumber) ?? updated!.versions[updated!.versions.length - 1];
  return withDevice(Response.json({ ...updated, activeSpecChecksum: specChecksum(activeVer) }), device);
});
