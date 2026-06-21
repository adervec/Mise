// Catalog item shape — mirrors the source `DATA` objects from the masterclass.

export type Category =
  | "recipe"
  | "prep"
  | "technique"
  | "equipment"
  | "reference"
  | "ingredient";

export interface Nutrition {
  cal: number;
  protein: string;
  carbs: string;
  fat: string;
  serving: string;
}

export type DietKey =
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "glutenFree"
  | "dairyFree"
  | "nutFree"
  | "eggFree"
  | "porkFree"
  | "shellfishFree"
  | "halal"
  | "kosher";

export type Diet = Record<DietKey, boolean>;

export interface ChecklistModule {
  title: string;
  steps: string[];
}

export interface Checklist {
  prep: string[];
  modules: ChecklistModule[];
  cleanup: string[];
}

export interface Item {
  id: string;
  cat: Category;
  title: string;
  summary: string;
  time: number | null;
  timeLabel?: string;
  tags: string[];
  body: string; // HTML
  uuid?: string;
  // recipe-only extras (optional)
  nutrition?: Nutrition;
  diet?: Diet;
  showDiet?: boolean;
  doable?: boolean;
  checklist?: Checklist;
}

export interface Guide {
  id: string;
  title: string;
  summary: string;
  style: string;
  body: string; // HTML
}

export interface DietMeta {
  key: DietKey;
  label: string;
  badge: string;
  note: string;
}
