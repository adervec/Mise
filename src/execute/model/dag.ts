import type { Item } from "@/data/types";
import type { RecipeDag, Step } from "./types";
import { HERO_DAGS } from "./heroDags";
import { deriveLinearDag } from "./deriveDag";
import { isDag } from "../scheduler/graph";
import { authoredDags } from "@/data/catalog";

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
  const a = authoredDags[item.id];
  if (valid(a)) return { ...a, id: item.id };
  return deriveLinearDag(item);
}

export function dagSource(item: Item): DagSource {
  if (HERO_DAGS[item.id]) return "curated";
  if (valid(authoredDags[item.id])) return "authored";
  return "draft";
}

/** Recipes are executable; everything else is reference material. */
export function isExecutable(item: Item): boolean {
  return item.cat === "recipe" && !!item.checklist?.modules?.length;
}
