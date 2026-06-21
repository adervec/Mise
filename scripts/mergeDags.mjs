// Merge the per-batch authored DAGs into src/data/recipes.dag.json, validating
// and normalizing each. Invalid recipes are skipped (they fall back to a linear
// DAG at runtime). Run after the authoring workflow completes.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const authDir = resolve(root, "src/data/_authoring");

const STATIONS = new Set(["stove","oven","pressure","board","mixer","sink","counter","fridge","microwave","none"]);
const ATTENTION = new Set(["active","passive","wait"]);
const PHASES = new Set(["prep","cook","cleanup"]);

const items = JSON.parse(readFileSync(resolve(root, "src/data/items.json"), "utf8"));
const recipeIds = new Set(items.filter((i) => i.cat === "recipe").map((i) => i.id));
const HEROES = new Set(["beef-shank-stew", "whole-roast-chicken", "pasta-carbonara"]);

function acyclic(steps) {
  const ids = new Set(steps.map((s) => s.id));
  const indeg = new Map(steps.map((s) => [s.id, 0]));
  const succ = new Map(steps.map((s) => [s.id, []]));
  for (const s of steps) {
    for (const d of s.dependsOn) {
      if (!ids.has(d)) return false;
      indeg.set(s.id, indeg.get(s.id) + 1);
      succ.get(d).push(s.id);
    }
  }
  const q = [...ids].filter((id) => indeg.get(id) === 0);
  let seen = 0;
  while (q.length) {
    const id = q.shift();
    seen++;
    for (const n of succ.get(id)) {
      indeg.set(n, indeg.get(n) - 1);
      if (indeg.get(n) === 0) q.push(n);
    }
  }
  return seen === ids.size;
}

function normalizeStep(raw, idx, knownIds) {
  const id = String(raw.id ?? `s${idx}`);
  const attention = ATTENTION.has(raw.attention) ? raw.attention : "active";
  let durationMin = Number(raw.durationMin);
  if (!Number.isFinite(durationMin) || durationMin < 0) durationMin = attention === "wait" ? 15 : attention === "passive" ? 6 : 2;
  durationMin = Math.round(durationMin);
  const dependsOn = Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String).filter((d) => knownIds.has(d) && d !== id) : [];
  return {
    id,
    label: String(raw.label ?? id).slice(0, 60),
    detail: String(raw.detail ?? ""),
    durationMin,
    durationConfidence: raw.durationConfidence === "explicit" ? "explicit" : "estimated",
    attention,
    station: STATIONS.has(raw.station) ? raw.station : "none",
    dependsOn,
    timer: typeof raw.timer === "boolean" ? raw.timer : attention !== "active" && durationMin >= 2,
    phase: PHASES.has(raw.phase) ? raw.phase : "cook",
  };
}

function normalizeDag(id, raw) {
  if (!raw || !Array.isArray(raw.steps) || raw.steps.length === 0) return null;
  const knownIds = new Set(raw.steps.map((s, i) => String(s.id ?? `s${i}`)));
  const steps = raw.steps.map((s, i) => normalizeStep(s, i, knownIds));
  // unique ids
  const seen = new Set();
  for (const s of steps) {
    if (seen.has(s.id)) return null;
    seen.add(s.id);
  }
  if (!acyclic(steps)) return null;
  const out = { id, steps };
  if (Number.isFinite(Number(raw.serves))) out.serves = Number(raw.serves);
  return out;
}

const merged = {};
let parsed = 0, invalid = 0;
const badFiles = [];

// Process plain out-NN.json first, then out-r2-NN.json so re-authored versions win.
const outFiles = readdirSync(authDir)
  .filter((f) => /^out-(r2-)?\d+\.json$/.test(f))
  .sort();
for (const file of outFiles) {
  let obj;
  try {
    obj = JSON.parse(readFileSync(resolve(authDir, file), "utf8"));
  } catch (e) {
    badFiles.push(`${file}: ${e.message}`);
    continue;
  }
  for (const [id, raw] of Object.entries(obj)) {
    if (!recipeIds.has(id) || HEROES.has(id)) continue;
    const dag = normalizeDag(id, raw);
    if (dag) {
      merged[id] = dag;
      parsed++;
    } else {
      invalid++;
    }
  }
}

writeFileSync(resolve(root, "src/data/recipes.dag.json"), JSON.stringify(merged));

const authored = new Set(Object.keys(merged));
const missing = [...recipeIds].filter((id) => !HEROES.has(id) && !authored.has(id));

console.log(`Merged ${parsed} valid DAGs (${invalid} rejected).`);
if (badFiles.length) console.log("Unparseable files:\n  " + badFiles.join("\n  "));
console.log(`Coverage: ${authored.size}/${recipeIds.size - HEROES.size} non-hero recipes authored.`);
if (missing.length) console.log(`Missing (linear fallback): ${missing.join(", ")}`);
