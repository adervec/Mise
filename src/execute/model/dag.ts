import type { Item } from "@/data/types";
import type { RecipeDag, Step } from "./types";
import { HERO_DAGS } from "./heroDags";
import { deriveLinearDag } from "./deriveDag";
import { isDag } from "../scheduler/graph";
import authored from "@/data/recipes.dag.json";

const AUTHORED = authored as unknown as Record<string, RecipeDag>;

export type DagSource = "curated" | "authored" | "draft";

/** A DAG is usable only if its steps are non-empty, ids unique, deps resolve, and it's acyclic. */
function valid(dag: RecipeDag | undefined): dag is RecipeDag {
  if (!dag || !Array.isArray(dag.steps) || dag.steps.length === 0) return false;
  const ids = new Set(dag.steps.map((s) => s.id));
  if (ids.size !== dag.steps.length) return false;
  for (const s of dag.steps) {
    for (const d of s.dependsOn ?? []) if (!ids.has(d)) return false;
  }
  return isDag(dag.steps as Step[]);
}

/** Curated hero DAG > validated LLM-authored DAG > safe linear fallback. */
export function getDag(item: Item): RecipeDag {
  const hero = HERO_DAGS[item.id];
  if (hero) return hero;
  const a = AUTHORED[item.id];
  if (valid(a)) return { ...a, id: item.id };
  return deriveLinearDag(item);
}

export function dagSource(item: Item): DagSource {
  if (HERO_DAGS[item.id]) return "curated";
  if (valid(AUTHORED[item.id])) return "authored";
  return "draft";
}

/** Recipes are executable; everything else is reference material. */
export function isExecutable(item: Item): boolean {
  return item.cat === "recipe" && !!item.checklist?.modules?.length;
}
