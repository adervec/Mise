// Extracts source HTML guides into JSON the app consumes.
//   - kitchen_masterclass.html  ->  src/data/items.json   (all 215 catalog items)
//   - coffee/tea/alcohol guides ->  src/data/guides.json  (editorial reference pages)
// Run: npm run extract
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dataDir = resolve(root, "public/data");
mkdirSync(dataDir, { recursive: true });

function read(file) {
  return readFileSync(resolve(root, file), "utf8");
}

/* ---------- masterclass catalog ---------- */
function extractItems() {
  const html = read("kitchen_masterclass.html");
  const m = html.match(/const DATA = (\[[\s\S]*?\]);<\/script>/);
  if (!m) throw new Error("Could not locate `const DATA = [...]` in masterclass.");
  const items = JSON.parse(m[1]);
  writeFileSync(resolve(dataDir, "items.json"), JSON.stringify(items));
  const byCat = items.reduce((a, x) => ((a[x.cat] = (a[x.cat] || 0) + 1), a), {});
  console.log(`items.json: ${items.length} items`, byCat);
  return items;
}

/* ---------- editorial guides ---------- */
const GUIDE_FILES = [
  { id: "coffee", file: "coffee-guide.html" },
  { id: "tea", file: "tea-guide.html" },
  { id: "alcohol", file: "alcohol-guide.html" },
];

function inner(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1] : "";
}

function firstText(html, re) {
  const m = html.match(re);
  if (!m) return "";
  return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractGuides() {
  const guides = GUIDE_FILES.map(({ id, file }) => {
    const html = read(file);
    const title = firstText(html, /<title>([\s\S]*?)<\/title>/i);
    const style = inner(html, "style");
    // body minus any trailing <script> blocks
    let body = inner(html, "body").replace(/<script[\s\S]*?<\/script>/gi, "").trim();
    const summary =
      firstText(html, /<p class="lede"[^>]*>([\s\S]*?)<\/p>/i) ||
      firstText(html, /<p[^>]*>([\s\S]*?)<\/p>/i);
    return { id, title, summary, style, body };
  });
  writeFileSync(resolve(dataDir, "guides.json"), JSON.stringify(guides));
  console.log(
    `guides.json: ${guides.length} guides`,
    guides.map((g) => `${g.id}(${g.body.length}b)`).join(", ")
  );
  return guides;
}

extractItems();
extractGuides();
console.log("done.");
