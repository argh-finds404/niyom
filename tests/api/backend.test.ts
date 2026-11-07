// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { GET as getHealth } from "../../src/app/api/health/route";
import { GET as getState, PUT as putState } from "../../src/app/api/state/route";
import { GET as getCompare } from "../../src/app/api/compare/route";
import { StoreUnavailableError, __useStoreForTests, createFileStore, type LedgerStore } from "../../src/data/persistence/server-db";
import { DEFAULT_APPLICANT_PROFILE } from "../../src/data/seed/notices.seed";
import { useNiyomStore } from "../../src/hooks/useNiyomStore";
import { A, backendSuite, report, req } from "./backend.suite";

backendSuite("memory");

/** A store whose every call fails the way a lost database connection does (or with a plain bug). */
function brokenStore(error: () => Error): LedgerStore {
  const fail = async (): Promise<never> => {
    throw error();
  };
  return {
    kind: "postgres",
    durable: true,
    getDevice: fail,
    saveDevice: fail,
    deleteDevice: fail,
    listReports: fail,
    insertReport: fail,
    confirmReport: fail,
    stats: fail,
    reset: fail,
  };
}

describe("[memory] when the ledger store fails", () => {
  afterEach(() => {
    __useStoreForTests(createFileStore({ memoryOnly: true }));
    vi.restoreAllMocks();
  });

  it("answers 503 with Retry-After in JSON, and health says degraded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    __useStoreForTests(brokenStore(() => new StoreUnavailableError(new Error("ECONNREFUSED"))));

    const res = await putState(req("/api/state", { method: "PUT", device: A, body: { profile: DEFAULT_APPLICANT_PROFILE } }));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    const body = await res.json();
    expect(body).toMatchObject({ status: 503 });
    expect(body.requestId).toBe(res.headers.get("X-Request-Id"));
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED"); // internals stay in the server log

    const health = await getHealth(req("/api/health"));
    expect(health.status).toBe(503);
    expect(await health.json()).toMatchObject({ status: "degraded", ledger: { reachable: false } });

    // Endpoints that need no store keep working.
    expect((await getCompare(req("/api/compare?notice=notice-merit-2026&from=1&to=3"))).status).toBe(200);
  });

  it("answers an unexpected failure with 500 in JSON and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    __useStoreForTests(brokenStore(() => new Error("bug")));
    const res = await getState(req("/api/state", { device: A }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ status: 500, error: "Something went wrong on the server." });
    expect(log).toHaveBeenCalled();
  });
});

describe("client store", () => {
  it("runs the walkthrough scenarios and refuses to confirm your own report", async () => {
    useNiyomStore.getState().resetDemoData();
    const store = useNiyomStore.getState();
    store.loadScenarioV1Ready();
    expect(useNiyomStore.getState().demoScenarioStage).toBe("v1_ready");
    expect(useNiyomStore.getState().readinessRecords.filter((r) => r.checked)).toHaveLength(6);

    store.simulateV2UpdateArrival();
    expect(useNiyomStore.getState().notices.find((n) => n.id === "notice-merit-2026")!.activeVersionNumber).toBe(3);

    store.submitCommunityReport({ ...report, reportType: "service_delay", id: "rep-mine" });
    expect(await store.corroborateReport("rep-mine")).toBe("own");
    expect(useNiyomStore.getState().communityReports.find((r) => r.id === "rep-mine")!.corroborationCount).toBe(1);
  });

  it("never stores an invalid profile", () => {
    useNiyomStore.getState().resetDemoData();
    useNiyomStore.getState().updateProfile({ cgpa: 9 });
    expect(useNiyomStore.getState().profile.cgpa).toBe(DEFAULT_APPLICANT_PROFILE.cgpa);
  });
});
