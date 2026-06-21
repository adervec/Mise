// Prepare per-batch input files for the LLM DAG-authoring workflow.
// Splits the non-hero recipes into BATCH_COUNT files under src/data/_authoring/.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "src/data/_authoring");

const HEROES = new Set(["beef-shank-stew", "whole-roast-chicken", "pasta-carbonara"]);
const BATCH_COUNT = 14;

function decode(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
}

const items = JSON.parse(readFileSync(resolve(root, "src/data/items.json"), "utf8"));
const recipes = items.filter((i) => i.cat === "recipe" && !HEROES.has(i.id));

const compact = recipes.map((r) => ({
  id: r.id,
  title: r.title,
  time: r.time,
  serves: r.nutrition?.serving ?? null,
  prep: (r.checklist?.prep ?? []).map(decode),
  modules: (r.checklist?.modules ?? []).map((m) => ({
    title: m.title,
    steps: m.steps.map(decode),
  })),
}));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// round-robin into batches for even sizing
const batches = Array.from({ length: BATCH_COUNT }, () => []);
compact.forEach((r, i) => batches[i % BATCH_COUNT].push(r));

batches.forEach((b, i) => {
  const name = `in-${String(i).padStart(2, "0")}.json`;
  writeFileSync(resolve(outDir, name), JSON.stringify(b, null, 0));
});

writeFileSync(
  resolve(outDir, "manifest.json"),
  JSON.stringify({ batchCount: BATCH_COUNT, total: compact.length }, null, 2)
);

console.log(`Wrote ${BATCH_COUNT} batch files for ${compact.length} recipes to ${outDir}`);
console.log("sizes:", batches.map((b) => b.length).join(","));
