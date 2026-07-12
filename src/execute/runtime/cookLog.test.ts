import { beforeEach, expect, test } from "vitest";
import { appendCookLog, readCookLog, type CookLogEntry } from "./cookLog";

// minimal localStorage stub for the node test env
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => store.clear());

function entry(id: string): CookLogEntry {
  return {
    recipeId: id,
    title: id,
    finishedAt: new Date().toISOString(),
    elapsedMin: 30,
    steps: { total: 5, completed: 4, skipped: 1 },
    simulate: false,
    speed: 1,
  };
}

test("appends and reads back", () => {
  appendCookLog(entry("a"));
  appendCookLog(entry("b"));
  expect(readCookLog().map((e) => e.recipeId)).toEqual(["a", "b"]);
});

test("empty/corrupt storage reads as []", () => {
  expect(readCookLog()).toEqual([]);
  store.set("mise.cookLog.v1", "not json");
  expect(readCookLog()).toEqual([]);
});

test("caps at 300 entries, keeping newest", () => {
  for (let i = 0; i < 305; i++) appendCookLog(entry(`r${i}`));
  const log = readCookLog();
  expect(log).toHaveLength(300);
  expect(log[log.length - 1].recipeId).toBe("r304");
});
