import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Browse from "./Browse";
import ItemDetail from "./ItemDetail";
import GuidePage from "./GuidePage";
import Settings from "./Settings";
import ExecuteScreen from "@/execute/view/ExecuteScreen";

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
        <Route path="/i/:id/cook" element={<ExecuteScreen />} />
        <Route path="/guide/:id" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Settings />
    </>
  );
}
