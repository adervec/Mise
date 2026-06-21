import type {
  ScheduleOptions,
  ScheduleResult,
  ScheduledStep,
  StationId,
  Step,
} from "../model/types";
import { STATION_ORDER, stationCapacity } from "../model/stations";
import { buildAdjacency } from "./graph";
import { computeCpm } from "./criticalPath";

interface Run {
  id: string;
  end: number;
  active: boolean;
  station: StationId;
}

/**
 * Critical-path-priority, resource-constrained list scheduling.
 *
 * Resources:
 *   - cook pool (capacity = `cooks`, default 1) — consumed only by `active` steps.
 *   - each station (capacity 1; `none` is unlimited) — consumed by any step on it.
 * `passive`/`wait` steps hold their station but free the cook, so hands-on work
 * automatically fills passive/unattended windows.
 *
 * Supports `pins` (completed / in-progress steps) and `originMin` for rescheduling.
 */
export function schedule(steps: Step[], options: ScheduleOptions = {}): ScheduleResult {
  const cooks = options.cooks ?? 1;
  const originMin = options.originMin ?? 0;
  const pins = options.pins ?? {};

  const adj = buildAdjacency(steps);
  const cpm = computeCpm(steps, adj);
  const criticalSet = new Set(cpm.criticalPath);
  const declIndex = new Map(steps.map((s, i) => [s.id, i]));
  const byId = adj.byId;

  const start: Record<string, number> = {};
  const end: Record<string, number> = {};
  const scheduled = new Set<string>();
  const done = new Set<string>();
  const stationInUse = new Map<StationId, number>();
  let cooksInUse = 0;
  let running: Run[] = [];

  const occupy = (st: StationId, delta: number) => {
    if (st === "none") return;
    stationInUse.set(st, (stationInUse.get(st) ?? 0) + delta);
  };
  const stationFree = (st: StationId) =>
    st === "none" || (stationInUse.get(st) ?? 0) < stationCapacity(st);

  // ---- apply pins (completed + in-progress) ----
  for (const [id, pin] of Object.entries(pins)) {
    const s = byId.get(id);
    if (!s) continue;
    start[id] = pin.start;
    end[id] = pin.end;
    scheduled.add(id);
    if (pin.done) {
      done.add(id);
    } else {
      if (s.attention === "active") cooksInUse++;
      occupy(s.station, 1);
      running.push({ id, end: pin.end, active: s.attention === "active", station: s.station });
    }
  }

  let time = originMin;

  const release = (t: number) => {
    for (const r of running) {
      if (r.end <= t) {
        done.add(r.id);
        if (r.active) cooksInUse = Math.max(0, cooksInUse - 1);
        occupy(r.station, -1);
      }
    }
    running = running.filter((r) => r.end > t);
  };

  const depsMet = (s: Step) => s.dependsOn.every((d) => done.has(d));

  const compare = (x: Step, y: Step): number => {
    const cx = criticalSet.has(x.id) ? 0 : 1;
    const cy = criticalSet.has(y.id) ? 0 : 1;
    if (cx !== cy) return cx - cy;
    const sx = cpm.nodes.get(x.id)!.slack;
    const sy = cpm.nodes.get(y.id)!.slack;
    if (sx !== sy) return sx - sy;
    if (x.durationMin !== y.durationMin) return y.durationMin - x.durationMin;
    return declIndex.get(x.id)! - declIndex.get(y.id)!;
  };

  let guard = 0;
  const maxIters = steps.length * 4 + 100;

  while (scheduled.size < steps.length) {
    if (++guard > maxIters) throw new Error("scheduler failed to converge");
    release(time);

    const ready = steps.filter((s) => !scheduled.has(s.id) && depsMet(s));
    const candidates = ready.filter((s) => {
      const cookOk = s.attention !== "active" || cooksInUse < cooks;
      return stationFree(s.station) && cookOk;
    });

    if (candidates.length === 0) {
      // Every ready step is blocked on a resource; advance to the next release.
      const nextTimes = running.filter((r) => r.end > time).map((r) => r.end);
      if (nextTimes.length === 0) {
        throw new Error("scheduler deadlock — check dependencies and station capacities");
      }
      time = Math.min(...nextTimes);
      continue;
    }

    candidates.sort(compare);
    const s = candidates[0];
    start[s.id] = time;
    end[s.id] = time + s.durationMin;
    scheduled.add(s.id);
    if (s.attention === "active") cooksInUse++;
    occupy(s.station, 1);
    running.push({ id: s.id, end: end[s.id], active: s.attention === "active", station: s.station });
  }

  // ---- assemble result ----
  const scheduledSteps: Record<string, ScheduledStep> = {};
  for (const s of steps) {
    const n = cpm.nodes.get(s.id)!;
    scheduledSteps[s.id] = {
      id: s.id,
      start: start[s.id],
      end: end[s.id],
      station: s.station,
      attention: s.attention,
      critical: criticalSet.has(s.id),
      slack: n.slack,
      es: n.es,
      ef: n.ef,
      ls: n.ls,
      lf: n.lf,
    };
  }

  const order = [...steps]
    .map((s) => s.id)
    .sort((a, b) => start[a] - start[b] || declIndex.get(a)! - declIndex.get(b)!);

  const projectedDurationMin = steps.length
    ? Math.max(...steps.map((s) => end[s.id]))
    : 0;

  const usedStations = new Set(steps.map((s) => s.station));
  const lanes = STATION_ORDER.filter((st) => usedStations.has(st));

  return { steps: scheduledSteps, order, projectedDurationMin, criticalPath: cpm.criticalPath, lanes };
}
