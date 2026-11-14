import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { itemById, CAT_LABELS, DIETS, authoredDags } from "@/data/catalog";
import type { Checklist } from "@/data/types";
import { stationLabel, ATTENTION_LABEL, ATTENTION_VAR } from "@/execute/model/stations";
import type { RecipeDag, Step } from "@/execute/model/types";
import { t } from "@/i18n";

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = id ? itemById.get(id) : undefined;
  const [view, setView] = useState<"notes" | "checklist" | "grid">("notes");

  if (!item) {
    return (
      <div className="wrap">
        <div className="empty">{t("Not found.")}</div>
        <Link className="text-btn" to="/">
          {t("Back to browse")}
        </Link>
      </div>
    );
  }

  const isRecipe = item.cat === "recipe";
  const dietBadges = item.diet ? DIETS.filter((d) => item.diet![d.key]) : [];
  const dag = isRecipe ? authoredDags[item.id] : undefined;
  const hasGrid = !!dag || !!item.checklist;

  return (
    <div className="wrap">
      <div style={{ padding: "24px 0 0" }}>
        <Link className="text-btn" to="/">
          ← {t("Browse")}
        </Link>
      </div>

      <div className="detail-head">
        <div className="detail-cat">{t(CAT_LABELS[item.cat])}</div>
        <h2>{item.title}</h2>
        <p className="lede" style={{ marginTop: 6 }}>
          {item.summary}
        </p>
        <div className="detail-meta">
          {item.timeLabel && (
            <span>
              <b>{t("Time")}</b>
              {item.timeLabel}
            </span>
          )}
          {item.nutrition?.cal != null && (
            <span>
              <b>{t("Calories")}</b>
              {t("{n} cal", { n: item.nutrition.cal })}
            </span>
          )}
          {item.tags.length > 0 && (
            <span>
              <b>{t("Tags")}</b>
              {item.tags.join(", ")}
            </span>
          )}
        </div>

        {isRecipe && (
          <div style={{ marginTop: 22 }}>
            <button className="btn-primary" onClick={() => navigate(`/i/${item.id}/cook`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {t("Execute this recipe")}
            </button>
          </div>
        )}
      </div>

      {dietBadges.length > 0 && (
        <div className="card-diet" style={{ marginTop: 18 }}>
          {dietBadges.map((d) => (
            <span className="diet-badge" key={d.key}>
              {t(d.badge)}
            </span>
          ))}
        </div>
      )}

      {item.nutrition && (
        <div className="nutrition">
          <div className="nut-cell">
            <div className="nut-val cal">{item.nutrition.cal}</div>
            <div className="nut-label">{t("Calories")}</div>
          </div>
          <div className="nut-cell">
            <div className="nut-val">{item.nutrition.protein}</div>
            <div className="nut-label">{t("Protein")}</div>
          </div>
          <div className="nut-cell">
            <div className="nut-val">{item.nutrition.carbs}</div>
            <div className="nut-label">{t("Carbs")}</div>
          </div>
          <div className="nut-cell">
            <div className="nut-val">{item.nutrition.fat}</div>
            <div className="nut-label">{t("Fat")}</div>
          </div>
          <div className="nut-serv">{item.nutrition.serving}</div>
        </div>
      )}

      {(item.checklist || hasGrid) && (
        <div className="view-toggle">
          <button
            className={view === "notes" ? "active" : ""}
            onClick={() => setView("notes")}
          >
            {t("Notes")}
          </button>
          {item.checklist && (
            <button
              className={view === "checklist" ? "active" : ""}
              onClick={() => setView("checklist")}
            >
              {t("Checklist")}
            </button>
          )}
          {hasGrid && (
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              {t("Grid")}
            </button>
          )}
        </div>
      )}

      {view === "checklist" && item.checklist ? (
        <ChecklistView checklist={item.checklist} />
      ) : view === "grid" && hasGrid ? (
        <StepGridView dag={dag} checklist={item.checklist} />
      ) : (
        <div className="recipe-body" dangerouslySetInnerHTML={{ __html: item.body }} />
      )}

      <footer>
        <div className="ornament">Mise</div>
      </footer>
    </div>
  );
}

interface GridCard {
  key: string;
  label: string;
  detail?: string;
  attention?: Step["attention"];
  station?: Step["station"];
  durationText?: string;
  eyebrow?: string; // fallback cards: checklist module title
}

// i18n-keys: Prep | Cook | Cleanup
const GRID_SECTIONS = [
  { phase: "prep", cls: "prep", title: "Prep" },
  { phase: "cook", cls: "steps", title: "Cook" },
  { phase: "cleanup", cls: "cleanup", title: "Cleanup" },
] as const;

// Read-only glanceable grid of step cards, from the authored DAG when there is
// one, else plain cards from the checklist.
function StepGridView({ dag, checklist }: { dag?: RecipeDag; checklist?: Checklist }) {
  const byPhase: Record<Step["phase"], GridCard[]> = { prep: [], cook: [], cleanup: [] };

  if (dag) {
    for (const s of dag.steps) {
      byPhase[s.phase].push({
        key: s.id,
        label: s.label,
        detail: s.detail,
        attention: s.attention,
        station: s.station,
        durationText:
          s.durationConfidence === "instant"
            ? undefined
            : (s.durationConfidence === "estimated" ? "~" : "") + t("{n} min", { n: s.durationMin }),
      });
    }
  } else if (checklist) {
    checklist.prep?.forEach((line, i) => byPhase.prep.push({ key: `p${i}`, label: line }));
    checklist.modules?.forEach((mod, mi) =>
      mod.steps.forEach((line, i) =>
        byPhase.cook.push({ key: `m${mi}-${i}`, label: line, eyebrow: mod.title })
      )
    );
    checklist.cleanup?.forEach((line, i) => byPhase.cleanup.push({ key: `c${i}`, label: line }));
  }

  return (
    <div className="step-grid-body">
      {GRID_SECTIONS.map(
        ({ phase, cls, title }) =>
          byPhase[phase].length > 0 && (
            <section className={`check-section ${cls}`} key={phase}>
              <h4>
                <span className="ph">{t(title)}</span>
              </h4>
              <div className="step-grid">
                {byPhase[phase].map((c) => (
                  <article
                    className="step-card"
                    key={c.key}
                    style={
                      c.attention
                        ? { borderInlineStartColor: `var(${ATTENTION_VAR[c.attention]})` }
                        : undefined
                    }
                  >
                    <div className="step-card-meta">
                      {c.attention && <span>{t(ATTENTION_LABEL[c.attention])}</span>}
                      {c.durationText && <span className="step-dur">{c.durationText}</span>}
                      {c.station && <span className="station-pill">{t(stationLabel(c.station))}</span>}
                      {c.eyebrow && <span>{c.eyebrow}</span>}
                    </div>
                    <h5>{c.label}</h5>
                    {c.detail && <p>{c.detail}</p>}
                  </article>
                ))}
              </div>
            </section>
          )
      )}
    </div>
  );
}

function ChecklistView({ checklist }: { checklist: Checklist }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const renderItems = (prefix: string, lines: string[], numbered: boolean) =>
    lines.map((line, i) => {
      const key = `${prefix}-${i}`;
      const isDone = done.has(key);
      return (
        <div
          key={key}
          className={"check-item" + (isDone ? " done" : "")}
          onClick={() => toggle(key)}
          style={{
            cursor: "pointer",
            textDecoration: isDone ? "line-through" : undefined,
            opacity: isDone ? 0.55 : 1,
          }}
        >
          {numbered && <span className="num">{i + 1}</span>}
          {!numbered && <span className="num">{isDone ? "✓" : "·"}</span>}
          <span className="ctext">{line}</span>
        </div>
      );
    });

  return (
    <div className="recipe-body">
      {checklist.prep?.length > 0 && (
        <section className="check-section prep">
          <h4>
            <span className="ph">{t("Prep")}</span> {t("Mise en place")}
          </h4>
          {renderItems("prep", checklist.prep, false)}
        </section>
      )}
      {checklist.modules?.map((mod, mi) => (
        <section className="check-section steps" key={mi}>
          <h4>
            <span className="ph">{t("Steps")}</span> {mod.title}
          </h4>
          {renderItems(`mod${mi}`, mod.steps, true)}
        </section>
      ))}
      {checklist.cleanup?.length > 0 && (
        <section className="check-section cleanup">
          <h4>
            <span className="ph">{t("Cleanup")}</span> {t("After the cook")}
          </h4>
          {renderItems("cleanup", checklist.cleanup, false)}
        </section>
      )}
    </div>
  );
}
