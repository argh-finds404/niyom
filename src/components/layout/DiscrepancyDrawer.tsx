"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Clock, FilePen, ShieldAlert, Split, X, type LucideIcon } from "lucide-react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { versionOf } from "@/hooks/useDossierIntelligence";
import { communityReportInputSchema, type CommunityReportInput } from "@/domain";
import type { CommunityReport } from "@/domain/types";
import { CATEGORY_LABEL, REPORT_TYPE_LABEL, shortTitle } from "@/lib/format";
import { chapterOf } from "@/lib/chapters";
import { Select } from "@/components/ui/Select";
import { Button, Overlay, buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<keyof CommunityReportInput, string>>;

/** What each kind of report means, in a line, with a mark you can find again. */
const REPORT_KINDS: Record<CommunityReportInput["reportType"], { icon: LucideIcon; hint: string }> = {
  requirement_changed: { icon: FilePen, hint: "An office asks for something the notice does not" },
  contradictory_instruction: { icon: Split, hint: "Two offices say different things" },
  service_delay: { icon: Clock, hint: "A paper takes longer than stated" },
  outdated_or_scam: { icon: ShieldAlert, hint: "An old or fake copy is going round" },
};

const field =
  "w-full rounded-[var(--r-control)] border border-[#1c1b19]/20 bg-white/60 px-3.5 text-[17px] transition-[border-color,background-color,box-shadow] duration-200 placeholder:italic placeholder:text-[#8a847a] hover:border-[#1c1b19]/55 hover:bg-white/80 focus:border-[#1c1b19] focus:bg-white focus:shadow-[0_0_0_4px_rgba(28,27,25,0.07)] focus:outline-none";

function DrawerBody({ initial, onClose }: { initial: { noticeId?: string; requirementId?: string }; onClose: () => void }) {
  const notices = useNiyomStore((s) => s.notices);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const submit = useNiyomStore((s) => s.submitCommunityReport);
  const toast = useUiStore((s) => s.toast);
  const uid = useId();

  const initialNotice = notices.find((n) => n.id === (initial.noticeId ?? activeNoticeId)) ?? notices[0];
  const initialReqs = versionOf(initialNotice, initialNotice.activeVersionNumber).requirements;

  const [form, setForm] = useState<CommunityReportInput>({
    noticeId: initialNotice.id,
    requirementId: initial.requirementId && initialReqs.some((r) => r.id === initial.requirementId) ? initial.requirementId : undefined,
    reportType: "requirement_changed",
    observation: "",
    evidenceUrlOrRef: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const notice = notices.find((n) => n.id === form.noticeId) ?? notices[0];
  const requirements = versionOf(notice, notice.activeVersionNumber).requirements;
  const validReqId = form.requirementId && requirements.some((r) => r.id === form.requirementId) ? form.requirementId : undefined;

  const set = <K extends keyof CommunityReportInput>(k: K, v: CommunityReportInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = communityReportInputSchema.safeParse({
      ...form,
      noticeId: notice.id,
      observation: form.observation.trim(),
      evidenceUrlOrRef: form.evidenceUrlOrRef.trim(),
      requirementId: validReqId,
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
              href={`/notice/${notice.id}${validReqId ? `#req-${validReqId}` : ""}`}
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
            <div className="space-y-5">
              <div>
                <label htmlFor={`${uid}-noticeId`} className="mb-2 block text-[15px] italic text-[#47433c]">
                  Dossier
                </label>
                <Select
                  id={`${uid}-noticeId`}
                  label="Dossier"
                  value={notice.id}
                  onChange={(v) => {
                    set("noticeId", v);
                    set("requirementId", undefined);
                  }}
                  options={notices.map((n) => ({
                    value: n.id,
                    label: shortTitle(n),
                    hint: CATEGORY_LABEL[n.category],
                    lead: <span aria-hidden data-cover={chapterOf(n.id)} className="h-8 w-6 flex-none rounded-[4px]" />,
                  }))}
                />
              </div>
              <div>
                <label htmlFor={`${uid}-requirementId`} className="mb-2 block text-[15px] italic text-[#47433c]">
                  Requirement <span className="text-[#6b655b]">(optional)</span>
                </label>
                <Select
                  id={`${uid}-requirementId`}
                  label="Requirement"
                  value={validReqId ?? ""}
                  onChange={(v) => set("requirementId", v || undefined)}
                  options={[
                    { value: "", label: "The dossier in general", hint: "Not about one requirement" },
                    ...requirements.map((r) => ({
                      value: r.id,
                      label: r.title,
                      lead: <span className="code w-[78px] flex-none text-[13px] text-[#6b655b]">{r.code}</span>,
                    })),
                  ]}
                />
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-[15px] italic text-[#47433c]">What did you observe?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(REPORT_TYPE_LABEL) as CommunityReportInput["reportType"][]).map((t) => {
                  const on = form.reportType === t;
                  const { icon: Icon, hint } = REPORT_KINDS[t];
                  return (
                    <label
                      key={t}
                      className={cn(
                        "group relative flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-200 has-[:focus-visible]:shadow-[0_0_0_3px_rgba(28,27,25,0.25)]",
                        on ? "border-[#1c1b19] bg-white shadow-[0_10px_24px_-16px_rgba(28,27,25,0.5)]" : "border-[#1c1b19]/15 bg-white/40 hover:border-[#1c1b19]/40 hover:bg-white/70"
                      )}
                    >
                      <input type="radio" name="reportType" value={t} checked={on} onChange={() => set("reportType", t)} className="sr-only" />
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-9 w-9 flex-none place-items-center rounded-[9px] transition-colors duration-200",
                          on ? "bg-[#1c1b19] text-[#f4f1ea]" : "bg-[#1c1b19]/[0.06] text-[#47433c]"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-semibold leading-snug">{REPORT_TYPE_LABEL[t]}</span>
                        <span className="mt-0.5 block text-[13.5px] leading-snug text-[#6b655b]">{hint}</span>
                      </span>
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
                maxLength={600}
                value={form.observation}
                onChange={(e) => set("observation", e.target.value)}
                aria-invalid={Boolean(errors.observation)}
                aria-describedby={`${uid}-observation-help`}
                placeholder="The registrar counter asked for a stamped hard copy before endorsing the online form."
                className={cn(field, "min-h-[120px] resize-y py-3 leading-relaxed", errors.observation && "border-[#9a2b1e]")}
              />
              <p id={`${uid}-observation-help`} className={cn("mt-1.5 flex justify-between gap-4 text-[14.5px]", errors.observation ? "text-[#9a2b1e]" : "italic text-[#6b655b]")}>
                <span>{errors.observation ?? "At least 15 characters: what happened, where, and when."}</span>
                <span className="num flex-none not-italic text-[#6b655b]">{form.observation.length}/600</span>
              </p>
            </div>

            <div>
              <label htmlFor={`${uid}-evidenceUrlOrRef`} className="mb-2 block text-[15px] italic text-[#47433c]">
                Evidence reference
              </label>
              <input
                id={`${uid}-evidenceUrlOrRef`}
                maxLength={200}
                value={form.evidenceUrlOrRef}
                onChange={(e) => set("evidenceUrlOrRef", e.target.value)}
                aria-invalid={Boolean(errors.evidenceUrlOrRef)}
                aria-describedby={`${uid}-evidence-help`}
                placeholder="Transaction ID, memo number or photo reference"
                className={cn(field, "h-12", errors.evidenceUrlOrRef && "border-[#9a2b1e]")}
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
