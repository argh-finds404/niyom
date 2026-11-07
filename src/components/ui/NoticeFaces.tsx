"use client";

import type { Notice, NoticeVersion } from "@/domain/types";
import type { ObjectKind } from "@/lib/chapters";
import { formatDate, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FaceProps {
  notice: Notice;
  version: NoticeVersion;
  index: number;
  /** Requirements that differ from the previous version (highlighted lines). */
  changed: number;
  /** Of those, how many matter (drives the stamp colour). */
  consequential: number;
  dropping: boolean;
  colors: { cover: string; ink: string };
  compact?: boolean;
}

/** Stack geometry per object: the stage's aspect, where a sheet sits, and how the stack fans. */
export const LAYOUT: Record<ObjectKind, { aspect: string; left: string; top: string; width: string; item: string; dx: number; dy: number }> = {
  circular: { aspect: "1/1.18", left: "14%", top: "6%", width: "66%", item: "1/1.36", dx: -9, dy: -5 },
  ticket: { aspect: "1/0.86", left: "3%", top: "30%", width: "93%", item: "2.15/1", dx: -2.5, dy: -18 },
  code: { aspect: "1/0.98", left: "6%", top: "20%", width: "84%", item: "1.38/1", dx: -4, dy: -11 },
  passport: { aspect: "1/1.12", left: "20%", top: "7%", width: "58%", item: "0.71/1", dx: -13, dy: -4 },
};

const INK = "#1c1b19";
const MUTED = "#6b655b";
const HIGHLIGHT = "rgba(233, 196, 106, 0.85)";
const LINE = "rgba(28,27,25,0.12)";

function Lines({ count, changed, widths, dark = false, gap = "2.6cqw", h = "1.6cqw" }: { count: number; changed: number; widths: number[]; dark?: boolean; gap?: string; h?: string }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {Array.from({ length: count }).map((_, l) => {
        const hot = l >= 1 && l < 1 + changed;
        return (
          <span
            key={l}
            className="block rounded-full"
            style={{
              height: h,
              width: `${widths[l % widths.length]}%`,
              background: hot ? HIGHLIGHT : dark ? "rgba(255,255,255,0.16)" : LINE,
            }}
          />
        );
      })}
    </div>
  );
}

/** A rubber stamp. Lands with a thump when its version has just arrived. */
function RubberStamp({ label, critical, dropping, className }: { label: string; critical: boolean; dropping: boolean; className?: string }) {
  return (
    <span
      key={dropping ? "drop" : "rest"}
      className={cn(
        "code absolute rotate-[-9deg] rounded-[1cqw] border-[0.6cqw] px-[2.4cqw] py-[0.6cqw] leading-tight opacity-[0.88]",
        critical ? "border-[#9a2b1e] text-[#9a2b1e]" : "border-[#6b655b] text-[#6b655b]",
        dropping && "stamp-thump",
        className
      )}
    >
      {label}
    </span>
  );
}

/* ───────────── Scholarship: the official circular ───────────── */

function CircularFace({ notice, version, index, changed, consequential, dropping, colors, compact }: FaceProps) {
  const source = notice.sources[0];
  const corrigendum = /corrigendum/i.test(version.versionLabel);
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[4px] bg-[#fcfbf8]" style={{ color: INK }}>
      <div className="flex h-full flex-col p-[9cqw]">
        <p className="code truncate text-[4.4cqw] leading-tight" style={{ color: MUTED }}>
          {source?.authority}
        </p>
        <p className="mt-[3cqw] line-clamp-3 text-[7.4cqw] font-semibold leading-[1.12] tracking-[-0.01em]">{notice.title}</p>
        <span className="mt-[4cqw] block h-px w-[16cqw]" style={{ background: INK }} />
        <p className="mt-[3cqw] text-[5.2cqw] italic leading-tight">
          {versionTag(version.versionLabel)} · {version.versionLabel.split(" ").slice(1).join(" ")}
        </p>
        <p className="num mt-[1cqw] text-[4.4cqw]" style={{ color: MUTED }}>
          {formatDate(version.publishedAt)}
        </p>
        {!compact && (
          <div className="mt-[6cqw]">
            <Lines count={8} changed={changed} widths={[96, 88, 92, 74, 90, 82, 94, 60]} />
          </div>
        )}
        <p className="mt-auto truncate pr-[18cqw] text-[3.8cqw]" style={{ color: MUTED }}>
          {source?.documentTitle}
        </p>
      </div>
      {/* The issuing office's seal. */}
      <span
        aria-hidden
        className="absolute bottom-[6cqw] right-[7cqw] grid h-[15cqw] w-[15cqw] place-items-center rounded-full border-[0.5cqw]"
        style={{ borderColor: `${colors.cover}66` }}
      >
        <span className="h-[10.5cqw] w-[10.5cqw] rounded-full border-[0.35cqw] border-dashed" style={{ borderColor: `${colors.cover}55` }} />
      </span>
      {index > 0 && (
        <RubberStamp
          label={corrigendum ? "Corrigendum" : "Addendum"}
          critical={corrigendum && consequential > 0}
          dropping={dropping}
          className="right-[7cqw] top-[40%] text-[5.4cqw]"
        />
      )}
    </div>
  );
}

/* ───────────── Digital service: the e-ticket ───────────── */

function TrainGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-auto" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3" width="14" height="14" rx="3.5" />
      <path d="M5 10h14M9 21l-2 0M15 21l2 0M8.5 17l-1.5 4M15.5 17l1.5 4" />
      <circle cx="9" cy="13.5" r="0.9" fill={color} />
      <circle cx="15" cy="13.5" r="0.9" fill={color} />
    </svg>
  );
}

function TicketFace({ version, index, changed, consequential, dropping, colors }: FaceProps) {
  // Two notches where the stub tears off, cut with a mask so the ticket sits on any ground.
  const notch =
    "radial-gradient(circle at 72% 0, transparent 2.7cqw, #000 2.8cqw) top / 100% 51% no-repeat, radial-gradient(circle at 72% 100%, transparent 2.7cqw, #000 2.8cqw) bottom / 100% 51% no-repeat";
  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-[2.4cqw] bg-[#fcfbf8]" style={{ color: INK, mask: notch, WebkitMask: notch }}>
      <div className="flex w-[72%] flex-col">
        <div className="flex items-center justify-between px-[4cqw] py-[2.2cqw]" style={{ background: colors.cover, color: colors.ink }}>
          <span className="code text-[2.7cqw] leading-none">Bangladesh Railway · e-ticket</span>
          <span className="h-[3.6cqw]">
            <TrainGlyph color={colors.ink} />
          </span>
        </div>
        <div className="flex flex-1 flex-col px-[4cqw] py-[2.8cqw]">
          <p className="text-[4.8cqw] font-semibold leading-none tracking-[-0.01em]">Dhaka → Rajshahi</p>
          <p className="mt-[1.4cqw] text-[2.7cqw] italic" style={{ color: MUTED }}>
            Cancellation & refund terms {versionTag(version.versionLabel)}, {formatDate(version.publishedAt)}
          </p>
          <div className="mt-auto">
            <Lines count={4} changed={changed} widths={[94, 80, 88, 62]} gap="1.3cqw" h="1.1cqw" />
          </div>
        </div>
      </div>
      <div className="flex w-[28%] flex-col justify-between border-l-[0.35cqw] border-dashed px-[3cqw] py-[3cqw]" style={{ borderColor: "rgba(28,27,25,0.28)" }}>
        <div>
          <p className="code text-[2.4cqw]" style={{ color: MUTED }}>
            PNR
          </p>
          <p className="num text-[3cqw] font-semibold tracking-[0.12em]">•••• ••••</p>
        </div>
        <p className="code text-[5cqw] leading-none">{versionTag(version.versionLabel)}</p>
        {/* Barcode */}
        <div className="flex h-[7cqw] items-stretch gap-[0.45cqw]">
          {[2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2].map((w, i) => (
            <span key={i} style={{ width: `${w * 0.35}cqw`, background: INK, opacity: 0.85 }} />
          ))}
        </div>
      </div>
      {index > 0 && (
        <RubberStamp label="Revised terms" critical={consequential > 0} dropping={dropping} className="left-[30%] top-[46%] text-[3.4cqw]" />
      )}
    </div>
  );
}

/* ───────────── Internship: the code window ───────────── */

function CodeFace({ version, index, changed, consequential, dropping, colors }: FaceProps) {
  const bars = [
    [62, "#c3b878"],
    [84, "#e7e6f6"],
    [48, "#9fd3b2"],
    [76, "#e7e6f6"],
    [90, "#f0c879"],
    [56, "#e7e6f6"],
    [70, "#9fd3b2"],
  ] as const;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[2.6cqw]" style={{ background: "#15164a", color: "#e7e6f6" }}>
      <div className="flex h-[8cqw] items-center gap-[1.3cqw] px-[3.2cqw]" style={{ background: "rgba(255,255,255,0.06)" }}>
        {["#f2a39a", "#f0c879", "#9fd3b2"].map((c) => (
          <span key={c} className="h-[1.7cqw] w-[1.7cqw] rounded-full opacity-80" style={{ background: c }} />
        ))}
        <span className="ml-[2cqw] truncate text-[2.8cqw] opacity-70">fellowship-2026.md</span>
        <span className="code ml-auto text-[2.8cqw]" style={{ color: colors.cover }}>
          {versionTag(version.versionLabel)}
        </span>
      </div>
      <div className="px-[3.4cqw] pt-[3.2cqw]">
        <p className="text-[3.6cqw] font-semibold leading-none" style={{ color: colors.cover }}>
          # ICT SE Fellowship 2026
        </p>
        <div className="mt-[3cqw] flex flex-col gap-[1.6cqw]">
          {bars.map(([w, c], l) => {
            const hot = l >= 1 && l < 1 + changed;
            return (
              <div
                key={l}
                className="-mx-[1.4cqw] flex items-center gap-[2.2cqw] rounded-[0.8cqw] px-[1.4cqw] py-[0.5cqw]"
                style={{ background: hot ? "rgba(240,200,121,0.16)" : "transparent" }}
              >
                <span className="num w-[3cqw] text-right text-[2.2cqw] opacity-35">{l + 1}</span>
                <span className="text-[2.4cqw] leading-none" style={{ color: hot ? "#f0c879" : "transparent" }}>
                  +
                </span>
                <span className="block h-[1.5cqw] rounded-full" style={{ width: `${w * 0.78}%`, background: c, opacity: hot ? 0.95 : 0.55 }} />
                {l === bars.length - 1 && <span className="caret-blink h-[3cqw] w-[0.6cqw]" style={{ background: "#e7e6f6" }} />}
              </div>
            );
          })}
        </div>
      </div>
      {index > 0 && (
        <span
          key={dropping ? "drop" : "rest"}
          className={cn(
            "code absolute bottom-[3cqw] right-[3.4cqw] rounded-[1cqw] px-[1.6cqw] py-[0.5cqw] text-[2.8cqw]",
            dropping && "stamp-thump"
          )}
          style={{ background: consequential > 0 ? "#9a2b1e" : "rgba(255,255,255,0.12)", color: "#fcfbf8" }}
        >
          Revised
        </span>
      )}
    </div>
  );
}

/* ───────────── Public procedure: the passport booklet ───────────── */

function Globe({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" fill="none" stroke={color} strokeWidth="1.1" aria-hidden>
      <circle cx="20" cy="20" r="15" />
      <ellipse cx="20" cy="20" rx="7" ry="15" />
      <path d="M5 20h30M7.5 12.5h25M7.5 27.5h25M20 5v30" />
    </svg>
  );
}

function PassportFace({ notice, version, index, changed, consequential, dropping, colors }: FaceProps) {
  return (
    <div className="absolute inset-0 [perspective:900px]">
      {/* Inside page: the checklist for this version. */}
      <div className="absolute inset-0 overflow-hidden rounded-[3cqw] rounded-l-[1.4cqw] bg-[#fbf6ee] p-[9cqw]" style={{ color: INK }}>
        <p className="code text-[4cqw]" style={{ color: MUTED }}>
          Document checklist
        </p>
        <p className="mt-[2cqw] text-[5.4cqw] italic leading-tight">{version.versionLabel.split(" ").slice(1).join(" ")}</p>
        <p className="num mt-[1cqw] text-[4cqw]" style={{ color: MUTED }}>
          {versionTag(version.versionLabel)}, {formatDate(version.publishedAt)}
        </p>
        <div className="mt-[7cqw]">
          <Lines count={6} changed={changed} widths={[90, 76, 84, 66, 88, 58]} gap="3.2cqw" h="2cqw" />
        </div>
        {index > 0 && (
          <RubberStamp label="Amended" critical={consequential > 0} dropping={dropping} className="bottom-[10cqw] right-[8cqw] text-[6cqw]" />
        )}
      </div>
      {/* The cover swings open on hover. */}
      <div
        className="absolute inset-0 origin-left overflow-hidden rounded-[3cqw] rounded-l-[1.4cqw] transition-transform duration-700 ease-spring [backface-visibility:hidden] group-hover/obj:[transform:rotateY(-64deg)] motion-reduce:transition-none"
        style={{ background: colors.cover, color: "#d9b77a" }}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[7cqw]" style={{ background: "rgba(0,0,0,0.18)" }} />
        <div className="flex h-full flex-col items-center px-[10cqw] pb-[10cqw] pt-[12cqw] text-center">
          <p className="code text-[5.6cqw] tracking-[0.28em]">Passport</p>
          <div className="mt-[10cqw] h-[34cqw] w-[34cqw]">
            <Globe color="#d9b77a" />
          </div>
          <p className="mt-[8cqw] text-[4.4cqw] italic leading-tight opacity-90">{notice.departmentOrTrust}</p>
          {/* ICAO-style chip mark: a rectangle with a circle */}
          <span aria-hidden className="mt-auto grid h-[7cqw] w-[11cqw] place-items-center rounded-[1cqw] border-[0.5cqw]" style={{ borderColor: "#d9b77a" }}>
            <span className="h-[3.2cqw] w-[3.2cqw] rounded-full border-[0.5cqw]" style={{ borderColor: "#d9b77a" }} />
          </span>
        </div>
        {/* A paper slip tucked into the cover says which version this is. */}
        <span
          className="code absolute right-[-1cqw] top-[16cqw] rounded-l-[1.4cqw] bg-[#fbf6ee] py-[1.2cqw] pl-[2.4cqw] pr-[3.4cqw] text-[4cqw] shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
          style={{ color: INK }}
        >
          {versionTag(version.versionLabel)}
        </span>
      </div>
    </div>
  );
}

export const FACES: Record<ObjectKind, (p: FaceProps) => React.ReactNode> = {
  circular: CircularFace,
  ticket: TicketFace,
  code: CodeFace,
  passport: PassportFace,
};

/** A small line drawing of each object, for covers and tiles. */
export function KindGlyph({ kind, className }: { kind: ObjectKind; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...common}>
      {kind === "circular" && (
        <>
          <path d="M13 6h17l7 7v29H13z" />
          <path d="M30 6v7h7M18 18h14M18 23h14M18 28h9" />
          <circle cx="31" cy="35" r="3.5" />
        </>
      )}
      {kind === "ticket" && (
        <>
          <path d="M5 15h38v6a3 3 0 0 0 0 6v6H5v-6a3 3 0 0 0 0-6z" />
          <path d="M31 15v18" strokeDasharray="2 2.5" />
          <path d="M10 21h15M10 26h10" />
        </>
      )}
      {kind === "code" && (
        <>
          <rect x="5" y="9" width="38" height="30" rx="3.5" />
          <path d="M5 16h38" />
          <path d="M19 23l-5 4 5 4M29 23l5 4-5 4M26 21l-4 12" />
        </>
      )}
      {kind === "passport" && (
        <>
          <rect x="11" y="5" width="26" height="38" rx="3" />
          <circle cx="24" cy="20" r="7" />
          <path d="M17 20h14M24 13c-3 4-3 10 0 14M24 13c3 4 3 10 0 14" />
          <rect x="20" y="33" width="8" height="5" rx="1" />
        </>
      )}
    </svg>
  );
}
