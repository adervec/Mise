import type { EngineState } from "./engine";
import { elapsedMs } from "./engine";

// Lightweight mid-cook persistence so a reload or navigation resumes the cook.
const KEY = "mise.activeCook.v1";

interface Saved {
  recipeId: string;
  savedAt: number;
  engine: EngineState;
}

function hasProgress(e: EngineState): boolean {
  return Object.values(e.steps).some((r) => r.status !== "pending");
}

export function saveCook(recipeId: string, engine: EngineState): void {
  try {
    if (engine.status === "completed" || !hasProgress(engine)) {
      // nothing worth resuming
      localStorage.removeItem(KEY);
      return;
    }
    // freeze elapsed and store as paused, so resume is predictable
    const snapshot: EngineState = {
      ...engine,
      status: "paused",
      simBaseMs: elapsedMs(engine, Date.now()),
      rateStartEpoch: null,
    };
    const data: Saved = { recipeId, savedAt: Date.now(), engine: snapshot };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota / serialization — ignore */
  }
}

/** Returns a resumable engine for this recipe iff its DAG still matches. */
export function loadCook(recipeId: string, currentStepIds: string[]): EngineState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Saved;
    if (data.recipeId !== recipeId) return null;
    const e = data.engine;
    if (!e?.dag?.steps || !e.steps || !e.plan) return null;
    // discard if the recipe's DAG changed since the cook was saved
    const savedIds = new Set(e.dag.steps.map((s) => s.id));
    if (savedIds.size !== currentStepIds.length || !currentStepIds.every((id) => savedIds.has(id))) {
      return null;
    }
    return e;
  } catch {
    return null;
  }
}

export function clearCook(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
