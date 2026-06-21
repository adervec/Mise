// Structured step-DAG model — the artifact the execute engine runs on.

export type Attention = "active" | "passive" | "wait";
//  active : hands-on, occupies the cook
//  passive: monitor (simmer/reduce) — occupies its station, frees the cook
//  wait   : fully unattended (pressure/bake/chill) — occupies its station, frees the cook

export type StationId =
  | "stove"
  | "oven"
  | "pressure"
  | "board"
  | "mixer"
  | "sink"
  | "counter"
  | "fridge"
  | "microwave"
  | "none";

export type Phase = "prep" | "cook" | "cleanup";

export type DurationConfidence = "explicit" | "estimated" | "instant";

export interface Step {
  id: string;
  label: string; // short — Gantt block + Now/Next
  detail: string; // full instruction
  durationMin: number;
  durationConfidence: DurationConfidence;
  attention: Attention;
  station: StationId; // 'none' = uncontended
  dependsOn: string[];
  timer: boolean; // fire an alarm at completion (auto for non-active timed steps)
  phase: Phase;
  variantGroup?: string; // steps sharing a group are mutually-exclusive alternatives
}

export interface RecipeDag {
  id: string; // recipe id (matches catalog Item.id)
  serves?: number;
  steps: Step[];
  /** true when this DAG was auto-derived and not yet hand-curated. */
  draft?: boolean;
}

/** Per-step result of CPM + resource-constrained scheduling. */
export interface ScheduledStep {
  id: string;
  start: number; // minutes from origin
  end: number;
  station: StationId;
  attention: Attention;
  critical: boolean;
  slack: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
}

export interface ScheduleResult {
  steps: Record<string, ScheduledStep>;
  order: string[]; // ids in scheduled start order
  projectedDurationMin: number;
  criticalPath: string[];
  lanes: StationId[]; // station lanes actually used, in display order
}

/** A step pinned to a fixed placement during rescheduling. */
export interface Pin {
  start: number;
  end: number;
  done: boolean; // true = already completed (resource freed at `end`)
}

export interface ScheduleOptions {
  cooks?: number; // default 1
  originMin?: number; // earliest time unpinned steps may start (default 0)
  pins?: Record<string, Pin>; // completed / in-progress steps
}
