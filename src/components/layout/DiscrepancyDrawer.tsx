"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { X } from "lucide-react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { versionOf } from "@/hooks/useDossierIntelligence";
import { communityReportInputSchema, type CommunityReportInput } from "@/domain";
import type { CommunityReport } from "@/domain/types";
import { REPORT_TYPE_LABEL, shortTitle } from "@/lib/format";
import { Button, Overlay, buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<keyof CommunityReportInput, string>>;

const field =
  "w-full rounded-[var(--r-control)] border border-[#1c1b19]/25 bg-white/50 px-3.5 text-[17px] transition-[border-color,background-color] duration-200 placeholder:italic placeholder:text-[#6b655b] hover:border-[#1c1b19]/70 focus:border-[#1c1b19] focus:bg-white/60 focus:outline-none";

function DrawerBody({ initial, onClose }: { initial: { noticeId?: string; requirementId?: string }; onClose: () => void }) {
  const notices = useNiyomStore((s) => s.notices);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const submit = useNiyomStore((s) => s.submitCommunityReport);
  const toast = useUiStore((s) => s.toast);
  const uid = useId();

  const [form, setForm] = useState<CommunityReportInput>({
    noticeId: initial.noticeId ?? activeNoticeId,
    requirementId: initial.requirementId,
    reportType: "requirement_changed",
    observation: "",
    evidenceUrlOrRef: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const notice = notices.find((n) => n.id === form.noticeId) ?? notices[0];
  const requirements = versionOf(notice, notice.activeVersionNumber).requirements;
  const set = <K extends keyof CommunityReportInput>(k: K, v: CommunityReportInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = communityReportInputSchema.safeParse({
      ...form,
      observation: form.observation.trim(),
      evidenceUrlOrRef: form.evidenceUrlOrRef.trim(),
      requirementId: form.requirementId || undefined,
    });
    if (!parsed.success) {
      const next: Errors = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof CommunityReportInput;
        next[k] ??= i.message;
      });
      setErrors(next);
      document.getElementById(`${uid}-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setPending(true);
    // The server validates, stamps, and persists the report; the device keeps the stamped record. Offline, it is kept locally all the same.
    fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) })
      .then(async (r) => {
        if (r.ok) return { report: (await r.json()) as CommunityReport, limited: false };
        if (r.status === 429 || r.status >= 500) return { report: null, limited: r.status === 429 };
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The server rejected this report.");
      })
      .then(({ report: serverReport, limited }) => {
        // Not accepted yet: keep it here; the store sends it again later.
        if (serverReport) submit(serverReport);
        else submit(parsed.data, { upload: false });
        setDone(true);
        toast(
          serverReport
            ? { tone: "ok", title: "Report recorded", body: "Validated and stored on the server; marked pending verification." }
            : limited
              ? { tone: "neutral", title: "Report saved on this device", body: "You have filed several reports in a few minutes. NIYOM will send this one shortly." }
              : { tone: "neutral", title: "Report saved on this device", body: "The server could not be reached. NIYOM will send it when it can." }
        );
      })
      .catch((err: unknown) => {
        if (err instanceof TypeError) {
          // Network failure: keep the report locally; the store sends it when the connection returns.
          submit(parsed.data, { upload: false });
          setDone(true);
          toast({ tone: "neutral", title: "Report saved on this device", body: "You appear to be offline; it stays pending verification." });
        } else {
          setErrors({ observation: err instanceof Error ? err.message : "The server rejected this report." });
        }
      })
      .finally(() => setPending(false));
  };

  return (
    <div className="ov-right flex h-full w-full flex-col bg-paper text-[#1c1b19] shadow-[-30px_0_80px_-40px_rgba(28,27,25,0.5)] sm:w-[500px] sm:rounded-l-[var(--r-panel)]">
      <div className="flex items-start justify-between gap-4 px-7 pb-5 pt-7">
        <div>
          <h2 className="display text-[30px]">Flag a discrepancy</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-[#47433c]">
            Tell other applicants what you saw at a counter, portal or notice board. It stays a field report until corroborated.
          </p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="-mr-2">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {done ? (
        <div className="anim-rise flex flex-1 flex-col border-t border-[#1c1b19]/15 px-7 py-10">
          <p className="text-[16px] italic text-[#2d6a47]">Recorded</p>
          <h3 className="display mt-1 text-[26px]">Thank you. Your report is on file.</h3>
          <p className="mt-4 text-[17px] leading-relaxed text-[#47433c]">
            It appears beside <span className="font-semibold text-[#1c1b19]">{shortTitle(notice)}</span>, marked{" "}
            <span className="code text-[#8a5510]">pending verification</span>. It never changes the official specification or
            anyone&rsquo;s readiness score.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={`/notice/${notice.id}${form.requirementId ? `#req-${form.requirementId}` : ""}`}
              onClick={onClose}
              className={buttonClass("primary")}
            >
              See it in the specification
            </Link>
            <Button
              onClick={() => {
                setDone(false);
                setForm((f) => ({ ...f, observation: "", evidenceUrlOrRef: "" }));
              }}
            >
              File another
            </Button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col border-t border-[#1c1b19]/15">
          <div className="flex-1 space-y-6 overflow-y-auto px-7 py-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-noticeId`} className="mb-2 block text-[15px] italic text-[#47433c]">
                  Dossier
                </label>
                <select
                  id={`${uid}-noticeId`}
                  value={form.noticeId}
                  onChange={(e) => {
                    set("noticeId", e.target.value);
                    set("requirementId", undefined);
                  }}
                  className={cn(field, "h-11")}
                >
                  {notices.map((n) => (
                    <option key={n.id} value={n.id}>
                      {shortTitle(n)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-requirementId`} className="mb-2 block text-[15px] italic text-[#47433c]">
                  Requirement (optional)
                </label>
                <select
                  id={`${uid}-requirementId`}
                  value={form.requirementId ?? ""}
                  onChange={(e) => set("requirementId", e.target.value || undefined)}
                  className={cn(field, "h-11")}
                >
                  <option value="">The dossier in general</option>
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} · {r.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-[15px] italic text-[#47433c]">What did you observe?</legend>
              <div className="grid grid-cols-1 gap-1 rounded-[var(--r-card)] bg-[#1c1b19]/[0.05] p-1 sm:grid-cols-2">
                {(Object.keys(REPORT_TYPE_LABEL) as CommunityReportInput["reportType"][]).map((t) => {
                  const on = form.reportType === t;
                  return (
                    <label
                      key={t}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] px-3 text-[15.5px] transition-colors duration-200",
                        on ? "bg-[#1c1b19] text-[#f4f1ea]" : "hover:bg-[#1c1b19]/[0.05]"
                      )}
                    >
                      <input
                        type="radio"
                        name="reportType"
                        value={t}
                        checked={on}
                        onChange={() => set("reportType", t)}
                        className="sr-only"
                      />
                      <span aria-hidden className={cn("h-3 w-3 flex-none rounded-full border", on ? "border-[#f2f1ed] bg-[#f2f1ed]" : "border-[#1c1b19]/50")} />
                      {REPORT_TYPE_LABEL[t]}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor={`${uid}-observation`} className="mb-2 block text-[15px] italic text-[#47433c]">
                Observation
              </label>
              <textarea
                id={`${uid}-observation`}
                rows={4}
                value={form.observation}
                onChange={(e) => set("observation", e.target.value)}
                aria-invalid={Boolean(errors.observation)}
                aria-describedby={`${uid}-observation-help`}
                placeholder="The registrar counter asked for a stamped hard copy before endorsing the online form."
                className={cn(field, "resize-y py-3 leading-relaxed", errors.observation && "border-[#9a2b1e]")}
              />
              <p id={`${uid}-observation-help`} className={cn("mt-1.5 text-[14.5px]", errors.observation ? "text-[#9a2b1e]" : "italic text-[#6b655b]")}>
                {errors.observation ?? "What happened, where, and when."}
              </p>
            </div>

            <div>
              <label htmlFor={`${uid}-evidenceUrlOrRef`} className="mb-2 block text-[15px] italic text-[#47433c]">
                Evidence reference
              </label>
              <input
                id={`${uid}-evidenceUrlOrRef`}
                value={form.evidenceUrlOrRef}
                onChange={(e) => set("evidenceUrlOrRef", e.target.value)}
                aria-invalid={Boolean(errors.evidenceUrlOrRef)}
                aria-describedby={`${uid}-evidence-help`}
                placeholder="Transaction ID, memo number or photo reference"
                className={cn(field, "h-11", errors.evidenceUrlOrRef && "border-[#9a2b1e]")}
              />
              <p id={`${uid}-evidence-help`} className={cn("mt-1.5 text-[14.5px]", errors.evidenceUrlOrRef ? "text-[#9a2b1e]" : "italic text-[#6b655b]")}>
                {errors.evidenceUrlOrRef ?? "Something another applicant could check. No personal phone numbers."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#1c1b19]/15 px-7 py-4">
            <p className="hidden text-[14px] italic text-[#6b655b] sm:block">Never changes official policy.</p>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending} aria-busy={pending} className="min-w-[150px]">
                {pending ? (
                  <>
                    <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Recording
                  </>
                ) : (
                  "Submit report"
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export function DiscrepancyDrawer() {
  const drawer = useUiStore((s) => s.drawer);
  const close = useUiStore((s) => s.closeDrawer);
  return (
    <Overlay open={drawer !== null} onClose={close} label="Flag a discrepancy" placement="right">
      {drawer && <DrawerBody key={`${drawer.noticeId}-${drawer.requirementId}`} initial={drawer} onClose={close} />}
    </Overlay>
  );
}
