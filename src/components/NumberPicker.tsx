import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { draw, pool, PICKER_MAX, PICKER_MIN, usePicker } from '../lib/picker';
import { useSettings } from '../lib/settings';
import { sfx } from '../lib/sound';
import { Art } from './art';
import type { Safe } from './safe3d';

/** Bottom-left "สุ่มเลขที่" button on every CASE screen; opens the 3D safe picker. One shared state for all cases. */
export function NumberPicker({ raised = false }: { raised?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`fixed left-2 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-gold pl-1.5 pr-4 font-bold text-navy shadow-[0_4px_0_#b5740a] ring-2 ring-navy transition hover:brightness-105 active:translate-y-[2px] ${raised ? 'bottom-1' : 'bottom-3'}`}>
        <Art file="ui-tool-dice.webp" className="h-9 w-9 object-contain" fallback={<span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-gold">#</span>} />
        สุ่มเลขที่
      </button>
      <AnimatePresence>{open && <PickerDialog onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function PickerDialog({ onClose }: { onClose: () => void }) {
  const { s, motionOn } = useSettings();
  const [p, set] = usePicker();
  const canvas = useRef<HTMLCanvasElement>(null);
  const safe = useRef<Safe | null>(null);
  const [ready, setReady] = useState<'loading' | 'ok' | 'no3d'>('loading');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const left = pool(p);

  useEffect(() => {
    let alive = true;
    import('./safe3d')
      .then((m) => m.createSafe(canvas.current!, motionOn ? s.speed : 8))
      .then((sf) => { if (alive) { safe.current = sf; setReady('ok'); } else sf.dispose(); })
      .catch(() => alive && setReady('no3d')); // no WebGL: still draws, without the 3D safe
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => { alive = false; removeEventListener('keydown', esc); safe.current?.dispose(); safe.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function spin() {
    const n = draw(p);
    if (n === null) { setMsg('ไม่เหลือเลขที่ให้สุ่มแล้ว กด “ล้างเลขที่ออกแล้ว” หรือปรับช่วงเลขที่'); return; }
    setMsg(''); setResult(null); setBusy(true);
    try { await safe.current?.spin(n, left, () => sfx('click', s.muted)); }
    finally {
      sfx('stamp', s.muted);
      set({ used: [...p.used, n] });
      setResult(n); setBusy(false);
    }
  }
  function again() { setResult(null); safe.current?.reset(); }
  const toggle = (n: number) => set({ skip: p.skip.includes(n) ? p.skip.filter((x) => x !== n) : [...p.skip, n] });
  const nums = Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i);

  return (
    <motion.div role="dialog" aria-modal="true" aria-label="สุ่มเลขที่" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-navy text-cream lg:flex-row">
      {/* 3D safe on a comic halftone background */}
      <div className="relative min-h-0 flex-1" style={{ background: 'radial-gradient(circle, rgba(252,163,17,.16) 1.6px, transparent 1.8px) 0 0/16px 16px, radial-gradient(ellipse at center, #263C68, #14213D 72%)' }}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
        <p className="absolute left-4 top-3 font-num text-sm font-bold tracking-[.3em] text-gold">ตู้เซฟเลขที่ลับ</p>
        {ready === 'loading' && <p className="absolute inset-0 grid place-items-center text-lg opacity-80">กำลังเปิดตู้เซฟ…</p>}
        <AnimatePresence>
          {result !== null && (
            <motion.div key={result} className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center" initial={{ scale: 2.4, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.45 }} role="status" aria-live="assertive">
              <div className="rounded-2xl border-[6px] border-alert bg-cream/95 px-6 py-2 text-center text-alert shadow-[6px_6px_0_#0b0f1a]">
                <p className="text-lg font-black sm:text-2xl">ผู้ต้องสงสัยหมายเลข</p>
                <p className="font-num text-7xl font-black leading-none sm:text-8xl">{result}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button type="button" onClick={onClose} aria-label="ปิดหน้าสุ่มเลขที่" className="absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-full bg-navy/80 ring-2 ring-gold hover:bg-dblue"><X /></button>
      </div>

      {/* settings: range, skipped numbers, no-repeat */}
      <div className="max-h-[48dvh] shrink-0 overflow-y-auto bg-cream p-4 text-navy lg:max-h-none lg:w-[420px]">
        <div className="flex flex-wrap items-end gap-3">
          <Stepper label="ตั้งแต่เลขที่" value={p.from} onChange={(v) => set({ from: v })} disabled={busy} />
          <Stepper label="ถึงเลขที่" value={p.to} onChange={(v) => set({ to: v })} disabled={busy} />
        </div>
        <label className="mt-3 flex items-center gap-2 font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-teal" checked={p.noRepeat} onChange={(e) => set({ noRepeat: e.target.checked })} disabled={busy} />
          ไม่สุ่มซ้ำ (เลขที่ออกแล้วจะไม่ออกอีก)
        </label>
        <p className="mt-3 text-sm font-semibold">แตะเลขที่เพื่อข้าม <span className="font-normal opacity-70">(เช่น นักเรียนที่ไม่มา)</span></p>
        <div className="mt-1 grid grid-cols-8 gap-1" role="group" aria-label="เลือกเลขที่ที่ข้าม">
          {nums.map((n) => {
            const skip = p.skip.includes(n), used = p.used.includes(n);
            return (
              <button key={n} type="button" onClick={() => toggle(n)} disabled={busy} aria-pressed={skip}
                aria-label={`เลขที่ ${n}${skip ? ' ข้าม' : ''}${used ? ' ออกแล้ว' : ''}`}
                className={`relative h-10 rounded-lg font-num text-base font-bold ring-1 transition ${skip ? 'bg-navy/15 text-navy/40 line-through ring-navy/10' : used ? 'bg-teal text-white ring-teal' : 'bg-white ring-navy/20 hover:ring-gold'} ${result === n ? 'outline outline-4 outline-alert' : ''}`}>
                {n}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs opacity-80">
          <span><span className="inline-block h-3 w-3 rounded bg-teal align-middle" /> ออกแล้ว</span>
          <span><span className="inline-block h-3 w-3 rounded bg-navy/15 align-middle" /> ข้าม</span>
        </p>
        {msg && <p role="alert" className="mt-2 rounded-lg bg-alert/10 p-2 font-semibold text-alert">{msg}</p>}
        <div className="sticky bottom-0 mt-3 space-y-2 bg-cream pt-2">
          <button type="button" onClick={result !== null ? again : spin} disabled={busy || ready === 'loading' || (result === null && !left.length)}
            className="w-full rounded-2xl bg-alert py-3 text-2xl font-black text-white shadow-[0_5px_0_#7a2222] transition active:translate-y-[2px] disabled:opacity-50">
            {busy ? 'กำลังไขรหัส…' : result !== null ? 'ปิดตู้ เตรียมสุ่มใหม่' : `หมุนตู้เซฟ! (เหลือ ${left.length} คน)`}
          </button>
          <button type="button" onClick={() => { set({ used: [] }); again(); }} disabled={busy || !p.used.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 font-semibold ring-2 ring-navy/20 hover:bg-navy/5 disabled:opacity-40">
            <RotateCcw size={18} aria-hidden /> ล้างเลขที่ออกแล้ว ({p.used.length})
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Stepper({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const btn = 'grid h-11 w-11 place-items-center rounded-lg bg-navy text-cream disabled:opacity-40';
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= PICKER_MIN} aria-label={`ลด${label}`}><Minus size={18} /></button>
        <input type="number" inputMode="numeric" min={PICKER_MIN} max={PICKER_MAX} value={value} disabled={disabled}
          onChange={(e) => e.target.value && onChange(Number(e.target.value))}
          className="h-11 w-16 rounded-lg border-2 border-navy/15 bg-white text-center font-num text-xl font-bold focus:border-gold focus:outline-none" />
        <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= PICKER_MAX} aria-label={`เพิ่ม${label}`}><Plus size={18} /></button>
      </span>
    </label>
  );
}
