import { useExecute } from "../runtime/executeStore";
import * as E from "../runtime/engine";

const SPEEDS = [1, 5, 20, 60];
const COOKS = [1, 2, 3];

function fmtClock(min: number): string {
  const s = Math.max(0, Math.round(min * 60));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function TransportBar() {
  const engine = useExecute((s) => s.engine);
  useExecute((s) => s.tick);
  const play = useExecute((s) => s.play);
  const pause = useExecute((s) => s.pause);
  const reset = useExecute((s) => s.reset);
  const setCooks = useExecute((s) => s.setCooks);
  const setSpeed = useExecute((s) => s.setSpeed);
  const setSimulate = useExecute((s) => s.setSimulate);
  if (!engine) return null;

  const running = engine.status === "running";
  const elapsed = E.elapsedMin(engine, Date.now());
  const total = Math.max(1, engine.plan.projectedDurationMin);
  const pct = Math.min(100, (elapsed / total) * 100);

  return (
    <div className="transport">
      <button
        className="play-btn"
        onClick={() => (running ? pause() : play())}
        aria-label={running ? "Pause" : "Play"}
        disabled={engine.status === "completed"}
      >
        {running ? (
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      <button className="text-btn" onClick={reset}>Reset</button>

      <div className="clock">
        <span className="big">{fmtClock(elapsed)}</span>
        <span className="tot">/ {fmtClock(total)} planned</span>
      </div>

      <div className="progress-bar"><i style={{ width: `${pct}%` }} /></div>

      {engine.status === "ready" && (
        <div className="seg" aria-label="Cooks">
          <span className="seg-label" style={{ alignSelf: "center", padding: "0 8px" }}>Cooks</span>
          {COOKS.map((c) => (
            <button key={c} className={engine.cooks === c ? "on" : ""} onClick={() => setCooks(c)}>{c}</button>
          ))}
        </div>
      )}

      <div className="seg" aria-label="Speed">
        <span className="seg-label" style={{ alignSelf: "center", padding: "0 8px" }}>Speed</span>
        {SPEEDS.map((sp) => (
          <button key={sp} className={engine.speed === sp ? "on" : ""} onClick={() => setSpeed(sp)}>{sp}×</button>
        ))}
      </div>

      <button
        className={"text-btn" + (engine.simulate ? " " : "")}
        style={engine.simulate ? { borderColor: "var(--accent)", color: "var(--ink)" } : undefined}
        onClick={() => setSimulate(!engine.simulate)}
        title="Preview the whole cook hands-free (auto-advances every step)"
      >
        {engine.simulate ? "Preview: on" : "Preview"}
      </button>
    </div>
  );
}
