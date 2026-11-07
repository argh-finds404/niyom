/** Every dossier is a "chapter" with its own colour world (see globals.css). */
export type Chapter = "merit" | "rail" | "ict" | "passport";

const CHAPTER: Record<string, Chapter> = {
  "notice-merit-2026": "merit",
  "service-railway-refund": "rail",
  "notice-ict-internship": "ict",
  "procedure-epassport-rajshahi": "passport",
};

export function chapterOf(noticeId: string): Chapter {
  return CHAPTER[noticeId] ?? "merit";
}

/** Full-strength colours per chapter, for drawn objects that sit on any ground. */
export const CHAPTER_COLORS: Record<Chapter, { cover: string; ink: string }> = {
  merit: { cover: "#1e3b2f", ink: "#e8dcb5" },
  rail: { cover: "#26213a", ink: "#e3c77e" },
  ict: { cover: "#c3b878", ink: "#18195c" },
  passport: { cover: "#5b1f2b", ink: "#f1d5c7" },
};

/** What each kind of dossier looks like as an object. */
export type ObjectKind = "circular" | "ticket" | "code" | "passport";

const KIND: Record<string, ObjectKind> = {
  scholarship: "circular",
  digital_service: "ticket",
  internship: "code",
  public_procedure: "passport",
};

export function kindOf(category: string): ObjectKind {
  return KIND[category] ?? "circular";
}
