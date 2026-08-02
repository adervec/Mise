import { create } from "zustand";

export const ORIENTATIONS = [
  { id: "auto", name: "Auto" },
  { id: "portrait", name: "Portrait" },
  { id: "landscape", name: "Landscape" },
] as const;

export type OrientationId = (typeof ORIENTATIONS)[number]["id"];

const STORAGE_KEY = "mise.orientation";

// lock() is absent from TS lib.dom (and from iOS Safari); feature-detect it.
type LockableOrientation = ScreenOrientation & {
  lock?: (o: "portrait" | "landscape") => Promise<void>;
};

function readInitial(): OrientationId {
  const saved = localStorage.getItem(STORAGE_KEY) as OrientationId | null;
  if (saved && ORIENTATIONS.some((o) => o.id === saved)) return saved;
  return "auto";
}

// Resolves false when the browser refuses (plain tab, iOS) so the UI can say so.
async function apply(id: OrientationId): Promise<boolean> {
  const so = screen.orientation as LockableOrientation | undefined;
  if (!so) return false;
  try {
    if (id === "auto") {
      so.unlock();
      return true;
    }
    if (!so.lock) return false;
    await so.lock(id);
    return true;
  } catch {
    return false;
  }
}

interface OrientationState {
  orientation: OrientationId;
  lockFailed: boolean;
  setOrientation: (id: OrientationId) => void;
}

export const useOrientation = create<OrientationState>((set) => {
  const initial = readInitial();
  if (initial !== "auto") void apply(initial).then((ok) => set({ lockFailed: !ok }));
  return {
    orientation: initial,
    lockFailed: false,
    setOrientation: (id) => {
      localStorage.setItem(STORAGE_KEY, id);
      set({ orientation: id });
      void apply(id).then((ok) => set({ lockFailed: id !== "auto" && !ok }));
    },
  };
});
