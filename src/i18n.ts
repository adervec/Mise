// The house translator (font.js: window.t). English is the key; untranslated text stays English.
// Zero dependencies, so src/app and src/execute may both import it.
type P = Record<string, string | number>;
type T = ((key: string, p?: P) => string) & { n: (one: string, other: string, n: number, p?: P) => string };
const g = globalThis as unknown as { t?: T; appFont?: { fmt: Fmt; ready?: Promise<unknown> } };
const interp = (s: string, p?: P) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s);

export const t: T = Object.assign((key: string, p?: P) => (g.t ? g.t(key, p) : interp(key, p)), {
  n: (one: string, other: string, n: number, p?: P) => (g.t ? g.t.n(one, other, n, p) : interp(n === 1 ? one : other, { n, ...p })),
});

type Fmt = { relative: (d: number) => string; number: (n: number) => string };
export const fmt = (): Fmt | undefined => g.appFont?.fmt;
/** resolves once the chosen language's dictionary is loaded (or at once without font.js) */
export const i18nReady = (): Promise<unknown> => g.appFont?.ready ?? Promise.resolve();
