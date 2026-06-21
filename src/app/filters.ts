import { create } from "zustand";
import type { Category, DietKey, Item } from "@/data/types";
import { DIETS } from "@/data/catalog";

export type SortMode = "default" | "az" | "time-asc" | "time-desc" | "cal-asc";

export const SORT_LABELS: Record<SortMode, string> = {
  default: "Curated",
  az: "A → Z",
  "time-asc": "Time: quick first",
  "time-desc": "Time: long first",
  "cal-asc": "Calories: low first",
};

type DietFilter = Partial<Record<DietKey, boolean>>;

interface FilterState {
  search: string;
  cat: Category | "all";
  sort: SortMode;
  diet: DietFilter;
  setSearch: (s: string) => void;
  setCat: (c: Category | "all") => void;
  setSort: (s: SortMode) => void;
  toggleDiet: (k: DietKey) => void;
  clearDiet: () => void;
  activeDietKeys: () => DietKey[];
}

export const useFilters = create<FilterState>((set, get) => ({
  search: "",
  cat: "all",
  sort: "default",
  diet: {},
  setSearch: (search) => set({ search }),
  setCat: (cat) => set({ cat }),
  setSort: (sort) => set({ sort }),
  toggleDiet: (k) => set((st) => ({ diet: { ...st.diet, [k]: !st.diet[k] } })),
  clearDiet: () => set({ diet: {} }),
  activeDietKeys: () => DIETS.map((d) => d.key).filter((k) => get().diet[k]),
}));

/** Pure filter+sort applied to the catalog. */
export function applyFilters(
  items: Item[],
  opts: { search: string; cat: Category | "all"; sort: SortMode; diet: DietFilter }
): Item[] {
  const q = opts.search.trim().toLowerCase();
  const activeDiet = DIETS.map((d) => d.key).filter((k) => opts.diet[k]);

  let out = items.filter((it) => {
    if (opts.cat !== "all" && it.cat !== opts.cat) return false;
    if (q) {
      const hay = (it.title + " " + it.summary + " " + it.tags.join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    // Diet filters apply only to items that declare a diet (recipes); others pass through.
    if (activeDiet.length && it.diet) {
      if (!activeDiet.every((k) => it.diet![k])) return false;
    }
    return true;
  });

  out = sortItems(out, opts.sort);
  return out;
}

function sortItems(items: Item[], sort: SortMode): Item[] {
  const arr = [...items];
  switch (sort) {
    case "az":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "time-asc":
      return arr.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
    case "time-desc":
      return arr.sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity));
    case "cal-asc":
      return arr.sort(
        (a, b) => (a.nutrition?.cal ?? Infinity) - (b.nutrition?.cal ?? Infinity)
      );
    default:
      return arr; // curated = source order
  }
}
