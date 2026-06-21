import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { loadCatalog } from "./data/catalog";
import "./styles/theme.css";
import "./styles/execute.css";

// Fetch catalog data, then mount. The #root splash shows until this resolves.
loadCatalog().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
