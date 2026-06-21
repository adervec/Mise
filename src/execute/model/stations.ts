import type { Attention, StationId } from "./types";

interface StationMeta {
  id: StationId;
  label: string;
  short: string;
}

// Display order for swimlanes (top to bottom). `none` items collapse into the cook lane.
export const STATIONS: StationMeta[] = [
  { id: "stove", label: "Stove", short: "STOVE" },
  { id: "oven", label: "Oven", short: "OVEN" },
  { id: "pressure", label: "Pressure cooker", short: "PRESSURE" },
  { id: "microwave", label: "Microwave", short: "MICRO" },
  { id: "mixer", label: "Mixer / blender", short: "MIXER" },
  { id: "board", label: "Cutting board", short: "BOARD" },
  { id: "counter", label: "Counter", short: "COUNTER" },
  { id: "sink", label: "Sink", short: "SINK" },
  { id: "fridge", label: "Fridge / freezer", short: "FRIDGE" },
  { id: "none", label: "Hands", short: "HANDS" },
];

export const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));
export const STATION_ORDER: StationId[] = STATIONS.map((s) => s.id);

// How many things can occupy a station at once (e.g. burners on a stove).
// `none` is unlimited. Used by the scheduler for resource contention.
export const STATION_CAPACITY: Record<StationId, number> = {
  stove: 4, // burners
  oven: 1,
  pressure: 1,
  microwave: 1,
  mixer: 1,
  board: 1,
  sink: 2,
  counter: 8,
  fridge: 8,
  none: Infinity,
};

export function stationCapacity(id: StationId): number {
  return STATION_CAPACITY[id] ?? 1;
}

export function stationLabel(id: StationId): string {
  return STATION_BY_ID.get(id)?.short ?? id.toUpperCase();
}

// CSS custom-property name carrying the colour for an attention level.
export const ATTENTION_VAR: Record<Attention, string> = {
  active: "--accent", // hands-on, warm
  passive: "--accent-2", // monitor, gold
  wait: "--accent-6", // unattended, cool blue
};

export const ATTENTION_LABEL: Record<Attention, string> = {
  active: "Hands-on",
  passive: "Monitor",
  wait: "Unattended",
};
