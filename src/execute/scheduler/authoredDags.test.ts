import { describe, it, expect } from "vitest";
import authored from "@/data/recipes.dag.json";
import { schedule } from "./schedule";
import type { Step } from "../model/types";

const dags = authored as unknown as Record<string, { steps: Step[] }>;

describe("authored DAGs", () => {
  it("there is at least one authored recipe", () => {
    expect(Object.keys(dags).length).toBeGreaterThan(50);
  });

  it("every authored DAG schedules without error", () => {
    for (const [id, dag] of Object.entries(dags)) {
      expect(() => schedule(dag.steps, { cooks: 1 }), id).not.toThrow();
    }
  });

  // Many recipes are legitimately sequential for a single cook (a 6-min stir-fry,
  // compound butter, etc.) — parallelism should concentrate in the complex ones.
  it("a meaningful share exhibit real parallelism, esp. longer recipes", () => {
    let withParallel = 0;
    let longTotal = 0;
    let longParallel = 0;
    const total = Object.keys(dags).length;
    for (const dag of Object.values(dags)) {
      const r = schedule(dag.steps, { cooks: 1 });
      const ss = Object.values(r.steps);
      const overlap = ss.some((a) => ss.some((b) => a.id !== b.id && a.start < b.end && b.start < a.end));
      if (overlap) withParallel++;
      if (r.projectedDurationMin >= 30) {
        longTotal++;
        if (overlap) longParallel++;
      }
    }
    expect(withParallel / total).toBeGreaterThan(0.3);
    // most genuinely involved recipes (>=30 min) should have something to overlap
    expect(longParallel / Math.max(1, longTotal)).toBeGreaterThan(0.6);
  });
});
