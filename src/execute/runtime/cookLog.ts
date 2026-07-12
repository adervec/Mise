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
