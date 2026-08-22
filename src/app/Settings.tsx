import { useEffect, useRef, useState } from "react";
import { useTheme, THEMES } from "./theme";
import { useOrientation, ORIENTATIONS } from "./orientation";
import { useFilters } from "./filters";
import { useUi } from "./ui";
import { DIETS } from "@/data/catalog";
import { exportCookLog, readCookLog } from "@/execute/runtime/cookLog";

// Folder cowork through the maker's shared panel (https://adervec.github.io/cowork.js, fs mode):
// the cook log goes to coach/request.json in a folder you pick; an agent (CoworkSyncHub,
// Claude Desktop, a person) answers in coach/reply.json and the reply shows here.
type CoworkGlobal = { mount: (host: HTMLElement, cfg: unknown) => unknown };
function loadCowork(): Promise<CoworkGlobal | null> {
  const w = window as unknown as { cowork?: CoworkGlobal };
  if (w.cowork) return Promise.resolve(w.cowork);
  return new Promise((res) => {
    const s = document.createElement("script");
    s.src = "https://adervec.github.io/cowork.js";
    s.async = true;
    s.onload = () => res(w.cowork ?? null);
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
}
function djb2(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
const COWORK_INSTRUCTIONS = `# Mise — coach channel

Read \`coach/request.json\`: \`payload.cookLog\` is the cook history (recipe, when, minutes,
steps done / skipped; preview runs already excluded). Write \`coach/reply.json\`:

\`\`\`json
{ "requestHash": "<copy the request's requestHash verbatim>",
  "reply": "<a short, warm progress report in markdown: what they cook most, what's getting faster, what they skip, two or three suggestions of what to cook next and why.>" }
\`\`\`
`;
const COACH_REPLY_KEY = "mise-coach-reply";
import {
  syncCookLog,
  disconnectDrive,
  driveOriginAllowed,
  driveProfile,
  syncEnabled,
  lastSyncedAt,
} from "@/execute/runtime/driveSync";

function agoLabel(at: number | null): string {
  if (!at) return "never";
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export default function Settings() {
  const open = useUi((s) => s.settingsOpen);
  const close = useUi((s) => s.closeSettings);
  const coworkHost = useRef<HTMLDivElement>(null);
  const [coachReply, setCoachReply] = useState(() => {
    try { return localStorage.getItem(COACH_REPLY_KEY) || ""; } catch { return ""; }
  });
  useEffect(() => {
    const host = coworkHost.current;
    if (!host) return;
    loadCowork().then((cw) => {
      if (!cw || !host.isConnected || host.childElementCount) return;
      cw.mount(host, {
        app: "mise",
        manifest: { protocol: "cowork-manifest", protocolVersion: 1, app: "mise",
          channels: [{ name: "coach", request: ["coach/request.json"], instructions: "coach/INSTRUCTIONS.md", replyPath: "coach/reply.json" }] },
        files: () => {
          const payload = { cookLog: readCookLog().filter((e) => !e.simulate).slice(-200) };
          return {
            "coach/request.json": { protocol: "mise-coach", protocolVersion: 1, kind: "coach-request",
              generatedAt: new Date().toISOString(), requestHash: djb2(JSON.stringify(payload)), payload },
            "coach/INSTRUCTIONS.md": COWORK_INSTRUCTIONS,
          };
        },
        apply: (_ch: string, reply: unknown) => {
          const r = reply as { reply?: string; payload?: { reply?: string } } | string;
          const text = typeof r === "string" ? r : r?.reply ?? r?.payload?.reply ?? JSON.stringify(reply, null, 2);
          try { localStorage.setItem(COACH_REPLY_KEY, text); } catch { /* quota */ }
          setCoachReply(text);
        },
      });
    });
    return () => { host.replaceChildren(); };
  }, [open]);  // the panel host only exists while the drawer is open
  const { theme, setTheme } = useTheme();
  const { orientation, lockFailed, setOrientation } = useOrientation();
  const diet = useFilters((s) => s.diet);
  const toggleDiet = useFilters((s) => s.toggleDiet);
  const clearDiet = useFilters((s) => s.clearDiet);
  const [sync, setSync] = useState<{ busy: boolean; msg: string; err: boolean }>({
    busy: false,
    msg: "",
    err: false,
  });

  async function runSync() {
    setSync({ busy: true, msg: "Syncing…", err: false });
    try {
      const r = await syncCookLog();
      const who = driveProfile()?.email;
      setSync({
        busy: false,
        err: false,
        msg:
          `${r.total} cooks in Drive` +
          (r.pulled > 0 ? `, ${r.pulled} pulled from another device` : "") +
          (who ? ` · ${who}` : ""),
      });
    } catch (e) {
      setSync({ busy: false, err: true, msg: (e as Error).message || "Sync failed." });
    }
  }

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
            <div ref={coworkHost} style={{ marginTop: 10 }} />
            {coachReply && (
              <pre className="hint" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{coachReply}</pre>
            )}
          </section>

          <section className="settings-section">
            <h3>Google Drive sync</h3>
            <p className="hint">
              {driveOriginAllowed()
                ? "Keep your cook log in step across phone and desktop. It goes to a private app folder in your own Drive — nothing passes through a server, and the two logs merge rather than overwrite."
                : "Drive sync only runs on the published site (adervec.github.io) or a local dev server."}
            </p>
            {driveOriginAllowed() && (
              <>
                <div className="settings-actions">
                  <button className="text-btn" onClick={runSync} disabled={sync.busy}>
                    {sync.busy ? "Syncing…" : syncEnabled() ? "Sync now" : "Connect Google Drive"}
                  </button>
                  {syncEnabled() && !sync.busy && (
                    <button
                      className="text-btn"
                      onClick={() => {
                        disconnectDrive();
                        setSync({ busy: false, msg: "Disconnected on this device.", err: false });
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  {sync.msg ? (
                    <span style={{ color: sync.err ? "var(--accent-4)" : "var(--accent-2)" }}>
                      {sync.msg}
                    </span>
                  ) : syncEnabled() ? (
                    `${
                      lastSyncedAt() ? `Last synced ${agoLabel(lastSyncedAt())}` : "Not synced yet"
                    }. Syncs on its own when you open the app and after each cook.`
                  ) : (
                    "Signs in with the same Google account you use for Tachyread."
                  )}
                </p>
              </>
            )}
          </section>

          <section className="settings-section">
            <h3>About</h3>
            <p className="hint">
              More apps by this maker —{" "}
              <a
                href="https://adervec.github.io"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "underline" }}
              >
                adervec.github.io
              </a>
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}
