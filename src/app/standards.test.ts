// House font standard: the page loads the shared font.js, the body font follows --app-font,
// and Settings offers the picker. (Static check — jsdom does not compute fonts.)
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("Atkinson Hyperlegible is the default font and Settings offers a choice", () => {
  expect(readFileSync("index.html", "utf8")).toContain('<script src="https://adervec.github.io/font.js"></script>');
  expect(readFileSync("src/styles/theme.css", "utf8")).toMatch(/--body:\s*var\(--app-font,/);
  expect(readFileSync("src/app/Settings.tsx", "utf8")).toContain('createElement("app-font-picker")');
});

test("a connected Drive sync shows the Google account picture", () => {
  expect(readFileSync("src/execute/runtime/driveSync.ts", "utf8")).toContain('picture: j.picture || ""');
  expect(readFileSync("src/app/Settings.tsx", "utf8")).toMatch(/<img\s+src=\{driveProfile\(\)!\.picture\}[\s\S]{0,80}referrerPolicy="no-referrer"/);
});

test("no third-party font CDN, and Settings can erase this app's own data only", () => {
  for (const f of ["index.html", "src/app/GuidePage.tsx"]) expect(readFileSync(f, "utf8")).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  const settings = readFileSync("src/app/Settings.tsx", "utf8");
  expect(settings).toContain("Erase everything");
  expect(settings).toMatch(/startsWith\("mise\."\)/);
});
