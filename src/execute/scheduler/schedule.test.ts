import { describe, it, expect } from "vitest";
import { schedule } from "./schedule";
import { computeCpm } from "./criticalPath";
import { topoSort } from "./graph";
import type { Step } from "../model/types";

function step(id: string, opts: Partial<Step> = {}): Step {
  return {
    id,
    label: id,
    detail: "",
    durationMin: 1,
    durationConfidence: "explicit",
    attention: "active",
    station: "none",
    dependsOn: [],
    timer: false,
    phase: "cook",
    ...opts,
  };
}

describe("CPM", () => {
  it("finds the critical path through a diamond", () => {
    // a -> b(long) -> d ; a -> c(short) -> d
    const steps = [
      step("a", { durationMin: 2 }),
      step("b", { durationMin: 8, dependsOn: ["a"] }),
      step("c", { durationMin: 3, dependsOn: ["a"] }),
      step("d", { durationMin: 2, dependsOn: ["b", "c"] }),
    ];
    const cpm = computeCpm(steps);
    expect(cpm.projectedDurationMin).toBe(12); // 2 + 8 + 2
    expect(cpm.criticalPath).toEqual(["a", "b", "d"]);
    expect(cpm.nodes.get("c")!.slack).toBe(5); // 8 - 3
  });
});

describe("graph", () => {
  it("topo-sorts and detects cycles", () => {
    expect(() =>
      topoSort([step("x", { dependsOn: ["y"] }), step("y", { dependsOn: ["x"] })])
    ).toThrow(/cycle/i);
  });
});

describe("schedule — wait fills the window", () => {
  // sauté -> pressure(wait) ; chopVeg (independent prep) ; addVeg needs both ; finish
  const steps = [
    step("saute", { durationMin: 5, station: "stove" }),
    step("pressure", { durationMin: 75, attention: "wait", station: "pressure", dependsOn: ["saute"] }),
    step("chop", { durationMin: 10, station: "board" }),
    step("addVeg", { durationMin: 5, station: "stove", dependsOn: ["pressure", "chop"] }),
    step("finish", { durationMin: 2, station: "stove", dependsOn: ["addVeg"] }),
  ];

  it("runs prep during the unattended pressure cook (1 cook)", () => {
    const r = schedule(steps, { cooks: 1 });
    expect(r.steps.saute.start).toBe(0);
    expect(r.steps.saute.end).toBe(5);
    // pressure starts right after sauté, holds the pressure station, frees the cook
    expect(r.steps.pressure.start).toBe(5);
    expect(r.steps.pressure.end).toBe(80);
    // chopping happens DURING the pressure cook, not before/after
    expect(r.steps.chop.start).toBe(5);
    expect(r.steps.chop.end).toBe(15);
    // addVeg waits for the long unattended step
    expect(r.steps.addVeg.start).toBe(80);
    expect(r.projectedDurationMin).toBe(87);
  });
});

describe("schedule — station contention", () => {
  // two unattended bakes share one oven; plenty of cooks so the oven is the only constraint
  const steps = [
    step("bake1", { durationMin: 30, attention: "wait", station: "oven" }),
    step("bake2", { durationMin: 20, attention: "wait", station: "oven" }),
  ];

  it("serializes steps competing for the same station", () => {
    const r = schedule(steps, { cooks: 4 });
    const a = r.steps.bake1;
    const b = r.steps.bake2;
    // no overlap on the shared oven
    const overlap = a.start < b.end && b.start < a.end;
    expect(overlap).toBe(false);
    expect(r.projectedDurationMin).toBe(50); // 30 + 20, forced sequential
  });

  it("runs multiple burners on the stove concurrently (capacity > 1)", () => {
    // two passive pots on the stove — frees the cook, both burners at once
    const pots = [
      step("boilA", { durationMin: 12, attention: "passive", station: "stove" }),
      step("boilB", { durationMin: 12, attention: "passive", station: "stove" }),
    ];
    const r = schedule(pots, { cooks: 1 });
    expect(r.steps.boilA.start).toBe(0);
    expect(r.steps.boilB.start).toBe(0); // both start together
    expect(r.projectedDurationMin).toBe(12);
  });

  it("runs different-station active steps in parallel only with enough cooks", () => {
    const two = [
      step("sear", { durationMin: 10, station: "stove" }),
      step("roast", { durationMin: 10, station: "oven" }),
    ];
    expect(schedule(two, { cooks: 1 }).projectedDurationMin).toBe(20); // cook is the bottleneck
    expect(schedule(two, { cooks: 2 }).projectedDurationMin).toBe(10); // both at once
  });
});

describe("schedule — adaptive reschedule", () => {
  const linear = [
    step("a", { durationMin: 10 }),
    step("b", { durationMin: 10, dependsOn: ["a"] }),
    step("c", { durationMin: 10, dependsOn: ["b"] }),
  ];

  it("baseline is fully sequential for one cook", () => {
    const r = schedule(linear, { cooks: 1 });
    expect([r.steps.a.end, r.steps.b.end, r.steps.c.end]).toEqual([10, 20, 30]);
  });

  it("pulls downstream earlier when a step finishes early", () => {
    // 'a' actually finished at minute 6 (not 10); reschedule from now = 6
    const r = schedule(linear, {
      cooks: 1,
      originMin: 6,
      pins: { a: { start: 0, end: 6, done: true } },
    });
    expect(r.steps.b.start).toBe(6);
    expect(r.steps.c.end).toBe(26);
  });

  it("respects an in-progress step's projected end", () => {
    // a done (0–6); b in progress (6–16); now = 10
    const r = schedule(linear, {
      cooks: 1,
      originMin: 10,
      pins: {
        a: { start: 0, end: 6, done: true },
        b: { start: 6, end: 16, done: false },
      },
    });
    expect(r.steps.c.start).toBe(16);
    expect(r.steps.c.end).toBe(26);
  });
});

describe("schedule — edge cases", () => {
  it("handles a single step", () => {
    const r = schedule([step("solo", { durationMin: 7 })]);
    expect(r.projectedDurationMin).toBe(7);
    expect(r.steps.solo.critical).toBe(true);
  });

  it("handles an empty graph", () => {
    const r = schedule([]);
    expect(r.projectedDurationMin).toBe(0);
    expect(r.order).toEqual([]);
  });

  it("handles zero-duration (instant) steps", () => {
    const r = schedule([
      step("grab", { durationMin: 0 }),
      step("use", { durationMin: 5, dependsOn: ["grab"] }),
    ]);
    expect(r.steps.use.start).toBe(0);
    expect(r.projectedDurationMin).toBe(5);
  });
});
