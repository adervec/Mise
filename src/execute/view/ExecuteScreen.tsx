import { useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { itemById } from "@/data/catalog";
import { dagSource, isExecutable } from "../model/dag";
import { useExecute } from "../runtime/executeStore";
import TransportBar from "./TransportBar";
import NowNextPanel from "./NowNextPanel";
import Timeline from "./Timeline";

export default function ExecuteScreen() {
  const { id } = useParams();
  const item = id ? itemById.get(id) : undefined;
  const load = useExecute((s) => s.load);
  const teardown = useExecute((s) => s.teardown);
  const play = useExecute((s) => s.play);
  const setSpeed = useExecute((s) => s.setSpeed);
  const setSimulate = useExecute((s) => s.setSimulate);
  const engine = useExecute((s) => s.engine);
  const source = useExecute((s) => s.source);
  const [params] = useSearchParams();
  const autostarted = useRef(false);

  const executable = !!item && isExecutable(item);

  useEffect(() => {
    if (item && executable) load(item, dagSource(item));
    return () => teardown();
  }, [item, executable, load, teardown]);

  // Deep link: /i/:id/cook?play=1&speed=20 auto-starts the cook (demos, kiosks).
  useEffect(() => {
    if (!engine || engine.status !== "ready" || autostarted.current) return;
    if (params.get("play")) {
      autostarted.current = true;
      const sp = Number(params.get("speed"));
      if (sp && sp > 0) setSpeed(sp);
      if (params.get("sim")) setSimulate(true);
      play();
    }
  }, [engine, params, play, setSpeed, setSimulate]);

  if (!item) {
    return (
      <div className="wrap">
        <div className="empty">Recipe not found.</div>
        <Link className="text-btn" to="/">Back to browse</Link>
      </div>
    );
  }

  if (!executable) {
    return (
      <div className="wrap">
        <div style={{ padding: "24px 0 12px" }}>
          <Link className="text-btn" to={`/i/${item.id}`}>← Back</Link>
        </div>
        <div className="empty">This card isn’t an executable recipe — it’s reference material.</div>
      </div>
    );
  }

  if (!engine) {
    return <div className="exec"><div className="now-empty">Planning the cook…</div></div>;
  }

  const total = Math.round(engine.plan.projectedDurationMin);
  const laneCount = engine.plan.lanes.filter((l) => l !== "none").length || engine.plan.lanes.length;

  return (
    <div className="exec">
      <div className="exec-top">
        <div>
          <div style={{ marginBottom: 8 }}>
            <Link className="text-btn" to={`/i/${item.id}`}>← {item.title}</Link>
          </div>
          <div className="exec-title">{item.title}</div>
          <div className="exec-sub">
            <span><b>{total}</b> min planned</span>
            <span>{engine.dag.steps.length} steps</span>
            <span>{laneCount} stations</span>
            {source === "curated" ? (
              <span className="badge-curated">curated flow</span>
            ) : source === "authored" ? (
              <span className="badge-curated">authored flow</span>
            ) : (
              <span className="badge-draft">auto-drafted flow</span>
            )}
          </div>
        </div>
      </div>

      <TransportBar />

      <div className="exec-grid">
        <NowNextPanel dag={engine.dag} />
        <Timeline dag={engine.dag} />
      </div>
    </div>
  );
}
