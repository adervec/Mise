// Build for GitHub Pages and force-push dist to the gh-pages branch.
// Run: npm run deploy   (site: https://adervec.github.io/Mise/)
import { execSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

process.env.GHPAGES_BASE = "/Mise/";
run("npm run build");

// SPA fallback so deep links (e.g. /Mise/guide/protein) load the app
copyFileSync("dist/index.html", "dist/404.html");

rmSync("dist/.git", { recursive: true, force: true });
run("git init -b gh-pages", { cwd: "dist" });
run("git add -A", { cwd: "dist" });
run('git commit -m "deploy"', { cwd: "dist" });
run("git push -f https://github.com/adervec/Mise.git gh-pages:gh-pages", { cwd: "dist" });
console.log("deployed: https://adervec.github.io/Mise/");
