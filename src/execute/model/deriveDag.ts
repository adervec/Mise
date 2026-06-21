import type { Item } from "@/data/types";
import type { Attention, RecipeDag, StationId, Step } from "./types";

/** Decode the handful of HTML entities that appear in source step text. */
export function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Sum every duration token in a step (upper bound of ranges), in minutes.
 * "High pressure, 75 min. Natural release 20 min" -> 95.  Returns null if none.
 */
export function parseDurationMin(text: string): number | null {
  const t = text.toLowerCase();
  if (/\bovernight\b/.test(t)) return 8 * 60;
  const re =
    /(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/g;
  let total = 0;
  let found = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const hi = m[2] ? parseFloat(m[2]) : parseFloat(m[1]);
    const unit = m[3];
    let v = hi;
    if (/^h/.test(unit)) v = hi * 60;
    else if (/^m/.test(unit)) v = hi;
    else v = hi / 60; // seconds
    total += v;
    found = true;
  }
  return found ? Math.max(1, Math.round(total)) : null;
}

const WAIT_KW =
  /(pressure cook|high pressure|natural release|\bbake\b|\broast\b|broil|chill|refrigerate|freeze|marinate|\brest\b|\brise\b|proof|overnight|soak|brine|set aside|let it cool|\bcool\b)/;
const PASSIVE_KW =
  /(simmer|reduce|steep|render|braise|until golden|until browned|until thick|until reduced|low heat|on a low|gentle)/;

export function classifyAttention(text: string, durationMin: number | null): Attention {
  const t = text.toLowerCase();
  if (/\bovernight\b/.test(t)) return "wait";
  if (WAIT_KW.test(t)) return "wait";
  if (PASSIVE_KW.test(t)) return durationMin != null && durationMin >= 30 ? "wait" : "passive";
  return "active";
}

export function classifyStation(text: string): StationId {
  const t = text.toLowerCase();
  if (/instant pot|pressure cook|high pressure|natural release|pressure cooker/.test(t)) return "pressure";
  if (/\boven\b|\broast\b|\bbake\b|broil|sheet pan|sheet-pan/.test(t)) return "oven";
  if (/microwave/.test(t)) return "microwave";
  if (/blend(er)?|food processor|mixer|stand mixer/.test(t)) return "mixer";
  if (/skillet|saut|sear|\bfry\b|frying|\bpan\b|\bpot\b|stove|simmer|\bboil|deglaze|reduce|over (medium|high|low)|nonstick/.test(t)) return "stove";
  if (/chop|dice|slice|mince|\bcut\b|cutting board|julienne|grate/.test(t)) return "board";
  if (/rinse|drain|\bwash\b|colander|strain/.test(t)) return "sink";
  if (/refrigerate|fridge|\bchill\b|freezer|freeze/.test(t)) return "fridge";
  if (/\brest\b|\bcool\b|set aside|on the counter/.test(t)) return "counter";
  return "none";
}

function labelFrom(text: string): string {
  let head = text.split(/[.:]/)[0].trim();
  if (!head) head = text;
  if (head.length > 46) head = head.slice(0, 44).trim() + "…";
  return head;
}

function estimate(attention: Attention): number {
  return attention === "wait" ? 15 : attention === "passive" ? 8 : 2;
}

/**
 * Safe linear fallback DAG from a recipe's checklist modules.
 * Fully sequential — correct but unoptimised; curated DAGs add real parallelism.
 */
export function deriveLinearDag(item: Item): RecipeDag {
  const steps: Step[] = [];
  steps.push({
    id: "prep",
    label: "Mise en place",
    detail: "Gather, measure, and prep all ingredients before you start.",
    durationMin: Math.max(3, Math.round((item.time ?? 20) * 0.15)),
    durationConfidence: "estimated",
    attention: "active",
    station: "board",
    dependsOn: [],
    timer: false,
    phase: "prep",
  });

  let prev = "prep";
  let n = 0;
  for (const mod of item.checklist?.modules ?? []) {
    for (const raw of mod.steps) {
      const text = decode(raw);
      const id = "s" + n++;
      const dur = parseDurationMin(text);
      const attention = classifyAttention(text, dur);
      const station = classifyStation(text);
      steps.push({
        id,
        label: labelFrom(text),
        detail: text,
        durationMin: dur ?? estimate(attention),
        durationConfidence: dur != null ? "explicit" : "estimated",
        attention,
        station,
        dependsOn: [prev],
        timer: attention !== "active" && (dur ?? 0) >= 2,
        phase: "cook",
      });
      prev = id;
    }
  }

  return { id: item.id, steps, draft: true };
}
