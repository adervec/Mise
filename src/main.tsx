import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { loadCatalog } from "./data/catalog";
import { autoSyncCookLog } from "./execute/runtime/driveSync";
import "./styles/theme.css";
import "./styles/execute.css";

// Tell the maker's app portal (same-origin localStorage on adervec.github.io)
// that Mise is installed. Installed-only: a plain browser tab must not register.
try {
  const installedModes = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"];
  if (installedModes.some((m) => matchMedia(`(display-mode: ${m})`).matches)) {
    const KEY = "portal-installed";
    const registry: Record<string, number> = JSON.parse(localStorage.getItem(KEY) || "{}");
    registry.Mise = Date.now();
    localStorage.setItem(KEY, JSON.stringify(registry));
  }
} catch {
  // no localStorage (private mode) or unparseable registry — the portal can wait
}

// Fetch catalog data, then mount. The #root splash shows until this resolves.
loadCatalog().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
  autoSyncCookLog(); // pulls cooks logged on another device; no-op until connected
});
