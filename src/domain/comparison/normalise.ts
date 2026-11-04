export function normaliseText(value: string): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

