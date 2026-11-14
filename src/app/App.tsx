import { createElement, useEffect, lazy, Suspense } from "react";
import { useUi } from "./ui";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Browse from "./Browse";
import ItemDetail from "./ItemDetail";
import GuidePage from "./GuidePage";
import Settings from "./Settings";
import { t } from "@/i18n";

// The execute engine (scheduler, runtime, SVG timeline) loads on demand.
const ExecuteScreen = lazy(() => import("@/execute/view/ExecuteScreen"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  // the corner avatar (font.js <app-account>) opens Settings, where Drive sync lives
  useEffect(() => { const open = () => useUi.getState().openSettings(); document.addEventListener("app-account-click", open); return () => document.removeEventListener("app-account-click", open); }, []);
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Browse />} />
        <Route path="/i/:id" element={<ItemDetail />} />
        <Route
          path="/i/:id/cook"
          element={
            <Suspense fallback={<div className="exec"><div className="now-empty">{t("Loading the kitchen…")}</div></div>}>
              <ExecuteScreen />
            </Suspense>
          }
        />
        <Route path="/guide/:id" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Settings />
      {/* house standard: the signed-in Google picture in the corner of every page, like YouTube; click opens Settings */}
      <div style={{ position: "fixed", top: "calc(10px + env(safe-area-inset-top, 0px))", right: 12, zIndex: 50 }}>{createElement("app-account")}</div>
    </>
  );
}
