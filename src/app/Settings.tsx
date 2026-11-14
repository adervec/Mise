import { createElement, useEffect, useRef, useState } from "react";
import { useTheme, THEMES } from "./theme";
import { useOrientation, ORIENTATIONS } from "./orientation";
import { useFilters } from "./filters";
import { useUi } from "./ui";
import { DIETS } from "@/data/catalog";
import { t, fmt } from "@/i18n";
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

function agoLabel(at: number): string {
  return fmt()?.relative(at) ?? new Date(at).toLocaleString();
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
        // cowork v2 (house standard): review the reply before it replaces the current one; undo from the history
        channels: {
          coach: {
            label: t("Cooking coach"),
            preview: (reply: unknown) => {
              const r = reply as { reply?: string; payload?: { reply?: string } } | string;
              const text = typeof r === "string" ? r : r?.reply ?? r?.payload?.reply ?? "";
              return [{ id: "reply", label: t("Show this advice in Mise (replaces the current one)"), detail: text.slice(0, 400) }];
            },
            apply: (reply: unknown) => {
              let prev = ""; try { prev = localStorage.getItem(COACH_REPLY_KEY) || ""; } catch { /* private mode */ }
              const r = reply as { reply?: string; payload?: { reply?: string } } | string;
              const text = typeof r === "string" ? r : r?.reply ?? r?.payload?.reply ?? JSON.stringify(reply, null, 2);
              try { localStorage.setItem(COACH_REPLY_KEY, text); } catch { /* quota */ }
              setCoachReply(text);
              return { summary: t("new advice shown"), undo: { prev } };
            },
            undo: (d: { prev?: string }) => { try { localStorage.setItem(COACH_REPLY_KEY, d.prev || ""); } catch { /* quota */ } setCoachReply(d.prev || ""); },
          },
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
    setSync({ busy: true, msg: t("Syncing…"), err: false });
    try {
      const r = await syncCookLog();
      const who = driveProfile()?.email;
      setSync({
        busy: false,
        err: false,
        msg:
          (r.pulled > 0
            ? t.n("{n} cook in Drive, {pulled} pulled from another device", "{n} cooks in Drive, {pulled} pulled from another device", r.total, { pulled: r.pulled })
            : t.n("{n} cook in Drive", "{n} cooks in Drive", r.total)) +
          (who ? ` · ${who}` : ""),
      });
    } catch (e) {
      setSync({ busy: false, err: true, msg: (e as Error).message || t("Sync failed.") });
    }
  }

  if (!open) return null;
  const activeCount = DIETS.filter((d) => diet[d.key]).length;

  return (
    <>
      <div className="settings-backdrop" onClick={close} />
      <aside className="settings-panel" role="dialog" aria-label={t("Settings")}>
        <div className="settings-head">
          <h2>{t("Settings")}</h2>
          <button className="text-btn" onClick={close} aria-label={t("Close settings")}>
            {t("Close")}
          </button>
        </div>
        <div className="settings-body">
          <section className="settings-section">
            <h3>{t("Theme")}</h3>
            <p className="hint">{t("Pick the look that suits your kitchen light.")}</p>
            <div className="theme-grid">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  className={"theme-opt" + (theme === th.id ? " active" : "")}
                  onClick={() => setTheme(th.id)}
                >
                  <div className="swatch">
                    {th.swatch.map((c, i) => (
                      <span key={i} style={{ background: c }} />
                    ))}
                  </div>
                  <div className="tname">{t(th.name)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>{t("Font")}</h3>
            {/* shared picker from https://adervec.github.io/font.js; the choice applies to every app by this maker */}
            {createElement("app-font-picker")}
          </section>

          <section className="settings-section">
            <h3>{t("Screen orientation")}</h3>
            <p className="hint">
              {t("Lock the screen while you cook — no flipping when the phone tilts.")}
            </p>
            <div className="theme-grid">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.id}
                  className={"theme-opt" + (orientation === o.id ? " active" : "")}
                  onClick={() => setOrientation(o.id)}
                >
                  <div className="tname">{t(o.name)}</div>
                </button>
              ))}
            </div>
            {lockFailed && (
              <p className="hint" style={{ marginTop: 10 }}>
                {t("Couldn't lock in this browser — orientation lock needs the installed app (Add to Home Screen / Install Mise).")}
              </p>
            )}
          </section>

          <section className="settings-section">
            <h3>
              {t("Dietary filters")}
              {activeCount > 0 && <span className="diet-summary">{t("{n} on", { n: activeCount })}</span>}
            </h3>
            <p className="hint">
              {t("Show only recipes that match. Reference and technique cards always stay.")}
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
                      {t(d.label)}
                      <small>{t(d.note)}</small>
                    </span>
                    <span className="switch" />
                  </div>
                );
              })}
            </div>
            {activeCount > 0 && (
              <div className="settings-actions">
                <button className="text-btn" onClick={clearDiet}>
                  {t("Clear all")}
                </button>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h3>{t("Cook log")}</h3>
            <p className="hint">
              {t.n("{n} cook logged.", "{n} cooks logged.", readCookLog().length)}{" "}
              {t("Export the log and save {file} into the project folder — Claude reads it to report on your cooking progress.", { file: "mise-cook-log.json" })}
            </p>
            <div className="settings-actions">
              <button className="text-btn" onClick={exportCookLog}>
                {t("Export cook log")}
              </button>
              {/* Only this app's own keys: every app by this maker shares one origin, so never localStorage.clear(). */}
              <button
                className="text-btn"
                onClick={() => {
                  if (!confirm(t("Erase the cook log and every setting stored on this device?") + "\n\n" + t("A copy in Google Drive is not touched. Export the cook log first if you are not sure."))) return;
                  Object.keys(localStorage).filter((k) => k.startsWith("mise.") || k.startsWith("mise-")).forEach((k) => localStorage.removeItem(k));
                  location.reload();
                }}
              >
                {t("Erase everything")}
              </button>
            </div>
            <div ref={coworkHost} style={{ marginTop: 10 }} />
            {coachReply && (
              <pre className="hint" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{coachReply}</pre>
            )}
          </section>

          <section className="settings-section">
            <h3>{t("Google Drive sync")}</h3>
            <p className="hint">
              {driveOriginAllowed()
                ? t("Keep your cook log in step across phone and desktop. It goes to a private app folder in your own Drive — nothing passes through a server, and the two logs merge rather than overwrite.")
                : t("Drive sync only runs on the published site (adervec.github.io) or a local dev server.")}
            </p>
            {driveOriginAllowed() && (
              <>
                <div className="settings-actions">
                  <button className="text-btn" onClick={runSync} disabled={sync.busy}>
                    {sync.busy ? t("Syncing…") : syncEnabled() ? t("Sync now") : t("Connect Google Drive")}
                  </button>
                  {syncEnabled() && !sync.busy && (
                    <button
                      className="text-btn"
                      onClick={() => {
                        disconnectDrive();
                        setSync({ busy: false, msg: t("Disconnected on this device."), err: false });
                      }}
                    >
                      {t("Disconnect")}
                    </button>
                  )}
                </div>
                <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  {/* the Google account picture shows whose Drive this is */}
                  {syncEnabled() && driveProfile()?.picture ? (
                    <img
                      src={driveProfile()!.picture}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: 22, height: 22, borderRadius: "50%", verticalAlign: "middle", marginInlineEnd: 6 }}
                    />
                  ) : null}
                  {sync.msg ? (
                    <span style={{ color: sync.err ? "var(--accent-4)" : "var(--accent-2)" }}>
                      {sync.msg}
                    </span>
                  ) : syncEnabled() ? (
                    (lastSyncedAt() ? t("Last synced {when}.", { when: agoLabel(lastSyncedAt()!) }) : t("Not synced yet.")) +
                    " " + t("Syncs on its own when you open the app and after each cook.")
                  ) : (
                    t("Signs in with the same Google account you use for Tachyread.")
                  )}
                </p>
              </>
            )}
          </section>

          <section className="settings-section">
            <h3>{t("About")}</h3>
            <p className="hint">
              {t("More apps by this maker —")}{" "}
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
