import { create } from "zustand";
import type { Item } from "@/data/types";
import { getDag, type DagSource } from "../model/dag";
import * as E from "./engine";
import { clearCook, loadCook, saveCook } from "./persistence";
import { appendCookLog } from "./cookLog";
import { autoSyncCookLog } from "./driveSync";
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
  recipeId: string;
  source: DagSource;
  resumed: boolean;
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

  function persist() {
    const { engine, recipeId } = get();
    if (engine && recipeId) saveCook(recipeId, engine);
  }

  function finishCook(state: E.EngineState) {
    stopClock();
    clearCook();
    const statuses = Object.values(state.steps).map((r) => r.status);
    appendCookLog({
      recipeId: get().recipeId,
      title: get().recipeTitle,
      finishedAt: new Date().toISOString(),
      elapsedMin: Math.round(E.elapsedMin(state, Date.now()) * 10) / 10,
      steps: {
        total: statuses.length,
        completed: statuses.filter((s) => s === "done").length,
        skipped: statuses.filter((s) => s === "skipped").length,
      },
      simulate: state.simulate,
      speed: state.speed,
    });
    autoSyncCookLog(); // silent no-op unless Drive sync is connected
  }

  function startClock() {
    if (get().timer != null) return;
    const id = window.setInterval(() => {
      const eng = get().engine;
      if (!eng || eng.status !== "running") return;
      const before = activeIds(eng);
      const { state, fired } = E.reconcile(eng, Date.now());
      const after = activeIds(state);

      let isNew = false;
      for (const id of after) if (!before.has(id)) isNew = true;

      if (fired.length) {
        beepDone();
        for (const f of fired) notify("Timer done", f.label);
      } else if (isNew) {
        beepStep();
      }

      set({ engine: state, tick: get().tick + 1 });
      if (state.status === "completed") {
        finishCook(state);
      } else if (fired.length || isNew) {
        saveCook(get().recipeId, state);
      }
    }, TICK_MS);
    set({ timer: id });
  }

  return {
    engine: null,
    recipeTitle: "",
    recipeId: "",
    source: "draft",
    resumed: false,
    tick: 0,
    timer: null,

    load: (item, source, cooks = 1) => {
      stopClock();
      const dag = getDag(item);
      const saved = loadCook(item.id, dag.steps.map((s) => s.id));
      set({
        engine: saved ?? E.initEngine(dag, cooks),
        recipeTitle: item.title,
        recipeId: item.id,
        source,
        resumed: !!saved,
        tick: 0,
      });
    },

    play: () => {
      const eng = get().engine;
      if (!eng) return;
      unlockAudio();
      requestNotificationPermission();
      set({ engine: E.play(eng, Date.now()), resumed: false });
      startClock();
      persist();
    },

    pause: () => {
      const eng = get().engine;
      if (!eng) return;
      stopClock();
      set({ engine: E.pause(eng, Date.now()), tick: get().tick + 1 });
      persist();
    },

    reset: () => {
      const eng = get().engine;
      if (!eng) return;
      stopClock();
      clearCook();
      set({ engine: E.reset(eng), resumed: false, tick: get().tick + 1 });
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
      if (state.status === "completed") {
        finishCook(state);
      } else {
        saveCook(get().recipeId, state);
      }
    },

    skip: (id) => {
      const eng = get().engine;
      if (!eng) return;
      const state = E.skipStep(eng, id, Date.now());
      set({ engine: state, tick: get().tick + 1 });
      if (state.status === "completed") {
        finishCook(state);
      } else {
        saveCook(get().recipeId, state);
      }
    },

    teardown: () => {
      stopClock();
      // keep any saved cook so it can be resumed later
      set({ engine: null, recipeTitle: "", recipeId: "", source: "draft", resumed: false, tick: 0 });
    },
  };
});
