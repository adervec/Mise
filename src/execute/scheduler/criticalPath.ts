import type { Step } from "../model/types";
import { buildAdjacency, topoSort, type Adjacency } from "./graph";

export interface CpmNode {
  es: number; // earliest start
  ef: number; // earliest finish
  ls: number; // latest start
  lf: number; // latest finish
  slack: number;
}

export interface CpmResult {
  nodes: Map<string, CpmNode>;
  projectedDurationMin: number;
  criticalPath: string[]; // critical ids, in topological order
}

const EPS = 1e-6;

/**
 * Critical Path Method — durations only, resources ignored.
 * Gives the theoretical minimum duration and the zero-slack chain.
 */
export function computeCpm(steps: Step[], adj?: Adjacency): CpmResult {
  const a = adj ?? buildAdjacency(steps);
  const order = topoSort(steps, a);
  const dur = new Map(steps.map((s) => [s.id, s.durationMin]));
  const nodes = new Map<string, CpmNode>();

  // Forward pass — earliest start/finish.
  for (const id of order) {
    const preds = a.preds.get(id)!;
    const es = preds.length ? Math.max(...preds.map((p) => nodes.get(p)!.ef)) : 0;
    const ef = es + dur.get(id)!;
    nodes.set(id, { es, ef, ls: 0, lf: 0, slack: 0 });
  }

  const projectedDurationMin = Math.max(0, ...order.map((id) => nodes.get(id)!.ef));

  // Backward pass — latest start/finish.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const succs = a.succs.get(id)!;
    const n = nodes.get(id)!;
    n.lf = succs.length
      ? Math.min(...succs.map((s) => nodes.get(s)!.ls))
      : projectedDurationMin;
    n.ls = n.lf - dur.get(id)!;
    n.slack = n.ls - n.es;
  }

  const criticalPath = order.filter((id) => Math.abs(nodes.get(id)!.slack) < EPS);
  return { nodes, projectedDurationMin, criticalPath };
}
