import { describe, it, expect } from "vitest";
import { schedule } from "@/execute/scheduler/schedule";
import { HERO_DAGS } from "@/execute/model/heroDags";

describe("hero schedules", () => {
  for (const [id, dag] of Object.entries(HERO_DAGS)) {
    it(`${id} schedules without error and shows parallelism`, () => {
      const r = schedule(dag.steps, { cooks: 1 });
      expect(r.projectedDurationMin).toBeGreaterThan(0);
      // at least one pair of steps overlaps in time (parallelism present)
      const ss = Object.values(r.steps);
      const hasOverlap = ss.some((a) => ss.some((b) => a.id !== b.id && a.start < b.end && b.start < a.end));
      expect(hasOverlap).toBe(true);
    });
  }
});
