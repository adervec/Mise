import { describe, it, expect } from "vitest";
import * as E from "./engine";
import type { RecipeDag, Step } from "../model/types";

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

// a -> b(wait, timed) -> c
const dag: RecipeDag = {
  id: "t",
  steps: [
    step("a", { durationMin: 5, attention: "active" }),
    step("b", { durationMin: 10, attention: "wait", station: "oven", timer: true, dependsOn: ["a"] }),
    step("c", { durationMin: 3, attention: "active", dependsOn: ["b"] }),
  ],
};

// helper: epoch for a given sim-minute at speed 1, given a start epoch
const T0 = 1_000_000;
const at = (min: number) => T0 + min * 60000;

describe("engine runtime", () => {
  it("starts ready and activates the first step on play", () => {
    let s = E.initEngine(dag, 1);
    expect(s.status).toBe("ready");
    s = E.play(s, T0);
    expect(s.status).toBe("running");
    expect(s.steps.a.status).toBe("active");
    expect(s.steps.b.status).toBe("pending");
  });

  it("auto-completes an unattended timed step and fires its alarm", () => {
    let s = E.play(E.initEngine(dag, 1), T0);
    // user finishes the hands-on step 'a' at minute 5
    s = E.completeStep(s, "a", at(5));
    expect(s.steps.a.status).toBe("done");
    // reconcile at minute 5 activates the oven wait 'b'
    let r = E.reconcile(s, at(5));
    s = r.state;
    expect(s.steps.b.status).toBe("active");
    expect(r.fired).toHaveLength(0);
    // at minute 15 the 10-min oven step auto-completes and rings
    r = E.reconcile(s, at(15));
    s = r.state;
    expect(s.steps.b.status).toBe("done");
    expect(r.fired.map((f) => f.id)).toContain("b");
    // and 'c' becomes active
    r = E.reconcile(s, at(15));
    s = r.state;
    expect(s.steps.c.status).toBe("active");
  });

  it("reaches completed when every step is finished", () => {
    let s = E.play(E.initEngine(dag, 1), T0);
    s = E.completeStep(s, "a", at(5));
    s = E.reconcile(s, at(5)).state; // b active
    s = E.reconcile(s, at(15)).state; // b done
    s = E.reconcile(s, at(15)).state; // c active
    s = E.completeStep(s, "c", at(17));
    expect(s.status).toBe("completed");
    expect(s.completedElapsedMs).not.toBeNull();
  });

  it("pulls the finish earlier when a step completes early (reschedule)", () => {
    let s = E.play(E.initEngine(dag, 1), T0);
    const plannedC = s.plan.steps.c.start; // 15 (5 + 10)
    expect(plannedC).toBe(15);
    // finish 'a' early at minute 3 instead of 5
    s = E.completeStep(s, "a", at(3));
    // b can now start at 3 -> ends at 13 -> c planned at 13
    expect(s.plan.steps.c.start).toBe(13);
  });

  it("elapsed time scales with speed", () => {
    let s = E.initEngine(dag, 1, 10); // 10x
    s = E.play(s, T0);
    // 1 real minute later => 10 sim minutes
    expect(E.elapsedMin(s, at(1))).toBeCloseTo(10, 5);
  });

  it("freezes elapsed while paused", () => {
    let s = E.play(E.initEngine(dag, 1), T0);
    s = E.pause(s, at(4));
    expect(E.elapsedMin(s, at(4))).toBeCloseTo(4, 5);
    // time keeps passing in the real world, but paused elapsed stays put
    expect(E.elapsedMin(s, at(9))).toBeCloseTo(4, 5);
    // resume and run 2 more sim-minutes
    s = E.play(s, at(9));
    expect(E.elapsedMin(s, at(11))).toBeCloseTo(6, 5);
  });
});
