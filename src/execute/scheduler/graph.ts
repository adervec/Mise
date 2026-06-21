import type { Step } from "../model/types";

export interface Adjacency {
  preds: Map<string, string[]>;
  succs: Map<string, string[]>;
  byId: Map<string, Step>;
}

export function buildAdjacency(steps: Step[]): Adjacency {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const preds = new Map<string, string[]>(steps.map((s) => [s.id, []]));
  const succs = new Map<string, string[]>(steps.map((s) => [s.id, []]));
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      if (!byId.has(dep)) {
        throw new Error(`Step "${s.id}" depends on unknown step "${dep}".`);
      }
      preds.get(s.id)!.push(dep);
      succs.get(dep)!.push(s.id);
    }
  }
  return { preds, succs, byId };
}

/** Kahn's algorithm. Returns ids in a valid dependency order; throws on a cycle. */
export function topoSort(steps: Step[], adj?: Adjacency): string[] {
  const { preds, succs } = adj ?? buildAdjacency(steps);
  const indeg = new Map<string, number>();
  for (const s of steps) indeg.set(s.id, preds.get(s.id)!.length);

  // Seed with zero-indegree nodes, preserving declaration order for stable output.
  const queue = steps.filter((s) => indeg.get(s.id) === 0).map((s) => s.id);
  const order: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of succs.get(id)!) {
      const d = indeg.get(next)! - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (order.length !== steps.length) {
    const stuck = steps.filter((s) => !order.includes(s.id)).map((s) => s.id);
    throw new Error(`Cycle detected in step graph involving: ${stuck.join(", ")}`);
  }
  return order;
}

export function isDag(steps: Step[]): boolean {
  try {
    topoSort(steps);
    return true;
  } catch {
    return false;
  }
}
