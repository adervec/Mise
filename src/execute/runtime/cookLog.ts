// Cook history log — the data source for Claude/Cowork progress reports.
// Zero imports on purpose: Settings (eager bundle) uses it without pulling
// the lazy execute chunk.

export interface CookLogEntry {
  recipeId: string;
  title: string;
  finishedAt: string; // ISO
  elapsedMin: number;
  steps: { total: number; completed: number; skipped: number };
  simulate: boolean; // preview runs — exclude from real progress
  speed: number;
}

const KEY = "mise.cookLog.v1";
const MAX = 300; // ponytail: cap instead of pruning by date

export function readCookLog(): CookLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function appendCookLog(entry: CookLogEntry): void {
  try {
    const log = readCookLog();
    log.push(entry);
    localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX)));
  } catch {
    /* quota — ignore */
  }
}

export function writeCookLog(log: CookLogEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX)));
  } catch {
    /* quota — ignore */
  }
}

/** One recipe cannot finish twice at the same instant, so this identifies a cook. */
function entryKey(e: CookLogEntry): string {
  return e.recipeId + "@" + e.finishedAt;
}

// Cook logs are append-only records, so two devices merge by UNION rather than
// last-writer-wins: order-independent, so it converges no matter who syncs first
// and nothing a device already recorded can be clobbered by a stale copy.
export function mergeCookLog(a: CookLogEntry[], b: CookLogEntry[]): CookLogEntry[] {
  const byKey = new Map<string, CookLogEntry>();
  for (const e of [...a, ...b]) {
    if (e && typeof e.recipeId === "string" && typeof e.finishedAt === "string") {
      byKey.set(entryKey(e), e);
    }
  }
  return [...byKey.values()]
    .sort((x, y) => Date.parse(x.finishedAt) - Date.parse(y.finishedAt))
    .slice(-MAX);
}

/** Download the log as mise-cook-log.json (drop it in the project folder for Claude). */
export function exportCookLog(): void {
  const blob = new Blob([JSON.stringify(readCookLog(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mise-cook-log.json";
  a.click();
  URL.revokeObjectURL(url);
}
