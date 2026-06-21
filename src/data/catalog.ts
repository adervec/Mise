import type { Category, DietKey, DietMeta, Guide, Item } from "./types";
import rawItems from "./items.json";
import rawGuides from "./guides.json";

export const items = rawItems as unknown as Item[];
export const guides = rawGuides as unknown as Guide[];

export const itemById = new Map(items.map((i) => [i.id, i]));
export const guideById = new Map(guides.map((g) => [g.id, g]));

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

export const recipes = items.filter((i) => i.cat === "recipe");
