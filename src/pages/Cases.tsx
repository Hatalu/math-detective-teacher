import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Btn, Page } from '../components/ui';
import { Art } from '../components/art';
import { SceneHunt } from '../components/SceneHunt';
import { CASE_SCENES, DEFAULT_CASES } from '../lib/cases';

/** Teacher-only team activity on the class screen: #/cases (pick a case) and #/cases/1..3 (brief → hunt → question).
 *  No rooms, no QR: the class points, the teacher taps, students write the data on their worksheet. */
export default function Cases() {
  const { n } = useParams();
  const i = Number(n) - 1;
  if (!n || !DEFAULT_CASES[i]) return <Picker />;
  return <CaseView key={i} i={i} />; // key: moving to another case starts it fresh
}

function Picker() {
  return (
    <Page title="กิจกรรมทีม · เลือก CASE" back="/hq" bg="hq-bg.webp">
      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
        {DEFAULT_CASES.map((c, k) => (
          <motion.div key={c.code} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.08 }}>
            <Link to={`/cases/${k + 1}`} className="block overflow-hidden rounded-2xl bg-cream text-navy shadow-xl ring-4 ring-gold/40 transition hover:-translate-y-1 hover:ring-gold">
              <Art file={CASE_SCENES[c.code].bg} className="aspect-video w-full object-cover" fallback={<div className="aspect-video bg-gradient-to-br from-dblue to-navy" />} />
              <div className="p-4">
                <p className="font-num text-sm font-bold tracking-[.3em] text-alert">{c.code}</p>
                <p className="text-2xl font-black">{c.title}</p>
                <p className="mt-1 opacity-80">หาเบาะแส {c.data.length} ชิ้น</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Page>
  );
}

function CaseView({ i }: { i: number }) {
  const nav = useNavigate();
  const c = DEFAULT_CASES[i];
  const scene = CASE_SCENES[c.code];
  const [phase, setPhase] = useState<'brief' | 'hunt' | 'question'>('brief');
  const prev = i > 0 ? i : 0; // 1-based route number of the previous case (0 = none)
  const next = i + 2 <= DEFAULT_CASES.length ? i + 2 : 0;
  const caseNav = (
    <div className="flex gap-2">
      <Btn variant="navy" className="!px-3" disabled={!prev} onClick={() => nav(`/cases/${prev}`)}><ChevronLeft aria-hidden /><span className="max-sm:hidden">CASE ก่อนหน้า</span></Btn>
      <Btn className="!px-3" disabled={!next} onClick={() => nav(`/cases/${next}`)}><span className="max-sm:hidden">CASE ถัดไป</span><ChevronRight aria-hidden /></Btn>
    </div>
  );

  return (
    <Page full title={`${c.code} ${c.title}`} back="/cases" right={caseNav}>
      {phase === 'brief' && (
        <div className="relative h-full overflow-hidden">
          <Art file={scene.bg} className="absolute inset-0 h-full w-full object-cover opacity-60" />
          <div className="relative grid h-full place-items-center overflow-y-auto p-4">
            <motion.div initial={{ scale: 0.8, rotate: -3, opacity: 0 }} animate={{ scale: 1, rotate: -1, opacity: 1 }} className="w-full max-w-2xl rounded-2xl bg-cream p-6 text-navy shadow-2xl ring-4 ring-gold">
              <p className="font-num text-sm font-bold tracking-[.3em] text-alert">{c.code} · แฟ้มลับ</p>
              <h2 className="text-4xl font-black">{c.title}</h2>
              <p className="mt-2 text-xl">{c.story}</p>
              <p className="mt-3 rounded-xl bg-navy/5 p-3 text-lg"><b>ภารกิจ:</b> {c.objective}</p>
              <Btn className="mt-4 w-full text-2xl" onClick={() => setPhase('hunt')}><Search aria-hidden /> เข้าที่เกิดเหตุ</Btn>
            </motion.div>
          </div>
        </div>
      )}
      {phase === 'hunt' && <SceneHunt scene={scene} onDone={() => setPhase('question')} />}
      {phase === 'question' && (
        <div className="relative h-full overflow-hidden bg-navy">
          <Art file={scene.questionBg} className="absolute inset-0 h-full w-full object-cover" fallback={<Art file={scene.bg} className="absolute inset-0 h-full w-full object-cover" />} />
          <div className="absolute inset-0 bg-navy/45" aria-hidden />
          <div className="relative grid h-full place-items-center overflow-y-auto p-4 sm:p-8">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.4 }}
              className="w-full max-w-5xl rounded-3xl bg-cream/95 p-6 text-center text-navy shadow-2xl ring-8 ring-gold sm:p-10">
              <p className="font-num text-lg font-bold tracking-[.3em] text-alert sm:text-2xl">{c.code} · {c.title}</p>
              <p className="mx-auto mt-3 inline-block rounded-xl bg-navy px-4 py-2 font-num text-xl font-bold text-gold sm:text-3xl">{c.dataLabel}: {scene.dataText}</p>
              <h2 className="mt-5 text-3xl font-black leading-snug sm:text-5xl sm:leading-tight">{scene.question}</h2>
            </motion.div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {next ? <Btn className="text-xl" onClick={() => nav(`/cases/${next}`)}>ไป {DEFAULT_CASES[next - 1].code} <ChevronRight aria-hidden /></Btn>
                : <Btn className="text-xl" onClick={() => nav('/cases')}>กลับไปเลือก CASE</Btn>}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
