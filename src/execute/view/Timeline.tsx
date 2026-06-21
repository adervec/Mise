import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecipeDag, ScheduleResult, StationId } from "../model/types";
import { ATTENTION_VAR, stationLabel } from "../model/stations";
import { useExecute } from "../runtime/executeStore";
import * as E from "../runtime/engine";

const LABEL_W = 78;
const ROW_H = 30;
const LANE_PAD = 6;
const HEADER_H = 22;
const RIGHT_PAD = 24;

interface Placed {
  id: string;
  laneY: number;
  subRow: number;
  start: number;
  end: number;
  dur: number;
  station: StationId;
}

interface LaneLayout {
  station: StationId;
  y: number;
  height: number;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function tickStepFor(total: number): number {
  if (total <= 20) return 5;
  if (total <= 60) return 10;
  if (total <= 120) return 15;
  return 30;
}

export default function Timeline({ dag }: { dag: RecipeDag }) {
  const engine = useExecute((s) => s.engine);
  useExecute((s) => s.tick); // re-render on clock ticks / replans
  const [wrapRef, wrapW] = useElementWidth<HTMLDivElement>();
  const playheadRef = useRef<SVGGElement>(null);

  const plan: ScheduleResult | null = engine?.plan ?? null;
  const total = Math.max(1, plan?.projectedDurationMin ?? 1);
  const pxPerMin = useMemo(
    () => Math.min(36, Math.max(7, (wrapW - LABEL_W - RIGHT_PAD) / total)),
    [wrapW, total]
  );

  // sub-row packing within each lane (handles e.g. two burners on the stove)
  const { lanes, placed, contentH } = useMemo(() => {
    const lanes: LaneLayout[] = [];
    const placed: Placed[] = [];
    if (!plan) return { lanes, placed, contentH: HEADER_H };
    const stepById = new Map(dag.steps.map((s) => [s.id, s]));
    let y = HEADER_H;
    for (const station of plan.lanes) {
      const blocks = dag.steps
        .filter((s) => s.station === station)
        .map((s) => plan.steps[s.id])
        .sort((a, b) => a.start - b.start);
      const rowEnds: number[] = [];
      const local: Placed[] = [];
      for (const b of blocks) {
        let row = rowEnds.findIndex((end) => end <= b.start + 1e-9);
        if (row === -1) {
          row = rowEnds.length;
          rowEnds.push(0);
        }
        rowEnds[row] = b.end;
        local.push({
          id: b.id,
          laneY: y,
          subRow: row,
          start: b.start,
          end: b.end,
          dur: Math.max(0, b.end - b.start),
          station: stepById.get(b.id)!.station,
        });
      }
      const subRows = Math.max(1, rowEnds.length);
      const height = subRows * ROW_H + LANE_PAD;
      lanes.push({ station, y, height });
      for (const p of local) placed.push(p);
      y += height;
    }
    return { lanes, placed, contentH: y };
  }, [plan, dag.steps]);

  // smooth playhead via rAF reading wall-clock from the engine (no re-render)
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const eng = useExecute.getState().engine;
      const g = playheadRef.current;
      if (eng && g) {
        const el = Math.min(total, E.elapsedMin(eng, Date.now()));
        const x = LABEL_W + el * pxPerMin;
        g.setAttribute("transform", `translate(${x},0)`);
        g.style.opacity = eng.status === "ready" ? "0" : "1";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pxPerMin, total]);

  if (!plan || !engine) return null;

  const width = LABEL_W + total * pxPerMin + RIGHT_PAD;
  const height = contentH + 6;
  const stepById = new Map(dag.steps.map((s) => [s.id, s]));
  const step = tickStepFor(total);
  const ticks: number[] = [];
  for (let t = 0; t <= total + 0.001; t += step) ticks.push(Math.round(t));

  return (
    <div className="timeline-wrap" ref={wrapRef}>
      <div className="timeline-legend">
        <span className="lg"><span className="sw" style={{ background: "var(--accent)" }} /> Hands-on</span>
        <span className="lg"><span className="sw" style={{ background: "var(--accent-2)" }} /> Monitor</span>
        <span className="lg"><span className="sw" style={{ background: "var(--accent-6)" }} /> Unattended</span>
        <span className="lg" style={{ marginLeft: "auto" }}>● on the critical path = the bottleneck chain</span>
      </div>
      <svg width={width} height={height} role="img" aria-label="Recipe timeline">
        {/* lane backgrounds + labels */}
        {lanes.map((lane, i) => (
          <g key={lane.station}>
            {i % 2 === 1 && (
              <rect x={0} y={lane.y} width={width} height={lane.height} fill="var(--bg-elev)" opacity={0.5} />
            )}
            <line x1={0} y1={lane.y} x2={width} y2={lane.y} stroke="var(--border)" strokeWidth={1} />
            <text className="tl-lane-label" x={6} y={lane.y + lane.height / 2 + 3}>
              {stationLabel(lane.station)}
            </text>
          </g>
        ))}

        {/* time grid + axis labels */}
        {ticks.map((t) => {
          const x = LABEL_W + t * pxPerMin;
          return (
            <g key={t}>
              <line x1={x} y1={HEADER_H} x2={x} y2={contentH} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text className="tl-axis-label" x={x + 3} y={14}>{t}′</text>
            </g>
          );
        })}

        {/* step blocks */}
        {placed.map((p) => {
          const st = stepById.get(p.id)!;
          const run = engine.steps[p.id];
          const x = LABEL_W + p.start * pxPerMin;
          const w = Math.max(3, p.dur * pxPerMin);
          const y = p.laneY + LANE_PAD / 2 + p.subRow * ROW_H + 2;
          const h = ROW_H - 5;
          const sched = plan.steps[p.id];
          const showLabel = w > 42;
          return (
            <g key={p.id}>
              <rect
                className={`tl-block ${run.status}`}
                x={x}
                y={y}
                width={w}
                height={h}
                rx={5}
                style={{
                  fill: `var(${ATTENTION_VAR[st.attention]})`,
                  stroke: sched.critical ? "var(--ink)" : "transparent",
                  strokeWidth: sched.critical ? 1.25 : 0,
                  strokeDasharray: st.durationConfidence === "estimated" ? "3 2" : undefined,
                }}
              >
                <title>{`${st.label} · ${st.attention} · ${Math.round(p.dur)} min`}</title>
              </rect>
              {showLabel && (
                <text className="tl-block-label" x={x + 7} y={y + h / 2 + 4}>
                  {st.label.length * 6.2 > w - 12 ? st.label.slice(0, Math.max(2, Math.floor((w - 12) / 6.2))) + "…" : st.label}
                </text>
              )}
            </g>
          );
        })}

        {/* playhead (moved imperatively via rAF) */}
        <g ref={playheadRef} className="tl-playhead-group" style={{ opacity: 0 }}>
          <line className="tl-playhead" x1={0} y1={HEADER_H - 6} x2={0} y2={contentH} />
          <polygon className="tl-playhead-cap" points="-5,-6 5,-6 0,4" transform={`translate(0,${HEADER_H - 6})`} />
        </g>
      </svg>
    </div>
  );
}
