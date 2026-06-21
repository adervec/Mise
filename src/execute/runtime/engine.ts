import type { Pin, RecipeDag, ScheduleResult } from "../model/types";
import { schedule } from "../scheduler/schedule";

export type RunStatus = "ready" | "running" | "paused" | "completed";
export type StepStatus = "pending" | "active" | "done" | "skipped";

export interface StepRun {
  status: StepStatus;
  startMin?: number; // actual start (minutes from origin)
  endMin?: number; // actual end
}

export interface EngineState {
  dag: RecipeDag;
  cooks: number;
  status: RunStatus;
  simulate: boolean; // preview mode: auto-advance hands-on steps too
  // Wall-clock time model with a rate multiplier (speed). Sim time is derived on
  // every read, so it stays correct across backgrounded tabs.
  speed: number; // sim-minutes per real-minute
  simBaseMs: number; // accumulated sim ms up to rateStartEpoch
  rateStartEpoch: number | null; // wall epoch the current running rate began
  completedElapsedMs: number | null;
  steps: Record<string, StepRun>;
  plan: ScheduleResult; // current schedule (re-planned adaptively)
}

export interface FiredAlarm {
  id: string;
  label: string;
}

const MIN = 60000;
const EPS = 1e-6;

export function initEngine(dag: RecipeDag, cooks = 1, speed = 1, simulate = false): EngineState {
  const plan = schedule(dag.steps, { cooks });
  const steps: Record<string, StepRun> = {};
  for (const s of dag.steps) steps[s.id] = { status: "pending" };
  return {
    dag,
    cooks,
    status: "ready",
    simulate,
    speed,
    simBaseMs: 0,
    rateStartEpoch: null,
    completedElapsedMs: null,
    steps,
    plan,
  };
}

export function elapsedMs(s: EngineState, now: number): number {
  if (s.status === "completed" && s.completedElapsedMs != null) return s.completedElapsedMs;
  if (s.status === "running" && s.rateStartEpoch != null) {
    return s.simBaseMs + (now - s.rateStartEpoch) * s.speed;
  }
  return s.simBaseMs;
}

export function elapsedMin(s: EngineState, now: number): number {
  return elapsedMs(s, now) / MIN;
}

function allFinished(s: EngineState): boolean {
  return s.dag.steps.every((st) => {
    const r = s.steps[st.id].status;
    return r === "done" || r === "skipped";
  });
}

/** Recompute the schedule from the current frontier, pinning done/in-progress steps. */
function replan(s: EngineState, atMin: number): ScheduleResult {
  const pins: Record<string, Pin> = {};
  for (const st of s.dag.steps) {
    const r = s.steps[st.id];
    if (r.status === "done" || r.status === "skipped") {
      pins[st.id] = { start: r.startMin ?? 0, end: r.endMin ?? r.startMin ?? 0, done: true };
    } else if (r.status === "active") {
      const start = r.startMin ?? atMin;
      const end = Math.max(atMin, start + st.durationMin);
      pins[st.id] = { start, end, done: false };
    }
  }
  return schedule(s.dag.steps, { cooks: s.cooks, originMin: atMin, pins });
}

function maybeComplete(s: EngineState, now: number): EngineState {
  if (s.status !== "completed" && allFinished(s)) {
    return { ...s, status: "completed", completedElapsedMs: elapsedMs(s, now) };
  }
  return s;
}

/* ---------------- transport ---------------- */

export function play(s: EngineState, now: number): EngineState {
  if (s.status === "running" || s.status === "completed") return s;
  const started: EngineState = { ...s, status: "running", rateStartEpoch: now };
  return s.status === "ready" ? reconcile(started, now).state : started;
}

export function pause(s: EngineState, now: number): EngineState {
  if (s.status !== "running") return s;
  return { ...s, status: "paused", simBaseMs: elapsedMs(s, now), rateStartEpoch: null };
}

export function setSpeed(s: EngineState, speed: number, now: number): EngineState {
  if (s.status === "running") {
    return { ...s, simBaseMs: elapsedMs(s, now), rateStartEpoch: now, speed };
  }
  return { ...s, speed };
}

export function reset(s: EngineState): EngineState {
  return initEngine(s.dag, s.cooks, s.speed, s.simulate);
}

export function setCooks(s: EngineState, cooks: number): EngineState {
  if (s.status !== "ready") return s; // only before starting
  return initEngine(s.dag, cooks, s.speed, s.simulate);
}

export function setSimulate(s: EngineState, simulate: boolean): EngineState {
  return { ...s, simulate };
}

/* ---------------- step transitions ---------------- */

function finishStep(
  s: EngineState,
  id: string,
  status: "done" | "skipped",
  now: number
): EngineState {
  const r = s.steps[id];
  if (!r || r.status === "done" || r.status === "skipped") return s;
  const atMin = elapsedMin(s, now);
  const steps = {
    ...s.steps,
    [id]: { status, startMin: r.startMin ?? atMin, endMin: atMin },
  };
  let ns: EngineState = { ...s, steps };
  ns.plan = replan(ns, atMin);
  return maybeComplete(ns, now);
}

export function completeStep(s: EngineState, id: string, now: number): EngineState {
  return finishStep(s, id, "done", now);
}

export function skipStep(s: EngineState, id: string, now: number): EngineState {
  return finishStep(s, id, "skipped", now);
}

/**
 * Advance time-driven state: activate due steps, auto-complete unattended timed
 * steps, re-plan when anything changed. Returns the new state plus alarms fired.
 */
export function reconcile(s: EngineState, now: number): { state: EngineState; fired: FiredAlarm[] } {
  if (s.status !== "running") return { state: s, fired: [] };
  const elMin = elapsedMin(s, now);
  const fired: FiredAlarm[] = [];
  const steps = { ...s.steps };
  let changed = false;

  const isFinished = (id: string) => steps[id].status === "done" || steps[id].status === "skipped";

  // activate pending steps whose deps are done and whose planned start has arrived
  for (const st of s.dag.steps) {
    const r = steps[st.id];
    if (r.status !== "pending") continue;
    const depsDone = st.dependsOn.every(isFinished);
    const plannedStart = s.plan.steps[st.id].start;
    if (depsDone && elMin >= plannedStart - EPS) {
      steps[st.id] = { ...r, status: "active", startMin: elMin };
      changed = true;
    }
  }

  // auto-complete steps at their planned end: always for unattended (passive/wait)
  // steps; also for hands-on steps when in simulate (preview) mode.
  for (const st of s.dag.steps) {
    const r = steps[st.id];
    if (r.status !== "active") continue;
    const autoAdvance = st.attention !== "active" || s.simulate;
    if (!autoAdvance) continue;
    const plannedEnd = s.plan.steps[st.id].end;
    if (elMin >= plannedEnd - EPS) {
      steps[st.id] = { ...r, status: "done", endMin: elMin };
      changed = true;
      if (st.timer) fired.push({ id: st.id, label: st.label });
    }
  }

  let ns: EngineState = { ...s, steps };
  if (changed) ns.plan = replan(ns, elMin);
  return { state: maybeComplete(ns, now), fired };
}
