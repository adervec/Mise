import { useTheme, THEMES } from "./theme";
import { useOrientation, ORIENTATIONS } from "./orientation";
import { useFilters } from "./filters";
import { useUi } from "./ui";
import { DIETS } from "@/data/catalog";
import { exportCookLog, readCookLog } from "@/execute/runtime/cookLog";

export default function Settings() {
  const open = useUi((s) => s.settingsOpen);
  const close = useUi((s) => s.closeSettings);
  const { theme, setTheme } = useTheme();
  const { orientation, lockFailed, setOrientation } = useOrientation();
  const diet = useFilters((s) => s.diet);
  const toggleDiet = useFilters((s) => s.toggleDiet);
  const clearDiet = useFilters((s) => s.clearDiet);

  if (!open) return null;
  const activeCount = DIETS.filter((d) => diet[d.key]).length;

  return (
    <>
      <div className="settings-backdrop" onClick={close} />
      <aside className="settings-panel" role="dialog" aria-label="Settings">
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="text-btn" onClick={close} aria-label="Close settings">
            Close
          </button>
        </div>
        <div className="settings-body">
          <section className="settings-section">
            <h3>Theme</h3>
            <p className="hint">Pick the look that suits your kitchen light.</p>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={"theme-opt" + (theme === t.id ? " active" : "")}
                  onClick={() => setTheme(t.id)}
                >
                  <div className="swatch">
                    {t.swatch.map((c, i) => (
                      <span key={i} style={{ background: c }} />
                    ))}
                  </div>
                  <div className="tname">{t.name}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>Screen orientation</h3>
            <p className="hint">
              Lock the screen while you cook — no flipping when the phone tilts.
            </p>
            <div className="theme-grid">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.id}
                  className={"theme-opt" + (orientation === o.id ? " active" : "")}
                  onClick={() => setOrientation(o.id)}
                >
                  <div className="tname">{o.name}</div>
                </button>
              ))}
            </div>
            {lockFailed && (
              <p className="hint" style={{ marginTop: 10 }}>
                Couldn't lock in this browser — orientation lock needs the
                installed app (Add to Home Screen / Install Mise).
              </p>
            )}
          </section>

          <section className="settings-section">
            <h3>
              Dietary filters
              {activeCount > 0 && <span className="diet-summary">{activeCount} on</span>}
            </h3>
            <p className="hint">
              Show only recipes that match. Reference and technique cards always stay.
            </p>
            <div className="diet-toggles">
              {DIETS.map((d) => {
                const on = !!diet[d.key];
                return (
                  <div
                    key={d.key}
                    className={"diet-toggle" + (on ? " on" : "")}
                    onClick={() => toggleDiet(d.key)}
                    role="switch"
                    aria-checked={on}
                  >
                    <span className="dt-label">
                      {d.label}
                      <small>{d.note}</small>
                    </span>
                    <span className="switch" />
                  </div>
                );
              })}
            </div>
            {activeCount > 0 && (
              <div className="settings-actions">
                <button className="text-btn" onClick={clearDiet}>
                  Clear all
                </button>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h3>Cook log</h3>
            <p className="hint">
              {readCookLog().length} cooks logged. Export the log and save
              <code> mise-cook-log.json</code> into the project folder — Claude
              reads it to report on your cooking progress.
            </p>
            <div className="settings-actions">
              <button className="text-btn" onClick={exportCookLog}>
                Export cook log
              </button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
