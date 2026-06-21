import { create } from "zustand";
import type { Item } from "@/data/types";
import { getDag, type DagSource } from "../model/dag";
import * as E from "./engine";
import {
  beepDone,
  beepStep,
  notify,
  requestNotificationPermission,
  unlockAudio,
} from "./alarms";

const TICK_MS = 400;

interface ExecuteStore {
  engine: E.EngineState | null;
  recipeTitle: string;
  source: DagSource;
  tick: number; // bumps each clock tick to drive countdown re-renders
  timer: number | null;

  load: (item: Item, source: DagSource, cooks?: number) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setCooks: (n: number) => void;
  setSpeed: (n: number) => void;
  setSimulate: (on: boolean) => void;
  complete: (id: string) => void;
  skip: (id: string) => void;
  teardown: () => void;
}

export const useExecute = create<ExecuteStore>((set, get) => {
  function activeIds(eng: E.EngineState): Set<string> {
    return new Set(
      Object.entries(eng.steps)
        .filter(([, r]) => r.status === "active")
        .map(([id]) => id)
    );
  }

  function stopClock() {
    const t = get().timer;
    if (t != null) {
      clearInterval(t);
      set({ timer: null });
    }
  }

  function startClock() {
    if (get().timer != null) return;
    const id = window.setInterval(() => {
      const eng = get().engine;
      if (!eng || eng.status !== "running") return;
      const before = activeIds(eng);
      const { state, fired } = E.reconcile(eng, Date.now());

      if (fired.length) {
        beepDone();
        for (const f of fired) notify("Timer done", f.label);
      } else {
        // chime softly when a brand-new step becomes active
        const after = activeIds(state);
        let isNew = false;
        for (const id of after) if (!before.has(id)) isNew = true;
        if (isNew) beepStep();
      }

      set({ engine: state, tick: get().tick + 1 });
      if (state.status === "completed") stopClock();
    }, TICK_MS);
    set({ timer: id });
  }

  return {
    engine: null,
    recipeTitle: "",
    source: "draft",
    tick: 0,
    timer: null,

    load: (item, source, cooks = 1) => {
      stopClock();
      const dag = getDag(item);
      set({
        engine: E.initEngine(dag, cooks),
        recipeTitle: item.title,
        source,
        tick: 0,
      });
    },

    play: () => {
      const eng = get().engine;
      if (!eng) return;
      unlockAudio();
      requestNotificationPermission();
      set({ engine: E.play(eng, Date.now()) });
      startClock();
    },

    pause: () => {
      const eng = get().engine;
      if (!eng) return;
      stopClock();
      set({ engine: E.pause(eng, Date.now()), tick: get().tick + 1 });
    },

    reset: () => {
      const eng = get().engine;
      if (!eng) return;
      stopClock();
      set({ engine: E.reset(eng), tick: get().tick + 1 });
    },

    setCooks: (n) => {
      const eng = get().engine;
      if (!eng) return;
      set({ engine: E.setCooks(eng, n), tick: get().tick + 1 });
    },

    setSpeed: (n) => {
      const eng = get().engine;
      if (!eng) return;
      set({ engine: E.setSpeed(eng, n, Date.now()), tick: get().tick + 1 });
    },

    setSimulate: (on) => {
      const eng = get().engine;
      if (!eng) return;
      set({ engine: E.setSimulate(eng, on), tick: get().tick + 1 });
    },

    complete: (id) => {
      const eng = get().engine;
      if (!eng) return;
      const state = E.completeStep(eng, id, Date.now());
      set({ engine: state, tick: get().tick + 1 });
      if (state.status === "completed") stopClock();
    },

    skip: (id) => {
      const eng = get().engine;
      if (!eng) return;
      const state = E.skipStep(eng, id, Date.now());
      set({ engine: state, tick: get().tick + 1 });
      if (state.status === "completed") stopClock();
    },

    teardown: () => {
      stopClock();
      set({ engine: null, recipeTitle: "", source: "draft", tick: 0 });
    },
  };
});
