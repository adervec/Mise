// Hands-free voice control via the native Web Speech API (Chrome/Edge).
// Commands: play/start · pause/stop · done/next · skip · repeat.
import { useEffect, useRef, useState } from "react";
import { useExecute } from "./executeStore";

// ponytail: webkit-prefixed API, no polyfill — unsupported browsers just hide the button
const SR: (new () => SpeechRecognitionLike) | undefined =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const voiceSupported = !!SR;

export function speak(text: string): void {
  try {
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch {
    /* no synthesis — stay silent */
  }
}

function activeSteps() {
  const { engine } = useExecute.getState();
  if (!engine) return [];
  return engine.dag.steps.filter((s) => engine.steps[s.id].status === "active");
}

function handleCommand(text: string): void {
  const st = useExecute.getState();
  if (!st.engine) return;
  const first = activeSteps()[0];

  if (/\b(pause|stop|hold on)\b/.test(text)) {
    st.pause();
    speak("Paused.");
  } else if (/\b(play|start|resume|go|continue)\b/.test(text)) {
    st.play();
    speak("Cooking.");
  } else if (/\b(done|next|finished|complete)\b/.test(text)) {
    if (first) {
      st.complete(first.id);
      speak(`Done. ${first.label}.`);
    }
  } else if (/\bskip\b/.test(text)) {
    if (first) {
      st.skip(first.id);
      speak(`Skipped ${first.label}.`);
    }
  } else if (/\b(repeat|what now|what's now|current step)\b/.test(text)) {
    const act = activeSteps();
    speak(
      act.length
        ? act.map((s) => `${s.label}. ${s.detail ?? ""}`).join(" Also: ")
        : "Nothing active right now."
    );
  }
}

/** Mic toggle state + always-listening command loop while on. */
export function useVoice(): { on: boolean; toggle: () => void } {
  const [on, setOn] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!on || !SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const res = e.results[e.results.length - 1];
      if (res.isFinal) handleCommand(res[0].transcript.toLowerCase());
    };
    // Chrome ends recognition every ~minute; restart while still toggled on
    r.onend = () => {
      if (recRef.current === r) {
        try {
          r.start();
        } catch {
          /* already started */
        }
      }
    };
    recRef.current = r;
    try {
      r.start();
    } catch {
      /* mic denied — button stays on but silent */
    }
    return () => {
      recRef.current = null;
      r.onend = null;
      r.stop();
    };
  }, [on]);

  // Announce steps as they become active (skip at preview speeds — too chatty)
  const engine = useExecute((s) => s.engine);
  useExecute((s) => s.tick);
  const prevActive = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!engine) return;
    const now = new Set(
      engine.dag.steps.filter((s) => engine.steps[s.id].status === "active").map((s) => s.id)
    );
    if (on && engine.speed === 1 && !engine.simulate) {
      for (const s of engine.dag.steps) {
        if (now.has(s.id) && !prevActive.current.has(s.id)) speak(s.label);
      }
    }
    prevActive.current = now;
  });

  return { on, toggle: () => setOn((v) => !v) };
}
