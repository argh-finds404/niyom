"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { shortTitle } from "@/lib/format";
import { Button, Overlay, Skel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type TabId = "evaluate" | "plan" | "compare" | "dossier" | "state" | "reports" | "dossiers" | "health";
type Call = { method: "GET" | "POST" | "PUT" | "PATCH"; path: string; body?: unknown };
type Result =
  | { status: number; ms: number; requestId: string | null; cacheControl: string | null; json: unknown }
  | { error: string };

const TABS: { id: TabId; label: string }[] = [
  { id: "evaluate", label: "Evaluate readiness" },
  { id: "plan", label: "Counter plan & reuse" },
  { id: "compare", label: "Compare versions" },
  { id: "dossier", label: "Dossier ledger" },
  { id: "state", label: "Your saved state" },
  { id: "reports", label: "Field reports" },
  { id: "dossiers", label: "All dossiers" },
  { id: "health", label: "System health" },
];

const ENDPOINTS: { method: string; path: string; what: string; tab?: TabId; calendar?: boolean }[] = [
  { method: "GET", path: "/api/health", what: "Liveness and ledger statistics (no applicant data)", tab: "health" },
  { method: "GET", path: "/api/dossiers", what: "Every dossier, the version you follow, report counts", tab: "dossiers" },
  { method: "GET", path: "/api/dossiers/:id", what: "One dossier's full requirement ledger & reports", tab: "dossier" },
  { method: "PATCH", path: "/api/dossiers/:id", what: "Change the version your checklist follows" },
  { method: "GET", path: "/api/compare?notice=…&from=1&to=3", what: "Deterministic redline diff & word tokens", tab: "compare" },
  { method: "POST", path: "/api/evaluate", what: "Server readiness calculation for profile & checks", tab: "evaluate" },
  { method: "GET", path: "/api/plan?notice=…", what: "Counter-day timeline, safe start & cross-dossier reuse", tab: "plan" },
  { method: "GET", path: "/api/reports?noticeId=…", what: "List persisted community field reports", tab: "reports" },
  { method: "POST", path: "/api/reports", what: "Validate, stamp & persist a new field report" },
  { method: "PATCH", path: "/api/reports", what: "Confirm a report (once per device, never your own)" },
  { method: "GET", path: "/api/state", what: "Your profile, checks and readiness (private to this device)", tab: "state" },
  { method: "PUT", path: "/api/state", what: "Save your profile, checks and versions (merged by time)" },
  { method: "DELETE", path: "/api/state", what: "Reset your own state (nobody else's, no reports)" },
  { method: "GET", path: "/api/calendar/:id", what: "Download submission deadline as an .ics file", calendar: true },
];

function buildCurl(call: Call): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const url = `${origin}${call.path}`;
  if (!call.body) {
    return `curl -i "${url}"`;
  }
  const escaped = JSON.stringify(call.body).replace(/'/g, "'\\''");
  return `curl -i -X ${call.method} "${url}" -H "Content-Type: application/json" -d '${escaped}'`;
}

/** Shows the server engine answering for the dossier on screen, with the real request it sent. */
function Body({ onClose }: { onClose: () => void }) {
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const notices = useNiyomStore((s) => s.notices);
  const profile = useNiyomStore((s) => s.profile);
  const records = useNiyomStore((s) => s.readinessRecords);
  const backendStatus = useNiyomStore((s) => s.backendStatus);
  const syncWithBackend = useNiyomStore((s) => s.syncWithBackend);
  const notice = notices.find((n) => n.id === activeNoticeId) ?? notices[0];
  const [tab, setTab] = useState<TabId>("evaluate");
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [showRequestPayload, setShowRequestPayload] = useState(false);
  const [copied, setCopied] = useState(false);

  const fromVer = notice.versions[0].versionNumber;
  const toVer = notice.versions[notice.versions.length - 1].versionNumber;

  const call: Call = (() => {
    switch (tab) {
      case "evaluate":
        return {
          method: "POST",
          path: "/api/evaluate",
          body: {
            noticeId: notice.id,
            versionNumber: notice.activeVersionNumber,
            profile,
            readinessRecords: records.filter((r) => r.noticeId === notice.id),
          },
        };
      case "plan":
        return {
          method: "GET",
          path: `/api/plan?notice=${notice.id}`,
        };
      case "compare":
        return {
          method: "GET",
          path: `/api/compare?notice=${notice.id}&from=${fromVer}&to=${toVer}`,
        };
      case "dossier":
        return {
          method: "GET",
          path: `/api/dossiers/${notice.id}`,
        };
      case "state":
        return {
          method: "GET",
          path: "/api/state",
        };
      case "reports":
        return {
          method: "GET",
          path: `/api/reports?noticeId=${notice.id}`,
        };
      case "dossiers":
        return {
          method: "GET",
          path: "/api/dossiers",
        };
      case "health":
        return {
          method: "GET",
          path: "/api/health",
        };
    }
  })();

  const key = `${nonce}:${JSON.stringify(call)}`;
  useEffect(() => {
    const ctrl = new AbortController();
    const started = performance.now();
    const c = JSON.parse(key.slice(key.indexOf(":") + 1)) as Call;
    fetch(c.path, {
      method: c.method,
      signal: ctrl.signal,
      headers: c.body ? { "Content-Type": "application/json" } : undefined,
      body: c.body ? JSON.stringify(c.body) : undefined,
    })
      .then(async (r) =>
        setResult({
          status: r.status,
          ms: Math.round(performance.now() - started),
          requestId: r.headers.get("x-request-id"),
          cacheControl: r.headers.get("cache-control"),
          json: await r.json(),
        })
      )
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted)
          setResult({ error: e instanceof Error ? e.message : "Request failed" });
      });
    return () => ctrl.abort();
  }, [key]);

  const copyCurl = () => {
    const cmd = buildCurl(call);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="ov-center mx-auto mt-[5vh] flex max-h-[88vh] w-[calc(100%-24px)] max-w-[820px] flex-col overflow-hidden rounded-[var(--r-panel)] bg-[#fcfbf8] text-[#1c1b19] shadow-[0_0_0_1px_rgba(28,27,25,0.08),0_40px_100px_-30px_rgba(28,27,25,0.5)]">
      <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-6 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="display text-[28px]">Live Backend API</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium",
                backendStatus === "online"
                  ? "bg-[#2d6a47]/15 text-[#2d6a47]"
                  : backendStatus === "connecting"
                    ? "bg-[#8a5510]/15 text-[#8a5510]"
                    : "bg-[#9a2b1e]/15 text-[#9a2b1e]"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full",
                  backendStatus === "online"
                    ? "bg-[#2d6a47]"
                    : backendStatus === "connecting"
                      ? "bg-[#8a5510]"
                      : "bg-[#9a2b1e]"
                )}
              />
              {backendStatus === "online"
                ? "Server Synced"
                : backendStatus === "connecting"
                  ? "Connecting…"
                  : "Offline Fallback"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 -mr-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Re-run request"
            onClick={() => {
              setResult(null);
              void syncWithBackend();
              setNonce((n) => n + 1);
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <p className="px-5 pb-4 text-[16px] leading-relaxed text-[#47433c] sm:px-6">
        The deterministic domain engine, Zod validation schemas, and server persistence ledger answering live for{" "}
        <span className="font-semibold text-[#1c1b19]">{shortTitle(notice)}</span>.
      </p>

      <div role="tablist" className="flex flex-wrap gap-1 px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => {
              setResult(null);
              setShowRequestPayload(false);
              setTab(t.id);
            }}
            className={cn(
              "h-9 rounded-[var(--r-control)] px-3 text-[14.5px] transition-colors",
              tab === t.id
                ? "bg-[#1c1b19] text-[#f2f1ed]"
                : "text-[#47433c] hover:bg-[#1c1b19]/[0.06]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="json flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-t-[var(--r-card)] bg-[#1c1b19] px-4 py-2.5 text-[#e8dcb5]">
          <span className="font-semibold">{call.method}</span>
          <span className="min-w-0 break-all text-[#f2f1ed]">{call.path}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {Boolean(call.body) && (
              <button
                type="button"
                onClick={() => setShowRequestPayload((v) => !v)}
                className="rounded px-2 py-0.5 text-[12px] text-[#e9e4d8]/80 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
              >
                {showRequestPayload ? "View response" : "Request body"}
              </button>
            )}
            <button
              type="button"
              onClick={copyCurl}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] text-[#e9e4d8]/80 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="h-3 w-3 text-[#9fd3b2]" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied curl" : "Copy curl"}
            </button>
            {result && "status" in result && (
              <span
                title={
                  result.requestId
                    ? `X-Request-Id: ${result.requestId}${result.cacheControl ? ` · Cache-Control: ${result.cacheControl}` : ""}`
                    : undefined
                }
                className={cn(
                  result.status < 300 ? "text-[#9fd3b2]" : "text-[#f2a39a]"
                )}
              >
                {result.status} · {result.ms} ms
                {result.requestId ? ` · req ${result.requestId.slice(0, 8)}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="max-h-[42vh] overflow-auto rounded-b-[var(--r-card)] bg-[#262420] px-4 py-3 text-[#e9e4d8]">
          {showRequestPayload && Boolean(call.body) ? (
            <pre className="json whitespace-pre-wrap break-words">
              {JSON.stringify(call.body, null, 2)}
            </pre>
          ) : !result ? (
            <div className="space-y-2 py-1" aria-busy>
              {[70, 55, 82, 40, 64].map((w) => (
                <Skel key={w} className="block h-3 bg-white/10" />
              ))}
            </div>
          ) : "error" in result ? (
            <p className="json text-[#f2a39a]">
              Couldn&rsquo;t reach the API: {result.error}. The app keeps working on this device.
            </p>
          ) : (
            <pre className="json whitespace-pre-wrap break-words">
              {JSON.stringify(result.json, null, 2)}
            </pre>
          )}
        </div>

        <p className="mt-6 text-[15px] italic text-[#6b655b]">
          REST API Endpoints (click an interactive route to inspect live)
        </p>
        <ul className="mt-2 divide-y divide-[#1c1b19]/10">
          {ENDPOINTS.map((e) => {
            const interactive = Boolean(e.tab || e.calendar);
            return (
              <li
                key={`${e.method}-${e.path}`}
                onClick={() => {
                  if (e.tab) {
                    setResult(null);
                    setShowRequestPayload(false);
                    setTab(e.tab);
                  } else if (e.calendar && typeof window !== "undefined") {
                    window.open(`/api/calendar/${notice.id}?version=${notice.activeVersionNumber}`, "_blank", "noopener");
                  }
                }}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2",
                  interactive && "cursor-pointer rounded-[6px] px-2 -mx-2 hover:bg-[#1c1b19]/[0.05]"
                )}
              >
                <span className="json w-14 flex-none font-semibold">{e.method}</span>
                <span className="json min-w-0 flex-1 break-all">{e.path}</span>
                <span className="w-full text-[14.5px] text-[#6b655b] sm:w-auto">{e.what}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function ApiInspector() {
  const open = useUiStore((s) => s.apiOpen);
  const setOpen = useUiStore((s) => s.setApiOpen);
  const close = () => setOpen(false);
  return (
    <Overlay open={open} onClose={close} label="Live API" placement="center">
      <Body onClose={close} />
    </Overlay>
  );
}
