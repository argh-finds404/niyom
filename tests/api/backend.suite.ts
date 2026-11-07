import { describe, it, expect, beforeEach } from "vitest";
import { GET as getIndex } from "../../src/app/api/route";
import { GET as getUnknown } from "../../src/app/api/[...path]/route";
import { GET as getHealth } from "../../src/app/api/health/route";
import { GET as getDossiers } from "../../src/app/api/dossiers/route";
import { GET as getDossierById, PATCH as patchDossierById } from "../../src/app/api/dossiers/[id]/route";
import { GET as getCompare } from "../../src/app/api/compare/route";
import { POST as postEvaluate } from "../../src/app/api/evaluate/route";
import { GET as getReports, POST as postReport, PATCH as patchReport } from "../../src/app/api/reports/route";
import { GET as getState, PUT as putState, DELETE as deleteState } from "../../src/app/api/state/route";
import { GET as getCalendar } from "../../src/app/api/calendar/[id]/route";
import { __resetLedgerForTests } from "../../src/data/persistence/server-db";
import { __resetRateLimitsForTests } from "../../src/app/api/_lib";
import { DEFAULT_APPLICANT_PROFILE } from "../../src/data/seed/notices.seed";
import { mergeRecords } from "../../src/lib/records";

// Three anonymous devices (browsers).
export const A = "11111111-1111-4111-8111-111111111111";
export const B = "22222222-2222-4222-8222-222222222222";
export const C = "33333333-3333-4333-8333-333333333333";

export function req(
  path: string,
  { method = "GET", body, device, raw, ip }: { method?: string; body?: unknown; device?: string; raw?: string; ip?: string } = {}
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(device ? { cookie: `theme=x; niyom_device=${device}` } : {}),
      ...(ip ? { "x-forwarded-for": `${ip}, 10.0.0.1` } : {}),
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}
export const params = (id: string) => ({ params: Promise.resolve({ id }) });
export const record = (requirementId: string, checked: boolean, updatedAt: string, value = "x", version = 1) => ({
  noticeId: "notice-merit-2026",
  requirementId,
  checked,
  verifiedAgainstValue: value,
  verifiedAgainstVersion: version,
  updatedAt,
});
export const report = {
  noticeId: "notice-merit-2026",
  requirementId: "req-transcript",
  reportType: "contradictory_instruction",
  observation: "Controller office requires a forwarding slip from the department first.",
  evidenceUrlOrRef: "Notice board memo RUET-CE-12",
};
const MERIT_REQUIREMENTS = ["req-transcript", "req-student-id", "req-recommendation", "req-income-cert", "req-cgpa", "req-deadline"];

/** The whole API contract. Runs once per backing store, so both behave identically. */
export function backendSuite(persistence: "memory" | "postgres") {
  beforeEach(async () => {
    await __resetLedgerForTests();
    __resetRateLimitsForTests();
  });

  describe(`[${persistence}] device identity`, () => {
    it("issues an HttpOnly device cookie to a new browser, and only once", async () => {
      const first = await getState(req("/api/state"));
      const cookie = first.headers.get("set-cookie") ?? "";
      expect(cookie).toMatch(/^niyom_device=[0-9a-f-]{36}; /);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");

      const again = await getState(req("/api/state", { device: A }));
      expect(again.headers.get("set-cookie")).toBeNull();
    });

    it("ignores a forged, malformed device id and issues a fresh one", async () => {
      const res = await getState(req("/api/state", { device: "../../etc/passwd" }));
      expect(res.headers.get("set-cookie")).toMatch(/^niyom_device=[0-9a-f-]{36}/);
    });

    it("marks the cookie Secure behind an https proxy", async () => {
      const res = await getState(new Request("http://localhost/api/state", { headers: { "x-forwarded-proto": "https" } }));
      expect(res.headers.get("set-cookie")).toContain("Secure");
    });
  });

  describe(`[${persistence}] /api/state is private to each device`, () => {
    it("never shows one device's profile or checks to another", async () => {
      await putState(
        req("/api/state", {
          method: "PUT",
          device: A,
          body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 3.92 }, readinessRecords: [record("req-transcript", true, "2026-11-01T10:00:00Z")] },
        })
      );
      const a = await (await getState(req("/api/state", { device: A }))).json();
      const b = await (await getState(req("/api/state", { device: B }))).json();
      expect(a.profile.cgpa).toBe(3.92);
      expect(a.readinessRecords).toHaveLength(1);
      expect(a.readinessRecords[0]).toMatchObject({ requirementId: "req-transcript", checked: true, updatedAt: "2026-11-01T10:00:00.000Z" });
      expect(b.profile.cgpa).toBe(DEFAULT_APPLICANT_PROFILE.cgpa);
      expect(b.readinessRecords).toHaveLength(0);
    });

    it("keeps profile, versions and stage when a patch only carries checks", async () => {
      await putState(
        req("/api/state", {
          method: "PUT",
          device: A,
          body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 3.6 }, activeVersions: { "notice-merit-2026": 3 }, demoScenarioStage: "v2_updated" },
        })
      );
      await putState(req("/api/state", { method: "PUT", device: A, body: { readinessRecords: [record("req-student-id", true, "2026-11-01T10:00:00Z")] } }));
      await putState(req("/api/state", { method: "PUT", device: A, body: { activeVersions: { "service-railway-refund": 1 } } }));
      const a = await (await getState(req("/api/state", { device: A }))).json();
      expect(a.profile.cgpa).toBe(3.6);
      expect(a.demoScenarioStage).toBe("v2_updated");
      expect(a.activeVersions).toMatchObject({ "notice-merit-2026": 3, "service-railway-refund": 1 });
      expect(a.summaries["notice-merit-2026"].versionLabel).toBeTruthy();
    });

    it("DELETE resets only the caller's state and never removes field reports", async () => {
      await putState(req("/api/state", { method: "PUT", device: A, body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 3.5 } } }));
      await putState(req("/api/state", { method: "PUT", device: B, body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 3.3 } } }));
      await postReport(req("/api/reports", { method: "POST", device: A, body: report }));

      await deleteState(req("/api/state", { method: "DELETE", device: A }));
      const a = await (await getState(req("/api/state", { device: A }))).json();
      const b = await (await getState(req("/api/state", { device: B }))).json();
      expect(a.profile.cgpa).toBe(DEFAULT_APPLICANT_PROFILE.cgpa);
      expect(b.profile.cgpa).toBe(3.3);
      expect(a.communityReports).toHaveLength(4); // 3 seed + A's report survive A's reset
      expect(a.communityReports.filter((r: { yours: boolean }) => r.yours)).toHaveLength(1); // still recognised as A's
    });

    it("merges checks by updatedAt, so a late, older request cannot undo a newer one", async () => {
      await putState(req("/api/state", { method: "PUT", device: A, body: { readinessRecords: [record("req-transcript", true, "2026-11-02T10:00:00Z")] } }));
      await putState(req("/api/state", { method: "PUT", device: A, body: { readinessRecords: [record("req-transcript", false, "2026-11-02T09:00:00Z")] } }));
      const a = await (await getState(req("/api/state", { device: A }))).json();
      expect(a.readinessRecords[0].checked).toBe(true);
      expect(mergeRecords([record("r", true, "2026-11-01T00:00:00Z")], [record("r", false, "2026-11-03T00:00:00Z")])[0].checked).toBe(false);
    });

    it("accepts the same requirement twice in one patch and keeps the newest", async () => {
      const res = await putState(
        req("/api/state", {
          method: "PUT",
          device: A,
          body: { readinessRecords: [record("req-transcript", true, "2026-11-02T10:00:00Z"), record("req-transcript", false, "2026-11-02T11:00:00Z")] },
        })
      );
      expect(res.status).toBe(200);
      expect((await res.json()).readinessRecords).toMatchObject([{ requirementId: "req-transcript", checked: false }]);
    });

    it("loses nothing when many writes from one device arrive at once", async () => {
      const writes = MERIT_REQUIREMENTS.map((id, i) =>
        putState(req("/api/state", { method: "PUT", device: A, body: { readinessRecords: [record(id, true, `2026-11-02T10:0${i}:00Z`)] } }))
      );
      expect((await Promise.all(writes)).map((r) => r.status)).toEqual(MERIT_REQUIREMENTS.map(() => 200));
      const a = await (await getState(req("/api/state", { device: A }))).json();
      expect(a.readinessRecords.map((r: { requirementId: string }) => r.requirementId).sort()).toEqual([...MERIT_REQUIREMENTS].sort());
    });

    it("rejects ids and versions that do not exist in the dataset", async () => {
      const badVersion = await putState(req("/api/state", { method: "PUT", device: A, body: { activeVersions: { "notice-merit-2026": 99 } } }));
      expect(badVersion.status).toBe(422);
      const badNotice = await putState(req("/api/state", { method: "PUT", device: A, body: { activeVersions: { "made-up": 1 } } }));
      expect(badNotice.status).toBe(422);
      const badRequirement = await putState(
        req("/api/state", { method: "PUT", device: A, body: { readinessRecords: [record("req-not-real", true, "2026-11-01T00:00:00Z")] } })
      );
      expect(badRequirement.status).toBe(422);
    });

    it("rejects malformed, invalid, out-of-range and oversized bodies", async () => {
      expect((await putState(req("/api/state", { method: "PUT", device: A, raw: "{not json" }))).status).toBe(400);
      expect((await putState(req("/api/state", { method: "PUT", device: A, body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 5 } } }))).status).toBe(400);
      for (const when of ["not a date", "+275760-09-13T00:00:00Z", "1970-01-01T00:00:00Z"]) {
        expect((await putState(req("/api/state", { method: "PUT", device: A, body: { readinessRecords: [record("req-transcript", true, when)] } }))).status).toBe(400);
      }
      const huge = { readinessRecords: [record("req-transcript", true, "2026-11-01T00:00:00Z", "x".repeat(70_000))] };
      expect((await putState(req("/api/state", { method: "PUT", device: A, body: huge }))).status).toBe(413);
    });
  });

  describe(`[${persistence}] dossiers, compare, evaluate, calendar`, () => {
    it("serves dossiers with the version each device follows", async () => {
      const list = await (await getDossiers(req("/api/dossiers", { device: A }))).json();
      expect(list.count).toBe(4);
      const scholarships = await (await getDossiers(req("/api/dossiers?category=scholarship", { device: A }))).json();
      expect(scholarships.count).toBe(1);

      const patched = await patchDossierById(
        req("/api/dossiers/notice-merit-2026", { method: "PATCH", device: A, body: { activeVersionNumber: 3 } }),
        params("notice-merit-2026")
      );
      expect((await patched.json()).activeVersionNumber).toBe(3);
      const seenByA = await (await getDossierById(req("/api/dossiers/notice-merit-2026", { device: A }), params("notice-merit-2026"))).json();
      expect(seenByA.activeVersionNumber).toBe(3);
      const seenByB = await (await getDossierById(req("/api/dossiers/notice-merit-2026", { device: B }), params("notice-merit-2026"))).json();
      expect(seenByB.activeVersionNumber).toBe(1);

      const bad = await patchDossierById(
        req("/api/dossiers/notice-merit-2026", { method: "PATCH", device: A, body: { activeVersionNumber: 99 } }),
        params("notice-merit-2026")
      );
      expect(bad.status).toBe(400);
      expect((await getDossierById(req("/api/dossiers/unknown"), params("unknown"))).status).toBe(404);
      expect((await patchDossierById(req("/api/dossiers/unknown", { method: "PATCH", body: { activeVersionNumber: 1 } }), params("unknown"))).status).toBe(404);
    });

    it("computes the deterministic redline and validates its parameters", async () => {
      const body = await (await getCompare(req("/api/compare?notice=notice-merit-2026&from=1&to=3"))).json();
      expect(body.summary).toMatchObject({ critical: 3, actionNeeded: 1, cosmetic: 1 });
      expect((await getCompare(req("/api/compare?notice=notice-merit-2026&from=3&to=1"))).status).toBe(400);
      expect((await getCompare(req("/api/compare?notice=notice-merit-2026&from=abc"))).status).toBe(400);
      expect((await getCompare(req("/api/compare?notice=nope"))).status).toBe(404);
    });

    it("evaluates readiness from explicit input or from the caller's saved state", async () => {
      const explicit = await (
        await postEvaluate(
          req("/api/evaluate", {
            method: "POST",
            device: A,
            body: {
              noticeId: "notice-merit-2026",
              versionNumber: 3,
              profile: DEFAULT_APPLICANT_PROFILE,
              readinessRecords: [record("req-transcript", true, "2026-11-01T00:00:00Z", "Standard photocopy of latest semester marksheet")],
            },
          })
        )
      ).json();
      expect(explicit.readiness.staleChecks).toBe(1);
      expect(explicit.readiness.sourceConflicts).toBe(1);

      // Saved state: device A drops below the CGPA cut-off.
      await putState(req("/api/state", { method: "PUT", device: A, body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 3.1 } } }));
      const saved = await (await postEvaluate(req("/api/evaluate", { method: "POST", device: A, body: { noticeId: "notice-merit-2026" } }))).json();
      expect(saved.requirements.find((r: { code: string }) => r.code === "REQ-ELG-01").applicability).toBe("DOES_NOT_APPLY");
      const other = await (await postEvaluate(req("/api/evaluate", { method: "POST", device: B, body: { noticeId: "notice-merit-2026" } }))).json();
      expect(other.requirements.find((r: { code: string }) => r.code === "REQ-ELG-01").applicability).toBe("APPLIES");

      const invalid = await postEvaluate(
        req("/api/evaluate", { method: "POST", body: { noticeId: "notice-merit-2026", profile: { ...DEFAULT_APPLICANT_PROFILE, householdIncomeLakhs: -2 } } })
      );
      expect(invalid.status).toBe(400);
      expect((await postEvaluate(req("/api/evaluate", { method: "POST", body: { noticeId: "nope" } }))).status).toBe(404);
      expect((await postEvaluate(req("/api/evaluate", { method: "POST", body: { noticeId: "notice-merit-2026", versionNumber: 42 } }))).status).toBe(400);
    });

    it("serves the deadline as an iCalendar file", async () => {
      const res = await getCalendar(req("/api/calendar/notice-merit-2026?version=3"), params("notice-merit-2026"));
      expect(res.headers.get("Content-Type")).toContain("text/calendar");
      expect(await res.text()).toContain("DTSTART;VALUE=DATE:20261125");
      expect((await getCalendar(req("/api/calendar/nope"), params("nope"))).status).toBe(404);
    });
  });

  describe(`[${persistence}] field reports: public, but corroboration cannot be gamed`, () => {
    it("counts one confirmation per device, never the author's, and corroborates at three", async () => {
      const created = await postReport(req("/api/reports", { method: "POST", device: A, body: report }));
      expect(created.status).toBe(201);
      const r = await created.json();
      expect(r).toMatchObject({ verificationStatus: "pending_verification", corroborationCount: 1, yours: true });

      // The author cannot confirm their own report.
      expect((await patchReport(req("/api/reports", { method: "PATCH", device: A, body: { id: r.id } }))).status).toBe(403);

      // B confirms once; a second click is refused.
      const byB = await (await patchReport(req("/api/reports", { method: "PATCH", device: B, body: { id: r.id } }))).json();
      expect(byB).toMatchObject({ corroborationCount: 2, verificationStatus: "pending_verification", confirmedByYou: true, yours: false });
      const again = await patchReport(req("/api/reports", { method: "PATCH", device: B, body: { id: r.id } }));
      expect(again.status).toBe(409);
      expect((await again.json()).report).toMatchObject({ corroborationCount: 2 });

      // A third independent device makes it a pattern.
      const byC = await (await patchReport(req("/api/reports", { method: "PATCH", device: C, body: { id: r.id } }))).json();
      expect(byC).toMatchObject({ corroborationCount: 3, verificationStatus: "corroborated_pattern" });

      // Flags are relative to the reader; nobody else's identity is exposed.
      const asB = await (await getReports(req("/api/reports?noticeId=notice-merit-2026", { device: B }))).json();
      const seen = asB.reports.find((x: { id: string }) => x.id === r.id);
      expect(seen).toMatchObject({ yours: false, confirmedByYou: true, corroborationCount: 3 });
      expect(JSON.stringify(asB)).not.toContain(A);
      expect(asB.corroboratedCount).toBe(2); // the seed report on this dossier and the new one

      // The server engine counts the new report.
      const evalBody = await (await postEvaluate(req("/api/evaluate", { method: "POST", device: B, body: { noticeId: "notice-merit-2026", versionNumber: 3 } }))).json();
      expect(evalBody.readiness.fieldReports).toBe(2);

      expect((await patchReport(req("/api/reports", { method: "PATCH", device: B, body: { id: "rep-missing" } }))).status).toBe(404);
    });

    it("counts a burst of clicks from one device exactly once", async () => {
      const r = await (await postReport(req("/api/reports", { method: "POST", device: A, body: report }))).json();
      const burst = await Promise.all(
        Array.from({ length: 8 }, () => patchReport(req("/api/reports", { method: "PATCH", device: B, body: { id: r.id } })))
      );
      expect(burst.filter((x) => x.status === 200)).toHaveLength(1);
      expect(burst.filter((x) => x.status === 409)).toHaveLength(7);
      const list = await (await getReports(req("/api/reports", { device: C }))).json();
      expect(list.reports.find((x: { id: string }) => x.id === r.id).corroborationCount).toBe(2);
    });

    it("lists reports newest first and filters by requirement", async () => {
      await postReport(req("/api/reports", { method: "POST", device: A, body: { ...report, requirementId: "req-student-id" } }));
      const all = await (await getReports(req("/api/reports", { device: A }))).json();
      const times = all.reports.map((r: { submittedAt: string }) => Date.parse(r.submittedAt));
      expect(times).toEqual([...times].sort((a, b) => b - a));
      const byRequirement = await (await getReports(req("/api/reports?noticeId=notice-merit-2026&requirementId=req-student-id", { device: A }))).json();
      expect(byRequirement.count).toBe(1);
      expect(byRequirement.reports[0]).toMatchObject({ requirementId: "req-student-id", yours: true });
    });

    it("validates reports against the dossier and rate-limits filing per device", async () => {
      const wrongRequirement = await postReport(req("/api/reports", { method: "POST", device: A, body: { ...report, requirementId: "req-pass-nid" } }));
      expect(wrongRequirement.status).toBe(400);
      const tooShort = await postReport(req("/api/reports", { method: "POST", device: A, body: { ...report, observation: "no" } }));
      expect(tooShort.status).toBe(400);
      expect((await postReport(req("/api/reports", { method: "POST", device: A, body: { ...report, noticeId: "nope" } }))).status).toBe(404);

      for (let i = 0; i < 5; i++) expect((await postReport(req("/api/reports", { method: "POST", device: B, body: report }))).status).toBe(201);
      const limited = await postReport(req("/api/reports", { method: "POST", device: B, body: report }));
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
      // Another device is unaffected.
      expect((await postReport(req("/api/reports", { method: "POST", device: C, body: report }))).status).toBe(201);
    });

    it("rate-limits per IP too, so dropping the cookie does not reset the limit", async () => {
      for (let i = 0; i < 30; i++) {
        expect((await postReport(req("/api/reports", { method: "POST", ip: "203.0.113.7", body: report }))).status).toBe(201);
      }
      expect((await postReport(req("/api/reports", { method: "POST", ip: "203.0.113.7", body: report }))).status).toBe(429);
      expect((await postReport(req("/api/reports", { method: "POST", ip: "198.51.100.4", body: report }))).status).toBe(201);
    });
  });

  describe(`[${persistence}] API surface`, () => {
    it("reports health and ledger statistics without applicant data", async () => {
      await putState(req("/api/state", { method: "PUT", device: A, body: { profile: { ...DEFAULT_APPLICANT_PROFILE, cgpa: 3.33 } } }));
      const res = await getHealth(req("/api/health"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.dataset).toMatchObject({ dossiers: 4, publishedVersions: 9 });
      expect(body.ledger).toMatchObject({ devices: 1, communityReports: 3, corroboratedReports: 3, persistence, durable: persistence === "postgres" });
      expect(JSON.stringify(body)).not.toContain("3.33");
      expect(JSON.stringify(body)).not.toContain(A);
    });

    it("answers every response with a request id and no-store, and unknown paths with JSON", async () => {
      const state = await getState(req("/api/state", { device: A }));
      expect(state.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
      expect(state.headers.get("Cache-Control")).toBe("no-store");

      const index = await (await getIndex(req("/api"))).json();
      expect(index.endpoints.length).toBeGreaterThanOrEqual(13);

      const missing = await getUnknown(req("/api/nothing-here"));
      expect(missing.status).toBe(404);
      expect(await missing.json()).toMatchObject({ status: 404, endpoints: "/api" });
    });
  });
}
