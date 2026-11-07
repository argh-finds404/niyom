"use client";

import { X } from "lucide-react";
import { useUiStore } from "@/hooks/useUiStore";
import { Button, Label, Overlay } from "@/components/ui/primitives";

const STEPS: [string, string][] = [
  [
    "Every notice is kept as versions.",
    "When an institution republishes a circular, NIYOM stores the new version beside the old one instead of replacing it.",
  ],
  [
    "Cosmetic edits are ignored.",
    "A changed helpdesk room or email is marked informational and never touches your checklist.",
  ],
  [
    "Your checks remember what you checked.",
    "Each tick records the exact wording you prepared against. If a later version changes that wording, the tick turns stale until you re-verify.",
  ],
  [
    "Follow a notice and NIYOM tells you when it changes.",
    "The bell shows each revision of a notice you follow, how many changes matter, and which of your checks it made stale. Deadlines can go straight into your calendar.",
  ],
  [
    "Official text, conflicts and field reports stay apart.",
    "When two official sources disagree, both are quoted. What applicants report from counters is shown separately and never rewrites policy.",
  ],
];

const KEYS: [string, string][] = [
  ["Ctrl K", "Search dossiers, requirement codes and actions"],
  ["?", "Open this guide"],
  ["Esc", "Close any panel"],
];

export function HelpSheet() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);
  const close = () => setOpen(false);
  return (
    <Overlay open={open} onClose={close} label="How NIYOM works" placement="right">
      <div className="ov-right flex h-full flex-col overflow-y-auto bg-paper text-[#1c1b19] shadow-[-30px_0_80px_-40px_rgba(28,27,25,0.5)] sm:rounded-l-[var(--r-panel)]">
        <div className="flex items-start justify-between gap-6 px-7 pb-2 pt-7">
          <div>
            <h2 className="display text-[32px]">How NIYOM works</h2>
            <p className="mt-1 text-[18px] italic text-[#47433c]">Be ready. Not just informed.</p>
          </div>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={close} className="-mr-2">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ol className="mt-6 space-y-7 px-7">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[28px_1fr] gap-x-3">
              <span className="num pt-0.5 text-[18px] italic text-[#6b655b]">{i + 1}.</span>
              <div>
                <p className="text-[18px] font-semibold leading-snug">{title}</p>
                <p className="mt-1 text-[16px] leading-relaxed text-[#47433c]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10 px-7 pb-10">
          <Label as="h3">Keyboard</Label>
          <dl className="mt-4 divide-y divide-[#1c1b19]/12">
            {KEYS.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6 py-2.5">
                <dt className="num rounded-[6px] border border-[#1c1b19]/25 px-1.5 text-[14px]">{k}</dt>
                <dd className="text-right text-[15.5px] text-[#47433c]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-[15px] italic leading-relaxed text-[#6b655b]">
            Your checklist and profile are saved on this device and backed up to the server under an anonymous device cookie. The dossiers are an illustrative dataset.
          </p>
        </div>
      </div>
    </Overlay>
  );
}
