// Build for GitHub Pages and force-push dist to the gh-pages branch.
// Run: npm run deploy   (site: https://adervec.github.io/Mise/)
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

// House standard: nothing reaches the live site unless the checks passed (execSync throws on failure).
run("npm test");

process.env.GHPAGES_BASE = "/Mise/";
run("npm run build");

// SPA fallback so deep links (e.g. /Mise/guide/protein) load the app
copyFileSync("dist/index.html", "dist/404.html");

rmSync("dist/.git", { recursive: true, force: true });
run("git init -b gh-pages", { cwd: "dist" });
run("git add -A", { cwd: "dist" });
run('git commit -m "deploy"', { cwd: "dist" });
run("git push -f https://github.com/adervec/Mise.git gh-pages:gh-pages", { cwd: "dist" });
console.log("pushed: https://adervec.github.io/Mise/ (Pages publishes it in about a minute)");

// House standards: check the LIVE site, then tag the release. The check is the shared one in
// CoworkSyncHub (it retries while Pages catches up); its one dependency is installed there once.
const HUB = "../CoworkSyncHub";
if (!existsSync(`${HUB}/node_modules/playwright-core`)) run(`npm i --no-save --prefix ${HUB} playwright-core@1.62.0`);
run(`node ${HUB}/live-check.mjs https://adervec.github.io/Mise/ --tries 6 --wait 20`);
const tag = "deploy-" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
run(`git tag -a ${tag} -m "Deployed to https://adervec.github.io/Mise/ and passed the live check"`);
run(`git push origin ${tag}`);
console.log(`deployed and tagged ${tag}`);
