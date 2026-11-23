import { useEffect, useState } from 'react';

/** Student-number picker shared by every CASE (one localStorage entry per device). */
export interface PickerState {
  from: number;
  to: number;
  skip: number[];      // numbers the teacher left out (absent, already answered…)
  noRepeat: boolean;   // drawn numbers leave the pool until the teacher clears them
  used: number[];      // numbers already drawn
}

export const PICKER_MIN = 1;
export const PICKER_MAX = 99;
const KEY = 'md-picker';
const DEFAULT: PickerState = { from: 1, to: 40, skip: [], noRepeat: true, used: [] };

const clamp = (n: number) => Math.min(PICKER_MAX, Math.max(PICKER_MIN, Math.round(n) || PICKER_MIN));

/** Repairs anything odd (old/edited storage, from > to) so the pool is always well defined. */
export function normalize(p: Partial<PickerState>): PickerState {
  let from = clamp(p.from ?? DEFAULT.from), to = clamp(p.to ?? DEFAULT.to);
  if (from > to) [from, to] = [to, from];
  const inRange = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.filter((x): x is number => Number.isInteger(x) && x >= from && x <= to))] : []);
  return { from, to, skip: inRange(p.skip), used: inRange(p.used), noRepeat: p.noRepeat ?? DEFAULT.noRepeat };
}

/** Numbers that can be drawn right now. */
export function pool(p: PickerState): number[] {
  const out: number[] = [];
  for (let n = p.from; n <= p.to; n++) if (!p.skip.includes(n) && !(p.noRepeat && p.used.includes(n))) out.push(n);
  return out;
}

/** Uniform pick from the pool (crypto RNG). Returns null when nothing is left. */
export function draw(p: PickerState, rnd = cryptoRandom): number | null {
  const xs = pool(p);
  return xs.length ? xs[Math.floor(rnd() * xs.length)] : null;
}

function cryptoRandom() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

function load(): PickerState {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return DEFAULT; }
}

/** Same state in every CASE: moving to the next case keeps range, skips and drawn numbers. */
export function usePicker() {
  const [p, setP] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-device convenience only */ } }, [p]);
  return [p, (patch: Partial<PickerState>) => setP((o) => normalize({ ...o, ...patch }))] as const;
}
