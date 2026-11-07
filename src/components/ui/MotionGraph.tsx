"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Film, FolderKanban, Pause, Play, Sparkles } from "lucide-react";
import type { PreparationTimeline, SharedFolderGroup } from "@/domain";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MotionGraphProps {
  dossierTitle: string;
  versionLabel: string;
  timeline: PreparationTimeline;
  sharedGroups: SharedFolderGroup[];
  activeNoticeId: string;
  onInspectRequirement?: (requirementId: string) => void;
  onSelectDossierRequirement?: (noticeId: string, requirementId: string) => void;
  defaultTab?: "sequence" | "folders";
}

const STAGE_META = [
  {
    stage: 1 as const,
    title: "Civic & Treasury Counters",
    subtitle: "UNO / Ward · Bank Challan · Academic Record",
    x: 130,
  },
  {
    stage: 2 as const,
    title: "Institutional Attestation",
    subtitle: "Controller of Exams · Registrar · Dept Head",
    x: 450,
  },
  {
    stage: 3 as const,
    title: "Final Dossier Submission",
    subtitle: "Portal Upload · Physical Receiving Desk",
    x: 770,
  },
];

export function MotionGraph({
  dossierTitle,
  versionLabel,
  timeline,
  sharedGroups,
  activeNoticeId,
  onInspectRequirement,
  onSelectDossierRequirement,
  defaultTab = "sequence",
}: MotionGraphProps) {
  const [tab, setTab] = useState<"sequence" | "folders">(defaultTab);
  const [activeStage, setActiveStage] = useState<1 | 2 | 3>(1);
  const [activeFolderIdx, setActiveFolderIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const reelVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = reelVideoRef.current;
    if (!v) return;
    if (playing) {
      void v.play().catch(() => {
        // Ignore autoplay restrictions in headless/test environments.
      });
    } else {
      v.pause();
    }
  }, [playing, tab]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (tab === "sequence") {
        setActiveStage((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
      } else if (sharedGroups.length > 0) {
        setActiveFolderIdx((prev) => (prev + 1) % sharedGroups.length);
      }
    }, 3400);
    return () => window.clearInterval(timer);
  }, [playing, tab, sharedGroups.length]);

  const stageGroups = STAGE_META.map((meta) => {
    const items = timeline.steps.filter((s) => s.stage === meta.stage);
    const totalDays = items.reduce((acc, s) => acc + s.leadDays, 0);
    const remainingDays = items
      .filter((s) => s.status !== "completed")
      .reduce((acc, s) => acc + s.leadDays, 0);
    const doneCount = items.filter((s) => s.status === "completed").length;
    const staleCount = items.filter((s) => s.status === "needs_reverification").length;
    return {
      ...meta,
      items,
      totalDays,
      remainingDays,
      doneCount,
      staleCount,
    };
  });

  const currentStage = stageGroups.find((s) => s.stage === activeStage) ?? stageGroups[0];
  const currentFolder = sharedGroups[activeFolderIdx] ?? sharedGroups[0];

  const scheduleTone =
    timeline.scheduleStatus === "complete"
      ? "bg-ok/12 text-ok"
      : timeline.scheduleStatus === "behind"
        ? "bg-crit/12 text-crit"
        : timeline.scheduleStatus === "tight"
          ? "bg-warn/15 text-warn"
          : "bg-info/12 text-info";

  const scheduleLabel =
    timeline.scheduleStatus === "complete"
      ? "All office counters cleared"
      : timeline.remainingLeadDays === 0
        ? "0 working days remaining"
        : `${timeline.remainingLeadDays} working day${timeline.remainingLeadDays === 1 ? "" : "s"} of office lead-time left`;

  return (
    <section
      aria-label="Interactive Preparation Motion Graph and Shared Folder Matrix"
      className="relative overflow-hidden rounded-[var(--r-panel)] bg-paper shadow-[inset_0_0_0_1px_var(--hair)] print:hidden"
    >
      {/* Subtle Gemini copperplate architectural plate header wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-cover bg-center opacity-[0.06] mix-blend-multiply"
        style={{
          backgroundImage: "url('/media/archive-plate.jpg')",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1), transparent)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1), transparent)",
        }}
      />

      <div className="relative z-10 p-5 sm:p-7">
        {/* Top bar: Title + Mode Switcher + Reel Play/Pause */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-3">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <Sparkles className="h-3.5 w-3.5 text-warn" />
                Counter-Day &amp; Folder Intelligence
              </span>
              <span>·</span>
              <span>
                {dossierTitle} ({versionLabel})
              </span>
              <span>·</span>
              <span className="num">Sun–Thu BD working calendar</span>
            </div>
            <h3 className="display mt-1.5 text-[24px] sm:text-[27px]">
              {tab === "sequence"
                ? "Office Lead-Time & Safe-Start Sequence"
                : "Shared Physical Folder Reuse Across Dossiers"}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Intelligence graph mode"
              className="inline-flex rounded-[var(--r-control)] bg-ground p-1 shadow-[inset_0_0_0_1px_var(--hair)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "sequence"}
                onClick={() => setTab("sequence")}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[14px] transition-colors",
                  tab === "sequence"
                    ? "bg-ink font-medium text-ground"
                    : "text-ink-2 hover:text-ink"
                )}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Counter sequence
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "folders"}
                onClick={() => setTab("folders")}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[14px] transition-colors",
                  tab === "folders"
                    ? "bg-ink font-medium text-ground"
                    : "text-ink-2 hover:text-ink"
                )}
              >
                <FolderKanban className="h-3.5 w-3.5" />
                Shared folder ({sharedGroups.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause motion reel" : "Play motion reel"}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-control)] bg-ground px-3 text-[13.5px] text-ink-2 shadow-[inset_0_0_0_1px_var(--hair)] transition-colors hover:bg-sunken hover:text-ink"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{playing ? "Live reel" : "Paused"}</span>
            </button>
          </div>
        </div>

        {/* Synchronized Editorial Motion Video + Live Stage Caption Strip */}
        <div className="mt-5 grid grid-cols-1 items-center gap-4 rounded-[var(--r-card)] bg-ground p-3.5 shadow-[inset_0_0_0_1px_var(--hair)] md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative aspect-video w-full overflow-hidden rounded-[6px] bg-paper shadow-[inset_0_0_0_1px_var(--hair)]">
            <video
              ref={reelVideoRef}
              key={tab}
              src={
                tab === "sequence"
                  ? "/media/archive-engraving-loop.mp4"
                  : "/media/editorial-ledger-reel.mp4"
              }
              poster="/media/archive-plate.jpg"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover opacity-90 mix-blend-multiply"
            />
            <span className="pointer-events-none absolute bottom-1.5 left-2 inline-flex items-center gap-1 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium text-ground">
              <Film className="h-3 w-3" />
              {tab === "sequence" ? "Engraved Flow" : "Ledger Reel"}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14.5px]">
              <span className={cn("rounded-full px-2.5 py-0.5 text-[13px] font-medium num", scheduleTone)}>
                {scheduleLabel}
              </span>
              {timeline.latestSafeStartDate && timeline.remainingLeadDays > 0 && (
                <span className="text-ink-2 num">
                  Latest safe start:{" "}
                  <strong className="font-semibold text-ink">
                    {formatDate(timeline.latestSafeStartDate)}
                  </strong>{" "}
                  <span className="text-ink-3">(skips Fri–Sat closed counters)</span>
                </span>
              )}
              {timeline.deadlineDate && (
                <span className="text-ink-3 num">
                  Filing deadline:{" "}
                  <strong className="font-medium text-ink-2">
                    {formatDate(timeline.deadlineDate)}
                  </strong>
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[14.5px] leading-snug text-ink-2">
              {tab === "sequence" ? (
                <>
                  Active reel stage:{" "}
                  <strong className="font-semibold text-ink">
                    Stage {currentStage.stage} · {currentStage.title}
                  </strong>{" "}
                  ({currentStage.doneCount}/{currentStage.items.length} verified ·{" "}
                  {timeline.completedLeadDays} of {timeline.totalLeadDays} total office days cleared).
                </>
              ) : (
                <>
                  Active folder pocket:{" "}
                  <strong className="font-semibold text-ink">
                    {currentFolder?.folderItemTitle}
                  </strong>{" "}
                  — linked across {currentFolder?.peers.length ?? 0} institutional requirements by strictness tier.
                </>
              )}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {tab === "sequence" ? (
            <motion.div
              key="sequence-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5"
            >
              {/* Animated SVG 3-Stage Flow Graph */}
              <div className="overflow-x-auto rounded-[var(--r-card)] bg-ground/70 p-4 shadow-[inset_0_0_0_1px_var(--hair)]">
                <svg
                  viewBox="0 0 900 185"
                  className="min-w-[640px] w-full h-auto select-none"
                  role="img"
                  aria-label="Three-stage institutional counter flow"
                >
                  <defs>
                    <linearGradient id="niyomFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--warn)" stopOpacity="0.55" />
                      <stop offset="50%" stopColor="var(--info)" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="var(--ok)" stopOpacity="0.75" />
                    </linearGradient>
                  </defs>

                  {/* Subtle ledger grid lines */}
                  <line x1="40" y1="88" x2="860" y2="88" stroke="var(--hair)" strokeWidth="1" />
                  <path
                    d="M 130 88 C 245 36, 335 140, 450 88 C 565 36, 655 140, 770 88"
                    fill="none"
                    stroke="url(#niyomFlowGrad)"
                    strokeWidth="2.2"
                    strokeDasharray="6 6"
                  >
                    {playing && (
                      <animate
                        attributeName="stroke-dashoffset"
                        from="48"
                        to="0"
                        dur="2.8s"
                        repeatCount="indefinite"
                      />
                    )}
                  </path>

                  {stageGroups.map((sg) => {
                    const isSelected = sg.stage === activeStage;
                    const allDone = sg.items.length > 0 && sg.remainingDays === 0;
                    const hasStale = sg.staleCount > 0;
                    const strokeColor = hasStale
                      ? "var(--crit)"
                      : allDone
                        ? "var(--ok)"
                        : isSelected
                          ? "var(--ink)"
                          : "var(--hair)";

                    return (
                      <g
                        key={sg.stage}
                        onClick={() => {
                          setPlaying(false);
                          setActiveStage(sg.stage);
                        }}
                        className="cursor-pointer"
                      >
                        {isSelected && (
                          <circle
                            cx={sg.x}
                            cy={88}
                            r={38}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="1.25"
                            strokeDasharray="3 4"
                            opacity="0.55"
                          >
                            {playing && (
                              <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`0 ${sg.x} 88`}
                                to={`360 ${sg.x} 88`}
                                dur="14s"
                                repeatCount="indefinite"
                              />
                            )}
                          </circle>
                        )}
                        <circle
                          cx={sg.x}
                          cy={88}
                          r={28}
                          fill={isSelected ? "var(--ink)" : "var(--paper)"}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? "2.5" : "1.5"}
                        />
                        <text
                          x={sg.x}
                          y={84}
                          textAnchor="middle"
                          fill={isSelected ? "var(--ground)" : "var(--ink)"}
                          fontSize="12"
                          fontWeight="600"
                        >
                          STAGE {sg.stage}
                        </text>
                        <text
                          x={sg.x}
                          y={100}
                          textAnchor="middle"
                          fill={isSelected ? "var(--ground)" : "var(--ink-3)"}
                          fontSize="11"
                        >
                          {sg.remainingDays === 0 ? "Cleared" : `~${sg.remainingDays}d left`}
                        </text>

                        <text
                          x={sg.x}
                          y={28}
                          textAnchor="middle"
                          fill="var(--ink)"
                          fontSize="14"
                          fontWeight={isSelected ? "600" : "500"}
                        >
                          {sg.title}
                        </text>
                        <text
                          x={sg.x}
                          y={152}
                          textAnchor="middle"
                          fill="var(--ink-3)"
                          fontSize="11.5"
                        >
                          {sg.subtitle}
                        </text>
                        <text
                          x={sg.x}
                          y={170}
                          textAnchor="middle"
                          fill={hasStale ? "var(--crit)" : allDone ? "var(--ok)" : "var(--ink-2)"}
                          fontSize="11.5"
                          fontWeight="600"
                        >
                          {sg.doneCount}/{sg.items.length} ready
                          {hasStale ? ` · ${sg.staleCount} stale` : ""}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Active stage requirement cards */}
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-ink-3">
                  <span>
                    Showing{" "}
                    <strong className="font-semibold text-ink">
                      Stage {currentStage.stage}: {currentStage.title}
                    </strong>{" "}
                    — click any stage node above or requirement below to inspect
                  </span>
                  <div className="flex items-center gap-1.5">
                    {stageGroups.map((sg) => (
                      <button
                        key={sg.stage}
                        type="button"
                        onClick={() => {
                          setPlaying(false);
                          setActiveStage(sg.stage);
                        }}
                        className={cn(
                          "rounded px-2.5 py-1 text-[13px] transition-colors num",
                          sg.stage === activeStage
                            ? "bg-ink font-medium text-ground"
                            : "bg-ground text-ink-2 hover:bg-sunken"
                        )}
                      >
                        Stage {sg.stage} ({sg.remainingDays}d)
                      </button>
                    ))}
                  </div>
                </div>

                <motion.div
                  key={currentStage.stage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-3 grid gap-2.5 sm:grid-cols-2"
                >
                  {currentStage.items.map((step) => {
                    const isStale = step.status === "needs_reverification";
                    const isReady = step.status === "completed";
                    return (
                      <button
                        key={step.requirementId}
                        type="button"
                        onClick={() => onInspectRequirement?.(step.requirementId)}
                        className={cn(
                          "group flex flex-col justify-between rounded-[var(--r-card)] p-3.5 text-left transition-colors shadow-[inset_0_0_0_1px_var(--hair)]",
                          isStale
                            ? "bg-warn/[0.08] hover:bg-warn/[0.12]"
                            : isReady
                              ? "bg-ok/[0.04] hover:bg-ok/[0.08]"
                              : "bg-ground hover:bg-sunken"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[12.5px] font-medium text-ink-3">
                              {step.code} · {step.office}
                            </span>
                            <p className="mt-0.5 text-[16px] font-medium text-ink group-hover:underline">
                              {step.title}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-medium num",
                              isStale
                                ? "bg-warn/15 text-warn"
                                : isReady
                                  ? "bg-ok/15 text-ok"
                                  : "bg-ink/8 text-ink-2"
                            )}
                          >
                            {isReady
                              ? "Cleared"
                              : isStale
                                ? `Re-verify (~${step.leadDays}d)`
                                : `~${step.leadDays} working day${step.leadDays === 1 ? "" : "s"}`}
                          </span>
                        </div>
                        {step.evidenceNote ? (
                          <p className="mt-2 truncate rounded bg-paper/80 px-2 py-1 text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--hair)]">
                            Memo: <span className="font-medium text-ink">{step.evidenceNote}</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-[13px] text-ink-3">
                            Click to open Inspector &amp; record your office reference or serial memo →
                          </p>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </div>
            </motion.div>
          ) : (
            /* TAB 2: Shared Physical Folder Reuse Across Dossiers */
            <motion.div
              key="folders-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5"
            >
              {/* Folder pocket selector */}
              <div className="grid gap-2.5 sm:grid-cols-3">
                {sharedGroups.map((group, idx) => {
                  const selected = idx === activeFolderIdx;
                  const activeCount = group.peers.filter((p) => p.status !== "exempt").length;
                  return (
                    <button
                      key={group.groupId}
                      type="button"
                      onClick={() => {
                        setPlaying(false);
                        setActiveFolderIdx(idx);
                      }}
                      className={cn(
                        "rounded-[var(--r-card)] p-3.5 text-left transition-colors shadow-[inset_0_0_0_1px_var(--hair)]",
                        selected
                          ? "bg-ink text-ground"
                          : "bg-ground text-ink hover:bg-sunken"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className={selected ? "text-ground/75" : "text-ink-3"}>
                          Physical Folder Pocket #{idx + 1}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-medium num",
                            selected
                              ? "bg-ground/15 text-ground"
                              : group.reusableCount > 0
                                ? "bg-ok/15 text-ok"
                                : "bg-ink/8 text-ink-2"
                          )}
                        >
                          {group.reusableCount}/{activeCount} ready
                        </span>
                      </div>
                      <p className="mt-1 text-[16px] font-semibold leading-snug">
                        {group.folderItemTitle}
                      </p>
                      <p
                        className={cn(
                          "mt-1 line-clamp-2 text-[13px]",
                          selected ? "text-ground/80" : "text-ink-3"
                        )}
                      >
                        {group.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {currentFolder && (
                <motion.div
                  key={currentFolder.groupId}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-4 rounded-[var(--r-card)] bg-ground p-4 sm:p-5 shadow-[inset_0_0_0_1px_var(--hair)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                    <div>
                      <p className="text-[13px] font-medium uppercase tracking-wider text-ink-3">
                        Cross-Dossier Strictness &amp; Reuse Chain
                      </p>
                      <p className="mt-0.5 text-[15.5px] text-ink-2">
                        Preparing the highest-strictness version first satisfies every lower-strictness dossier in one counter visit.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                    {[...currentFolder.peers]
                      .sort((a, b) => b.strictnessRank - a.strictnessRank)
                      .map((peer, i) => {
                        const isCurrentDossier = peer.noticeId === activeNoticeId;
                        const isReady = peer.status === "completed";
                        const isStale = peer.status === "needs_reverification";

                        const coveredByOther =
                          !isReady &&
                          currentFolder.peers.find(
                            (other) =>
                              other.noticeId !== peer.noticeId &&
                              other.status === "completed" &&
                              other.strictnessRank >= peer.strictnessRank
                          );

                        return (
                          <button
                            key={`${peer.noticeId}-${peer.requirementId}`}
                            type="button"
                            onClick={() =>
                              onSelectDossierRequirement?.(peer.noticeId, peer.requirementId)
                            }
                            className={cn(
                              "flex flex-col justify-between rounded-[var(--r-card)] bg-paper p-3.5 text-left transition-colors shadow-[inset_0_0_0_1px_var(--hair)] hover:bg-sunken/70",
                              isCurrentDossier && "ring-1 ring-ink/35"
                            )}
                          >
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                                <span className="font-semibold text-ink">
                                  {i === 0 ? "★ Strictest standard · " : `Tier ${peer.strictnessRank} · `}
                                  {peer.strictnessLabel}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 font-medium",
                                    isReady
                                      ? "bg-ok/15 text-ok"
                                      : isStale
                                        ? "bg-warn/15 text-warn"
                                        : coveredByOther
                                          ? "bg-info/15 text-info"
                                          : "bg-ink/8 text-ink-3"
                                  )}
                                >
                                  {isReady
                                    ? "Ready in folder"
                                    : isStale
                                      ? "Stale check"
                                      : coveredByOther
                                        ? "Covered by your folder"
                                        : "Pending"}
                                </span>
                              </div>

                              <p className="mt-1.5 text-[15.5px] font-semibold text-ink">
                                {peer.noticeTitle}
                              </p>
                              <p className="mt-1 text-[13.5px] leading-snug text-ink-2">
                                {peer.value}
                              </p>
                            </div>

                            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[12.5px] text-ink-3">
                              <span className="truncate">
                                {peer.evidenceNote
                                  ? `Memo: ${peer.evidenceNote}`
                                  : coveredByOther
                                    ? `Satisfied by your ${coveredByOther.strictnessLabel} copy`
                                    : `${peer.code} · ${peer.title}`}
                              </span>
                              <span className="shrink-0 font-medium text-ink">
                                {isCurrentDossier ? "Inspect →" : "Switch & inspect →"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** Compact inline summary pill for Cross-Dossier Reuse or Safe-Start status. */
export function ReuseSummaryBadge({
  readyFolders,
  totalFolders,
}: {
  readyFolders: number;
  totalFolders: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-[13.5px] text-ink-2 shadow-[inset_0_0_0_1px_var(--hair)] num">
      <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
      {readyFolders}/{totalFolders} shared folder bundles active across notices
    </span>
  );
}
