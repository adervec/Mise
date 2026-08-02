# Mise — Claude/Cowork guide

Interactive cookbook PWA (React + Vite). Recipes execute as scheduled step
DAGs. See README.md for architecture.

## Commands

- `npm run build` — type-check + production build (must pass before done)
- `npm test` — scheduler/runtime/DAG-validation tests
- `npm run extract && node scripts/mergeDags.mjs` — regenerate `public/data/`
  after recipe changes
- `npm run deploy` — build with base `/Mise/` and push to the `gh-pages`
  branch (public site: https://adervec.github.io/Mise/). Deploys are manual;
  pushing `main` alone does not update the site.

## Progress reports

The app logs every finished cook. The user exports it from **Settings →
Cook log → Export** as `mise-cook-log.json` (usually saved to the repo root
or `~/Downloads`). Entry fields: `recipeId`, `title`, `finishedAt`,
`elapsedMin`, `steps {total, completed, skipped}`, `simulate`, `speed`.

When asked to report on progress:
- **Exclude** entries with `simulate: true` or `speed > 1` — those are previews.
- Interesting angles: cooking frequency over time, repeat recipes, skipped-step
  rate (recipes with many skips may have bad DAGs worth fixing), unexplored
  areas of the 114-recipe catalog, elapsed vs planned time.

## Adding or updating recipes

Never edit `public/data/*.json` directly — it's generated. New/changed recipes
go in two committed source files (copy the shape of existing entries):

1. `src/data/extra-recipes.json` — catalog items (`type: "recipe"`, see
   `src/data/types.ts`).
2. `src/data/extra-dags.json` — the step DAG: steps with `id`, `label`,
   `detail`, `durationMin`, `attention` (`active` | `passive` | `wait`),
   `station`, `dependsOn`. Valid stations are in
   `src/execute/model/stations.ts`.

Then: `npm run extract && node scripts/mergeDags.mjs && npm test && npm run build`.
Invalid DAGs fail validation in mergeDags and fall back to linear — fix them
rather than shipping a fallback.

## Constraints

- Keep the execute engine a lazy chunk — nothing in `src/app/` may import from
  `src/execute/` except zero-dependency modules like `cookLog.ts`.
- Catalog JSON is fetched at startup, not bundled.
- The user launches via `Mise.cmd` (or the installed PWA). After changing
  recipes, tell them to run it once so the service worker picks up the update.
