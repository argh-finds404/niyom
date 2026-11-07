/*
 * The browser store against the real Route Handlers: fetch is routed to the handlers with a
 * cookie jar, so this is the same client/server conversation a browser has, including outages.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getState, PUT as putState, DELETE as deleteState } from "../../src/app/api/state/route";
import { GET as getReports, POST as postReport, PATCH as patchReport } from "../../src/app/api/reports/route";
import { __resetLedgerForTests } from "../../src/data/persistence/server-db";
import { __resetRateLimitsForTests } from "../../src/app/api/_lib";
import { SEED_NOTICES } from "../../src/data/seed/notices.seed";
import { useNiyomStore } from "../../src/hooks/useNiyomStore";

const handlers: Record<string, (r: Request) => Promise<Response>> = {
  "GET /api/state": getState,
  "PUT /api/state": putState,
  "DELETE /api/state": deleteState,
  "GET /api/reports": getReports,
  "POST /api/reports": postReport,
  "PATCH /api/reports": patchReport,
};

let jar = "";
/** Responses to force for the next matching calls, e.g. a 503 for one PUT. */
let forced: { key: string; response: () => Response }[] = [];
const calls: string[] = [];

vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
  const url = new URL(input, "http://localhost");
  const key = `${init.method ?? "GET"} ${url.pathname}`;
  calls.push(key);
  const i = forced.findIndex((f) => f.key === key);
  if (i >= 0) return forced.splice(i, 1)[0].response();
  const headers = new Headers(init.headers);
  if (jar) headers.set("cookie", jar);
  const res = await handlers[key](new Request(url, { method: init.method, headers, body: init.body }));
  jar = res.headers.get("set-cookie")?.split(";")[0] ?? jar;
  return res;
});

const serverState = async () => (await getState(new Request("http://localhost/api/state", { headers: { cookie: jar } }))).json();
const merit = SEED_NOTICES[0];
const requirement = (id: string) => merit.versions[0].requirements.find((r) => r.id === id)!;

beforeEach(async () => {
  await __resetLedgerForTests();
  __resetRateLimitsForTests();
  forced = [];
  calls.length = 0;
  jar = "";
  useNiyomStore.getState().resetDemoData(); // DELETE /api/state, then a full sync
  await vi.waitFor(() => expect(calls).toContain("GET /api/state"));
  await useNiyomStore.getState().syncWithBackend(); // joins the sync already in flight
  expect(useNiyomStore.getState().backendStatus).toBe("online");
});

describe("client ↔ server sync", () => {
  it("gets a device cookie and saves a check to this device's server state", async () => {
    expect(jar).toMatch(/^niyom_device=/);
    useNiyomStore.getState().toggleRequirementCheck(merit.id, requirement("req-transcript"), 1);
    await vi.waitFor(async () => expect((await serverState()).readinessRecords).toHaveLength(1));
    expect(useNiyomStore.getState().lastSyncedAt).not.toBeNull();
  });

  it("keeps a change through a server outage and sends it when the server recovers", async () => {
    forced.push({ key: "PUT /api/state", response: () => Response.json({ error: "down" }, { status: 503 }) });
    useNiyomStore.getState().toggleRequirementCheck(merit.id, requirement("req-student-id"), 1);
    await vi.waitFor(() => expect(useNiyomStore.getState().backendStatus).toBe("offline"));
    expect((await serverState()).readinessRecords).toHaveLength(0);

    // The retry (after ~2s) re-syncs and delivers the kept change.
    await vi.waitFor(async () => expect((await serverState()).readinessRecords).toHaveLength(1), { timeout: 6000, interval: 100 });
    expect(useNiyomStore.getState().backendStatus).toBe("online");
  }, 10_000);

  it("waits out a 429 and sends the change after Retry-After", async () => {
    forced.push({
      key: "PUT /api/state",
      response: () => Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "1" } }),
    });
    useNiyomStore.getState().updateProfile({ cgpa: 3.41 });
    await vi.waitFor(async () => expect((await serverState()).profile.cgpa).toBe(3.41), { timeout: 5000, interval: 100 });
  }, 10_000);

  it("uploads a report filed offline on the next sync and keeps it marked as yours", async () => {
    useNiyomStore.getState().submitCommunityReport(
      {
        noticeId: merit.id,
        requirementId: "req-transcript",
        reportType: "service_delay",
        observation: "Counter 3 says forms are only accepted on Sundays.",
        evidenceUrlOrRef: "Visited 6 Nov",
      },
      { upload: false }
    );
    const local = useNiyomStore.getState().communityReports.find((r) => r.id.startsWith("local-"))!;
    expect(useNiyomStore.getState().myReportIds).toContain(local.id);

    await useNiyomStore.getState().syncWithBackend();
    await vi.waitFor(() => expect(useNiyomStore.getState().communityReports.some((r) => r.id.startsWith("local-"))).toBe(false));
    const uploaded = useNiyomStore.getState().communityReports.find((r) => r.observation.startsWith("Counter 3"))!;
    expect(uploaded.id).toMatch(/^rep-/);
    expect(useNiyomStore.getState().myReportIds).toContain(uploaded.id);
    expect(await useNiyomStore.getState().corroborateReport(uploaded.id)).toBe("own");
    expect(calls.filter((c) => c === "POST /api/reports")).toHaveLength(1);
  });

  it("confirms someone else's report once and keeps the server's count", async () => {
    const seed = useNiyomStore.getState().communityReports.find((r) => r.id === "report-merit-01")!;
    expect(await useNiyomStore.getState().corroborateReport(seed.id)).toBe("ok");
    expect(useNiyomStore.getState().communityReports.find((r) => r.id === seed.id)!.corroborationCount).toBe(seed.corroborationCount + 1);
    expect(await useNiyomStore.getState().corroborateReport(seed.id)).toBe("duplicate");

    // A reload (fresh sync) still knows this device confirmed it.
    await useNiyomStore.getState().syncWithBackend();
    expect(useNiyomStore.getState().myConfirmedIds).toContain(seed.id);
  });

  it("supports bulk actions (checkAllRequired, reverifyBulk, clearDossierChecks) and preserves evidence memos", async () => {
    const v1Reqs = [requirement("req-transcript"), requirement("req-student-id")];
    useNiyomStore.getState().checkAllRequired(merit.id, v1Reqs, 1);
    useNiyomStore.getState().updateRequirementNote(merit.id, requirement("req-transcript"), 1, "Registrar Serial #409");

    await vi.waitFor(async () => {
      const s = await serverState();
      expect(s.readinessRecords).toHaveLength(2);
      const tr = s.readinessRecords.find((r: { requirementId: string }) => r.requirementId === "req-transcript");
      expect(tr.note).toBe("Registrar Serial #409");
      expect(tr.checked).toBe(true);
    });

    // Bulk re-verify against v3 preserves the existing evidence memo
    const v3Transcript = merit.versions[2].requirements.find((r) => r.id === "req-transcript")!;
    useNiyomStore.getState().reverifyBulk(merit.id, [v3Transcript], 3);
    await vi.waitFor(async () => {
      const s = await serverState();
      const tr = s.readinessRecords.find((r: { requirementId: string }) => r.requirementId === "req-transcript");
      expect(tr.verifiedAgainstVersion).toBe(3);
      expect(tr.note).toBe("Registrar Serial #409");
    });

    // Clear dossier checks unchecks all records while keeping memos intact
    useNiyomStore.getState().clearDossierChecks(merit.id);
    await vi.waitFor(async () => {
      const s = await serverState();
      expect(s.readinessRecords.every((r: { checked: boolean }) => r.checked === false)).toBe(true);
    });
  });
});
