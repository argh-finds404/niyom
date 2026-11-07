import { route } from "@/app/api/_lib";

const ENDPOINTS = [
  { method: "GET", path: "/api/health", does: "Liveness, dataset and ledger statistics (no applicant data)" },
  { method: "GET", path: "/api/dossiers?category=…", does: "Every dossier, the version you follow, field report counts" },
  { method: "GET", path: "/api/dossiers/:id", does: "One dossier's versioned requirement ledger and its field reports" },
  { method: "PATCH", path: "/api/dossiers/:id", does: "Change the version your checklist follows" },
  { method: "GET", path: "/api/compare?notice=…&from=1&to=3", does: "The deterministic redline between two published versions" },
  { method: "POST", path: "/api/evaluate", does: "Readiness for a profile and checks (yours by default)" },
  { method: "GET", path: "/api/state", does: "Your profile, checks, followed versions and readiness" },
  { method: "PUT", path: "/api/state", does: "Save your profile, checks and versions (checks merge by updatedAt)" },
  { method: "DELETE", path: "/api/state", does: "Reset your own state; nobody else's data or reports" },
  { method: "GET", path: "/api/reports?noticeId=…&requirementId=…", does: "Public field reports, flagged relative to you" },
  { method: "POST", path: "/api/reports", does: "File a field report (pending verification)" },
  { method: "PATCH", path: "/api/reports", does: "Confirm someone else's report, once (\"I saw this too\")" },
  { method: "GET", path: "/api/calendar/:id?version=…", does: "The submission deadline as an iCalendar file" },
] as const;

/** GET /api — what this API offers. */
export const GET = route(async () =>
  Response.json({
    service: "niyom-api",
    identity: "An anonymous device id is issued in an HttpOnly cookie on first contact; there are no accounts.",
    errors: "Every error is JSON: { error, status, ...details }. 400 invalid, 413 too large, 422 unknown ids, 429 rate limited, 503 store unavailable.",
    endpoints: ENDPOINTS,
  })
);
