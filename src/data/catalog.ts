import type { Category, DietKey, DietMeta, Guide, Item } from "./types";
import type { RecipeDag } from "@/execute/model/types";

// Catalog data is fetched at startup (see loadCatalog) rather than bundled, to keep
// the initial JS small. These live bindings are populated before the app renders.
export let items: Item[] = [];
export let guides: Guide[] = [];
export let recipes: Item[] = [];
export let itemById = new Map<string, Item>();
export let guideById = new Map<string, Guide>();
export let authoredDags: Record<string, RecipeDag> = {};

let loaded = false;

export async function loadCatalog(): Promise<void> {
  if (loaded) return;
  const base = import.meta.env.BASE_URL;
  const [it, gu, dg] = await Promise.all([
    fetch(base + "data/items.json").then((r) => r.json()),
    fetch(base + "data/guides.json").then((r) => r.json()),
    fetch(base + "data/recipes.dag.json").then((r) => r.json()),
  ]);
  items = it as Item[];
  guides = gu as Guide[];
  recipes = items.filter((i) => i.cat === "recipe");
  itemById = new Map(items.map((i) => [i.id, i]));
  guideById = new Map(guides.map((g) => [g.id, g]));
  authoredDags = dg as Record<string, RecipeDag>;
  loaded = true;
}

export const CAT_LABELS: Record<Category, string> = {
  recipe: "Recipe",
  prep: "Prep & Freeze",
  technique: "Technique",
  equipment: "Equipment",
  reference: "Reference",
  ingredient: "Ingredient",
};

export const CATEGORY_ORDER: Category[] = [
  "recipe",
  "prep",
  "technique",
  "ingredient",
  "equipment",
  "reference",
];

export const DIETS: DietMeta[] = [
  { key: "vegan", label: "Vegan", badge: "Vegan", note: "no animal products" },
  { key: "vegetarian", label: "Vegetarian", badge: "Veg", note: "no meat or fish" },
  { key: "pescatarian", label: "Pescatarian", badge: "Pesc", note: "no meat; fish OK" },
  { key: "glutenFree", label: "Gluten-free", badge: "GF", note: "no gluten as written" },
  { key: "dairyFree", label: "Dairy-free", badge: "DF", note: "no milk products" },
  { key: "nutFree", label: "Nut-free", badge: "NF", note: "no peanuts/tree nuts" },
  { key: "eggFree", label: "Egg-free", badge: "EF", note: "no eggs" },
  { key: "porkFree", label: "Pork-free", badge: "Pork-free", note: "no pork products" },
  { key: "shellfishFree", label: "Shellfish-free", badge: "SF", note: "no shellfish" },
  { key: "halal", label: "Halal-friendly", badge: "Halal", note: "no pork or alcohol; source halal meat" },
  { key: "kosher", label: "Kosher-friendly", badge: "Kosher", note: "no pork/shellfish; no meat+dairy mix" },
];

export const DIET_BY_KEY = Object.fromEntries(DIETS.map((d) => [d.key, d])) as Record<
  DietKey,
  DietMeta
>;

// Which diet badges to surface on a card (avoid clutter): positive/notable ones.
export const BADGE_PRIORITY: DietKey[] = [
  "vegan",
  "vegetarian",
  "pescatarian",
  "glutenFree",
  "dairyFree",
  "halal",
  "kosher",
];
