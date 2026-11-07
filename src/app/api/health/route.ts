import { route } from "@/app/api/_lib";
import { CORROBORATION_THRESHOLD, ledgerHealth, ledgerKind, noticesFor } from "@/data/persistence/server-db";

/**
 * GET /api/health — liveness, dataset and ledger statistics. Contains no applicant data.
 * 200 when the ledger answers, 503 ("degraded") when its store cannot be reached.
 */
export const GET = route(async () => {
  const notices = noticesFor({});
  const warnings: string[] = [];
  let ledger: Record<string, unknown>;
  let reachable = true;
  try {
    const health = await ledgerHealth();
    ledger = health;
    if (!health.durable) warnings.push("Data is held in memory and is lost when the server restarts. Set DATABASE_URL for durable storage.");
  } catch (error) {
    reachable = false;
    console.error("[niyom] Health check: ledger store unreachable", error);
    ledger = { persistence: ledgerKind(), durable: false, reachable: false };
    warnings.push("The ledger store cannot be reached.");
  }

  return Response.json(
    {
      status: reachable ? "ok" : "degraded",
      service: "niyom-api",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      engine: "niyom-domain (deterministic, no AI)",
      validation: "zod",
      privacy: "applicant state is scoped to an anonymous HttpOnly device cookie; field reports are public",
      corroborationThreshold: CORROBORATION_THRESHOLD,
      dataset: {
        dossiers: notices.length,
        publishedVersions: notices.reduce((a, n) => a + n.versions.length, 0),
        trackedRequirements: notices.reduce((a, n) => a + n.versions.reduce((b, v) => b + v.requirements.length, 0), 0),
      },
      ledger,
      warnings,
      timestamp: new Date().toISOString(),
    },
    { status: reachable ? 200 : 503 }
  );
});
