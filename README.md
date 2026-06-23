# Mise — an interactive cookbook you can *run*

A synthesis of the Home Kitchen Masterclass into a single app. Browse 102 recipes
(plus techniques, ingredients, equipment & three editorial field guides), then hit
**Execute** to cook along with a live flow chart — station swimlanes, a moving
playhead, countdowns, and alarms that schedule one cook across parallel work.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build (PWA, offline-ready)
npm test           # scheduler + runtime unit tests
```

Open a recipe → **Execute this recipe**. Deep link to a hands-free demo:
`/i/pasta-carbonara/cook?play=1&speed=30&sim=1`.

## How it works

The flagship is a **schedule-and-play engine** over a per-recipe step DAG.

- **Step DAG** (`src/execute/model`) — each recipe is steps with a duration, an
  `attention` level (`active` = occupies the cook · `passive`/`wait` = free the cook
  but hold a station), a `station`, and `dependsOn` edges.
- **Scheduler** (`src/execute/scheduler`) — pure CPM + resource-constrained list
  scheduling. `wait`/`passive` steps free the cook, so hands-on prep auto-fills the
  unattended windows (chop veg *during* the pressure cook). Multi-burner stations,
  critical-path priority, and adaptive re-planning when a step finishes early/late.
- **Runtime** (`src/execute/runtime`) — a wall-clock state machine (survives
  backgrounded tabs), a 1 Hz logical clock + rAF playhead, Web-Audio alarms, and a
  speed/`Preview` mode.
- **View** (`src/execute/view`) — SVG Gantt with swimlanes + playhead, and a
  hands-free Now/Next panel.

The browse shell (`src/app`) ports the original design system and all 5 themes.

## Data pipeline

```bash
npm run extract                  # source HTML -> public/data/items.json + guides.json
node scripts/prepAuthoring.mjs   # split recipes into batches for DAG authoring
# (LLM workflow authors per-batch DAGs into src/data/_authoring/out-*.json)
node scripts/mergeDags.mjs       # validate + merge -> public/data/recipes.dag.json
```

The catalog JSON lives in `public/data/` and is **fetched at startup** (not bundled),
so the initial JS is ~60 KB gzip; the execute engine is a lazy chunk; the service
worker precaches the JSON for offline use.

Recipe DAGs resolve as **curated hero DAGs** (`heroDags.ts`) → **validated authored
DAGs** (`public/data/recipes.dag.json`, from the LLM authoring pass) → **safe linear
fallback** (`deriveDag.ts`). An invalid DAG can never crash a cook — it falls back.

## Adding recipes

New recipes live in two committed source files that the pipeline merges, so they
survive re-running the extractor:

- `src/data/extra-recipes.json` — full catalog items (merged into `items.json`).
- `src/data/extra-dags.json` — their step DAGs (merged into `recipes.dag.json`).

Run `npm run extract && node scripts/mergeDags.mjs` to regenerate.

## Status

- 114 recipes, all executable; the latest batch is lean/high-protein mains
  (chicken breast, shrimp, cod, tofu, turkey, scallops/fish, tuna, cottage cheese).
- Parallelism concentrates in involved recipes; quick single-track dishes stay linear.
- Source HTML guides (`*.html`) are kept as the data source for the extractor.
