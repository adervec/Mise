import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Browse from "./Browse";
import ItemDetail from "./ItemDetail";
import GuidePage from "./GuidePage";
import Settings from "./Settings";

// The execute engine (scheduler, runtime, SVG timeline) loads on demand.
const ExecuteScreen = lazy(() => import("@/execute/view/ExecuteScreen"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Browse />} />
        <Route path="/i/:id" element={<ItemDetail />} />
        <Route
          path="/i/:id/cook"
          element={
            <Suspense fallback={<div className="exec"><div className="now-empty">Loading the kitchen…</div></div>}>
              <ExecuteScreen />
            </Suspense>
          }
        />
        <Route path="/guide/:id" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Settings />
    </>
  );
}
