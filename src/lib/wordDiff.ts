export type DiffToken = { kind: "same" | "del" | "add"; text: string };

/**
 * Word-level diff (longest common subsequence over whitespace-separated words).
 * Requirement values are one sentence, so the O(n·m) table is tiny.
 */
export function wordDiff(before: string, after: string): DiffToken[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i].toLowerCase() === b[j].toLowerCase()
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffToken[] = [];
  const push = (kind: DiffToken["kind"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += ` ${text}`;
    else out.push({ kind, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].toLowerCase() === b[j].toLowerCase()) {
      push("same", b[j]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return out;
}
