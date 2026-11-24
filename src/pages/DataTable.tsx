import { useState } from 'react';
import { motion } from 'framer-motion';
import { Page } from '../components/ui';
import { CASE_SCENES, DEFAULT_CASES } from '../lib/cases';

const COLS = [['mean', 'ค่าเฉลี่ย'], ['median', 'มัธยฐาน'], ['mode', 'ฐานนิยม']] as const;

/** All three cases on one page: data on top, three blank cells the teacher fills in with the class's answers (kept while the page stays open). */
export default function DataTable() {
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <Page title="ตารางข้อมูล" back="/hq" bg="hq-bg.webp">
      <div className="mx-auto max-w-4xl space-y-5">
        {DEFAULT_CASES.map((c, k) => (
          <motion.section key={c.code} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.1 }}
            className="rounded-3xl bg-cream/95 p-4 text-navy shadow-2xl ring-4 ring-gold sm:p-6">
            <h2 className="text-2xl font-black sm:text-3xl"><span className="font-num tracking-widest text-alert">{c.code}</span> {c.title}</h2>
            <p className="mt-2 rounded-xl bg-navy px-4 py-2 text-center font-num text-xl font-bold text-gold sm:text-3xl">{CASE_SCENES[c.code].dataText}</p>
            <table className="mt-3 w-full table-fixed border-collapse text-center">
              <thead>
                <tr className="bg-navy text-gold">{COLS.map(([, th]) => <th key={th} className="border-4 border-navy p-2 text-xl font-black sm:text-3xl">{th}</th>)}</tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  {COLS.map(([m, th]) => (
                    <td key={m} className="border-4 border-navy p-0">
                      <input value={vals[c.code + m] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [c.code + m]: e.target.value }))} maxLength={12} aria-label={`${th} ${c.code}`}
                        className="h-16 w-full bg-white text-center font-num text-2xl font-bold text-navy focus:bg-gold/20 focus:outline-none sm:h-20 sm:text-4xl" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.section>
        ))}
      </div>
    </Page>
  );
}
