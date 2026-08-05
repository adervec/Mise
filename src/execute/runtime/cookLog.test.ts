import { beforeEach, expect, test } from "vitest";
import { appendCookLog, readCookLog, mergeCookLog, type CookLogEntry } from "./cookLog";

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

// --- Drive sync merge -------------------------------------------------------
function at(id: string, iso: string): CookLogEntry {
  return { ...entry(id), finishedAt: iso };
}
const phone = at("chili", "2026-08-01T10:00:00.000Z");
const shared = at("dal", "2026-08-02T10:00:00.000Z");
const desktop = at("ribs", "2026-08-03T10:00:00.000Z");

test("merge unions both devices and dedupes the shared cook", () => {
  const merged = mergeCookLog([phone, shared], [shared, desktop]);
  expect(merged.map((e) => e.recipeId)).toEqual(["chili", "dal", "ribs"]);
});

test("merge converges regardless of which device syncs first", () => {
  const a = mergeCookLog([phone, shared], [shared, desktop]);
  const b = mergeCookLog([shared, desktop], [phone, shared]);
  expect(a).toEqual(b);
});

test("merge keeps same-recipe cooks at different times as separate entries", () => {
  const merged = mergeCookLog([at("chili", "2026-08-01T10:00:00.000Z")], [at("chili", "2026-08-04T10:00:00.000Z")]);
  expect(merged).toHaveLength(2);
});

test("merge caps at 300, keeping the newest", () => {
  const many = Array.from({ length: 400 }, (_, i) =>
    at(`r${i}`, new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString())
  );
  const merged = mergeCookLog(many, [desktop]);
  expect(merged).toHaveLength(300);
  expect(merged[merged.length - 1].recipeId).toBe("ribs");
});

test("merge ignores malformed remote entries", () => {
  const junk = [null, {}, { recipeId: "x" }] as unknown as CookLogEntry[];
  expect(mergeCookLog([phone], junk).map((e) => e.recipeId)).toEqual(["chili"]);
});
