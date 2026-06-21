// Offline-friendly alarms: synthesized Web Audio beeps + optional notifications.
// No audio assets; everything is generated.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Call from a user gesture (the first Play) to unlock audio on iOS/Safari. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

function tone(freq: number, startAt: number, durSec: number, gain = 0.18): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(c.destination);
  // soft attack/release to avoid clicks
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(gain, startAt + 0.01);
  g.gain.setValueAtTime(gain, startAt + durSec - 0.04);
  g.gain.linearRampToValueAtTime(0, startAt + durSec);
  osc.start(startAt);
  osc.stop(startAt + durSec);
}

/** A pleasant three-note chime — fires when a timer completes. */
export function beepDone(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const t = c.currentTime;
  tone(880, t, 0.16);
  tone(1175, t + 0.18, 0.16);
  tone(1568, t + 0.36, 0.22);
}

/** A soft single blip — fires when a new step becomes active. */
export function beepStep(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  tone(660, c.currentTime, 0.1, 0.12);
}

export function requestNotificationPermission(): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") void Notification.requestPermission();
}

export function notify(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, silent: false });
  } catch {
    /* notifications can throw in some embedded contexts; ignore */
  }
}
