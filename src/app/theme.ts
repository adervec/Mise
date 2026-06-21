import { create } from "zustand";

export const THEMES = [
  { id: "ember", name: "Ember", swatch: ["#0c0a09", "#e5723f", "#d4a857"] },
  { id: "midnight", name: "Midnight", swatch: ["#0a0c12", "#5b8cff", "#52d1c8"] },
  { id: "forest", name: "Forest", swatch: ["#0a0f0c", "#6fae5a", "#d9b44a"] },
  { id: "paper", name: "Paper", swatch: ["#f5f1ea", "#c25a2a", "#b08423"] },
  { id: "mono", name: "Mono", swatch: ["#0d0d0d", "#e8e8e8", "#c9a227"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "mise.theme";

function readInitial(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  if (saved && THEMES.some((t) => t.id === saved)) return saved;
  return "ember";
}

function apply(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
}

interface ThemeState {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

export const useTheme = create<ThemeState>((set) => {
  const initial = readInitial();
  apply(initial);
  return {
    theme: initial,
    setTheme: (id) => {
      apply(id);
      localStorage.setItem(STORAGE_KEY, id);
      set({ theme: id });
    },
  };
});
