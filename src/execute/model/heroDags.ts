import type { Attention, Phase, RecipeDag, StationId, Step } from "./types";

// Compact builder for hand-authored steps.
function s(
  id: string,
  label: string,
  detail: string,
  durationMin: number,
  attention: Attention,
  station: StationId,
  dependsOn: string[],
  opts: { phase?: Phase; timer?: boolean; estimated?: boolean } = {}
): Step {
  return {
    id,
    label,
    detail,
    durationMin,
    durationConfidence: opts.estimated ? "estimated" : "explicit",
    attention,
    station,
    dependsOn,
    timer: opts.timer ?? (attention !== "active" && durationMin >= 2),
    phase: opts.phase ?? "cook",
  };
}

/* ============================================================
   1. Instant Pot Beef Shank Tendon Stew
   Showcase: prep fills a 95-min unattended pressure window.
   ============================================================ */
const beefShankStew: RecipeDag = {
  id: "beef-shank-stew",
  serves: 6,
  steps: [
    s("prep", "Mise en place", "Dice onions, smash garlic, slice ginger, measure liquids.", 6, "active", "board", [], { phase: "prep" }),
    s("saute", "Sauté aromatics", "Instant Pot on Sauté (high). Oil, then onions/garlic/ginger 5–6 min. Stir in tomato paste, cook 1 min.", 6, "active", "stove", ["prep"]),
    s("deglaze", "Deglaze", "Pour in wine, scrape the bottom. Bubble 1 min.", 1, "active", "stove", ["saute"]),
    s("addStock", "Add flexors & broth", "Wedge frozen flexors in. Pour broth + soy sauce. Drop in bay/anise. No vegetables yet.", 2, "active", "pressure", ["deglaze"]),
    s("pressure1", "First pressure cook", "High pressure 75 min, then natural release at least 20 min.", 95, "wait", "pressure", ["addStock"], { timer: true }),
    s("chopVeg", "Chunk carrots & potatoes", "Chunk 4 carrots and 1.5 lb Yukon Gold potatoes while the pot runs.", 10, "active", "board", ["prep"]),
    s("addVeg", "Check & add vegetables", "If still firm, give it more time. Add carrots, potatoes, salt, pepper.", 3, "active", "pressure", ["pressure1", "chopVeg"]),
    s("pressure2", "Second pressure cook", "High pressure 5 min, quick release.", 8, "wait", "pressure", ["addVeg"], { timer: true }),
    s("finish", "Finish & portion", "Pull bay/anise. Cool slightly, then portion into containers.", 5, "active", "counter", ["pressure2"], { phase: "cleanup" }),
  ],
};

/* ============================================================
   2. Whole Roast Chicken (the roasting session)
   Showcase: season the bird DURING the oven preheat; long roast + rest.
   ============================================================ */
const wholeRoastChicken: RecipeDag = {
  id: "whole-roast-chicken",
  serves: 4,
  steps: [
    s("preheat", "Preheat oven to 425°F", "Get the oven fully up to temperature before the bird goes in.", 12, "wait", "oven", [], { phase: "prep", timer: true }),
    s("season", "Pat dry, salt & season", "Pat a 3–4 lb chicken bone-dry. Salt the cavity, rub oil/butter, then salt, pepper, garlic powder, paprika. Tie the legs.", 8, "active", "board", [], { phase: "prep" }),
    s("panSetup", "Set in the pan", "Breast-side up in a cast-iron or sheet pan. Scatter onion wedges and garlic around it.", 3, "active", "counter", ["season"]),
    s("roast", "Roast to 165°F", "Roast 60–75 min until the thigh reads 165°F.", 75, "wait", "oven", ["preheat", "panSetup"], { timer: true }),
    s("rest", "Rest before carving", "Rest 15 min so the juices redistribute.", 15, "wait", "counter", ["roast"], { timer: true }),
    s("carve", "Carve & serve", "Carve and plate. Save the carcass for broth.", 5, "active", "board", ["rest"], { phase: "cleanup" }),
  ],
};

/* ============================================================
   3. Carbonara
   Showcase: boil water ‖ render pancetta ‖ whisk eggs, then a tight finish.
   ============================================================ */
const carbonara: RecipeDag = {
  id: "pasta-carbonara",
  serves: 2,
  steps: [
    s("prep", "Mise en place", "Grate pecorino, dice pancetta, separate 3 yolks + 1 whole egg, crack lots of pepper.", 5, "active", "board", [], { phase: "prep" }),
    s("boil", "Boil salted water", "Bring a big pot of water to a boil. Salt it well.", 8, "passive", "stove", ["prep"], { timer: true }),
    s("render", "Render the pancetta", "Cold skillet, pancetta, medium heat 5–7 min until fat renders and it crisps. Off heat; keep ~2 tbsp fat.", 7, "passive", "stove", ["prep"]),
    s("eggMix", "Whisk the egg mixture", "Whisk yolks + egg + grated cheese + black pepper into a thick paste. Set aside.", 3, "active", "board", ["prep"]),
    s("cookPasta", "Cook the pasta", "Add pasta to the boiling water. Cook 1 min less than the package says.", 9, "passive", "stove", ["boil"], { timer: true }),
    s("drain", "Reserve water & drain", "Reserve 1 cup pasta water, then drain.", 1, "active", "sink", ["cookPasta"]),
    s("toss", "Combine off heat", "Add the drained pasta to the skillet with the pancetta, off heat. Toss to coat.", 1, "active", "stove", ["drain", "render"]),
    s("temper", "Temper the eggs", "Whisk a few tbsp of hot pasta water into the egg mixture to warm it without scrambling.", 1, "active", "counter", ["toss", "eggMix"]),
    s("emulsify", "Toss into a glossy sauce", "Pour the tempered eggs over the pasta, tossing constantly. Residual heat makes a glossy sauce; add pasta water to loosen.", 2, "active", "stove", ["temper"]),
    s("plate", "Plate immediately", "Plate right away with more cheese and black pepper.", 1, "active", "counter", ["emulsify"], { phase: "cleanup" }),
  ],
};

export const HERO_DAGS: Record<string, RecipeDag> = {
  [beefShankStew.id]: beefShankStew,
  [wholeRoastChicken.id]: wholeRoastChicken,
  [carbonara.id]: carbonara,
};
