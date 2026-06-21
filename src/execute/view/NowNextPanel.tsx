import type { RecipeDag } from "../model/types";
import { ATTENTION_LABEL, stationLabel } from "../model/stations";
import { useExecute } from "../runtime/executeStore";
import * as E from "../runtime/engine";

function fmt(min: number): string {
  const sign = min < 0 ? "-" : "";
  const s = Math.round(Math.abs(min) * 60);
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function NowNextPanel({ dag }: { dag: RecipeDag }) {
  const engine = useExecute((s) => s.engine);
  useExecute((s) => s.tick);
  const complete = useExecute((s) => s.complete);
  const skip = useExecute((s) => s.skip);
  const resumed = useExecute((s) => s.resumed);
  if (!engine) return null;

  const elapsed = E.elapsedMin(engine, Date.now());
  const stepById = new Map(dag.steps.map((s) => [s.id, s]));

  const active = dag.steps.filter((s) => engine.steps[s.id].status === "active");
  const upcoming = dag.steps
    .filter((s) => engine.steps[s.id].status === "pending")
    .map((s) => ({ s, start: engine.plan.steps[s.id].start }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);

  if (engine.status === "completed") {
    return (
      <div className="now-panel">
        <div className="now-card attn-passive">
          <div className="now-eyebrow"><span>Done</span></div>
          <h3>Plated.</h3>
          <p>Finished in {fmt(E.elapsedMin(engine, Date.now()))}. Nicely done.</p>
        </div>
      </div>
    );
  }

  const liveText = active.length
    ? `Now: ${active.map((s) => s.label).join("; ")}`
    : engine.status === "running"
      ? "Waiting for the next step."
      : "";

  return (
    <div className="now-panel">
      <div aria-live="polite" className="sr-only">{liveText}</div>
      {resumed && engine.status === "paused" && (
        <div className="now-card" style={{ borderLeft: "4px solid var(--accent-3)" }}>
          <div className="now-eyebrow"><span>Resumed</span></div>
          <p>Picked up where you left off. Press play to continue the cook.</p>
        </div>
      )}
      {engine.status === "ready" && (
        <div className="now-card">
          <div className="now-eyebrow"><span>Ready</span></div>
          <h3>Press play to start cooking.</h3>
          <p>The flow chart will light up step by step. Timers fire on their own; tap “Done” when you finish a hands-on step.</p>
        </div>
      )}

      {active.length === 0 && engine.status === "running" && (
        <div className="now-card">
          <div className="now-eyebrow"><span>Now</span></div>
          <div className="now-empty">Hold tight — next step coming up.</div>
        </div>
      )}

      {active.map((s) => {
        const run = engine.steps[s.id];
        const sched = engine.plan.steps[s.id];
        const remaining = sched.end - elapsed;
        const startMin = run.startMin ?? sched.start;
        const elapsedInStep = elapsed - startMin;
        return (
          <div key={s.id} className={`now-card attn-${s.attention}`}>
            <div className="now-eyebrow">
              <span>Now · {ATTENTION_LABEL[s.attention]}</span>
              <span className="station-pill">{stationLabel(s.station)}</span>
            </div>
            <h3>{s.label}</h3>
            <p>{s.detail}</p>
            {s.attention === "active" ? (
              <div className="now-countdown">{fmt(elapsedInStep)} <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>elapsed · ~{Math.round(s.durationMin)}m</span></div>
            ) : (
              <div className="now-countdown">{fmt(Math.max(0, remaining))} <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>left</span></div>
            )}
            <div className="now-actions">
              <button className="now-done" onClick={() => complete(s.id)}>
                {s.attention === "active" ? "Done" : "Done early"}
              </button>
              <button className="text-btn" onClick={() => skip(s.id)}>Skip</button>
            </div>
          </div>
        );
      })}

      {upcoming.length > 0 && (
        <div className="next-list">
          <h4>Next up</h4>
          {upcoming.map(({ s, start }) => (
            <div className="next-item" key={s.id}>
              <span className="at">{fmt(Math.max(0, start - elapsed))}</span>
              <span style={{ flex: 1 }}>{stepById.get(s.id)!.label}</span>
              <span className="station-pill">{stationLabel(s.station)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
