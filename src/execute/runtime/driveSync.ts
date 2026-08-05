// Google Drive sync for the cook log. Mirrors Tachyread's
// app/src/features/sync/syncProviders.js: same OAuth client id, same origin
// gate, same Google Identity Services token flow, same private appDataFolder.
//
// Because the client id is shared, Drive hands this app the SAME appDataFolder
// as Tachyread — our file just sits beside tachyread-*.json in that hidden
// folder. Distinct filenames keep them apart, but revoking access in the Google
// account page revokes it for both apps at once.
//
// The Drive bytes never touch a server of ours; it's the browser talking to the
// user's own Drive. The access token lives in memory only, never on disk.

// Lives beside cookLog.ts and imports only it, so — like cookLog — the eager
// app bundle can use it without dragging in the lazy execute engine.
import { readCookLog, writeCookLog, mergeCookLog, type CookLogEntry } from "./cookLog";

const FILE_NAME = "mise-cook-log.json";

// Public OAuth client id — an identifier, not a secret. Shared with Tachyread
// and GymTracker. Google only honours it from the JavaScript origins registered
// on the project, and the gate below refuses it app-side anywhere else, so a
// fork deployed elsewhere must supply its own.
export const BUILTIN_DRIVE_CLIENT_ID =
  "547617739897-br6dj2facmsc34qnkjb5u4dbfhju39pu.apps.googleusercontent.com";
const OAUTH_ORIGINS = ["https://adervec.github.io"];

export function driveOriginAllowed(): boolean {
  try {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true; // dev, any port
    return OAUTH_ORIGINS.indexOf(location.origin) !== -1;
  } catch {
    return false;
  }
}

// Identical scope string to Tachyread's on purpose: the same client id with the
// same scopes reuses the grant the user already gave, so connecting here is
// usually silent instead of a fresh consent screen.
const DRIVE_SCOPE =
  "openid email profile https://www.googleapis.com/auth/drive.appdata";

const ENABLED_KEY = "mise.driveSync.enabled";
const LAST_KEY = "mise.driveSync.lastAt";

/** Has the user ever connected? Boot only talks to Google if so. */
export function syncEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}
function setEnabled(on: boolean) {
  try {
    on ? localStorage.setItem(ENABLED_KEY, "1") : localStorage.removeItem(ENABLED_KEY);
  } catch {
    /* ignore */
  }
}
export function lastSyncedAt(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
}
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(cfg: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
            error_callback?: (e: { message?: string; type?: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let gisLoaded: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

let token: { value: string; exp: number } | null = null;
let profile: { name: string; email: string } | null = null;
function tokenValid() {
  return !!token && token.exp > Date.now() + 60_000;
}
export function driveProfile() {
  return profile;
}
export function isConnected() {
  return tokenValid();
}

function requestToken(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: BUILTIN_DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r?.access_token) {
          token = { value: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 };
          resolve(r.access_token);
        } else reject(new Error(r?.error || "Sign-in failed."));
      },
      // Without this the promise hangs when the popup is dismissed or blocked.
      error_callback: (e) => reject(new Error(e?.message || e?.type || "Sign-in was dismissed.")),
    });
    client.requestAccessToken({ prompt });
  });
}

async function fetchProfile(t: string) {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (r.ok) {
      const j = await r.json();
      profile = { name: j.name || j.email || "Google account", email: j.email || "" };
    }
  } catch {
    /* cosmetic only */
  }
}

/** `silent` (boot / post-cook) reuses an existing grant and never opens a popup. */
async function connect({ silent = false } = {}): Promise<string> {
  if (!driveOriginAllowed()) throw new Error("Drive sync isn't enabled on this deployment.");
  if (tokenValid()) return token!.value;
  await loadGis();
  let t: string;
  try {
    t = await requestToken(""); // silent when a prior grant + Google session exist
  } catch (e) {
    if (silent) throw e; // never pop a sign-in the user didn't ask for
    t = await requestToken("consent");
  }
  await fetchProfile(t);
  return t;
}

async function findFileId(t: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  if (!r.ok) throw new Error(`Drive list failed (${r.status}).`);
  const j = await r.json();
  return j.files?.[0]?.id || null;
}

async function download(t: string): Promise<CookLogEntry[] | null> {
  const id = await findFileId(t);
  if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) return null;
  const text = await r.text();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("The cook log in Drive is corrupt — sync from a device that has your history.");
  }
}

async function upload(t: string, log: CookLogEntry[]): Promise<void> {
  const existing = await findFileId(t);
  const meta = existing ? {} : { name: FILE_NAME, parents: ["appDataFolder"] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(log)], { type: "application/json" }));
  // ponytail: multipart only — 300 capped entries is well under Drive's 5 MB
  // multipart limit. Add the resumable path if the log ever carries photos.
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const r = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${t}` },
    body: form,
  });
  if (!r.ok) throw new Error(`Drive upload failed (${r.status}).`);
}

export interface SyncResult {
  at: number;
  total: number;
  pulled: number; // entries this device did not have
}

/**
 * Read-merge-write, like Tachyread's syncWithProvider: pull remote, union it
 * into the local log, push the result. Two devices converge instead of one
 * clobbering the other.
 */
export async function syncCookLog({ silent = false } = {}): Promise<SyncResult> {
  const t = await connect({ silent });
  const local = readCookLog();
  const remote = (await download(t)) || [];
  const merged = mergeCookLog(local, remote);
  writeCookLog(merged);
  await upload(t, merged);
  setEnabled(true);
  const at = Date.now();
  try {
    localStorage.setItem(LAST_KEY, String(at));
  } catch {
    /* ignore */
  }
  return { at, total: merged.length, pulled: merged.length - local.length };
}

export function disconnectDrive(): void {
  token = null;
  profile = null;
  setEnabled(false);
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget silent sync (app boot, after a cook). Never prompts, never throws. */
export function autoSyncCookLog(): void {
  if (!syncEnabled() || !driveOriginAllowed()) return;
  void syncCookLog({ silent: true }).catch(() => {
    /* offline or grant expired — the Settings button still works */
  });
}
