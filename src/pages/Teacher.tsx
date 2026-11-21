import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DoorOpen, LogOut, Plus, Trash2 } from 'lucide-react';
import { Btn, Card, ConnectionBadge, Empty, ErrorBox, Field, Page, SetupRequired, Spinner, inputCls } from '../components/ui';
import { createRoom, type Session } from '../lib/api';
import { db, ensureStudentSession, supabase, thaiError } from '../lib/supabase';

type Auth = { state: 'loading' } | { state: 'out' } | { state: 'notTeacher'; email: string } | { state: 'in'; uid: string; name: string };

export function useTeacher() {
  const [auth, setAuth] = useState<Auth>({ state: 'loading' });
  const check = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u) return setAuth({ state: 'out' });
    const p = await supabase.from('teacher_profiles').select('display_name').eq('user_id', u.id).maybeSingle();
    setAuth(p.data ? { state: 'in', uid: u.id, name: p.data.display_name } : { state: 'notTeacher', email: u.email ?? '' });
  }, []);
  useEffect(() => { check(); const s = supabase?.auth.onAuthStateChange(() => { setTimeout(check, 0); }); /* defer: auth calls inside this callback deadlock supabase-js */ return () => s?.data.subscription.unsubscribe(); }, [check]);
  return auth;
}

/** Wrap any teacher page: shows login, "not a teacher", or the page. */
export function TeacherGate({ title, back = '/hq', children }: { title: string; back?: string; children: (uid: string, name: string) => ReactNode }) {
  const auth = useTeacher();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!supabase) return <Page title={title} back={back}><SetupRequired /></Page>;
  if (auth.state === 'loading') return <Page title={title} back={back}><Spinner /></Page>;
  if (auth.state === 'in') return <>{children(auth.uid, auth.name)}</>;

  // open entry: no account, no approval. The teacher row is tied to this browser's anonymous session.
  async function quick() {
    setErr(''); setBusy(true);
    try {
      await ensureStudentSession();
      const r = await supabase!.rpc('become_teacher', { p_name: name });
      if (r.error) throw r.error;
      location.reload(); // simplest way to make the gate re-check with the new teacher row
    } catch (e) { setErr(thaiError(e)); } finally { setBusy(false); }
  }
  async function login() {
    setErr(''); setBusy(true);
    try {
      const { data } = await supabase!.auth.getSession();
      if (data.session?.user.is_anonymous) await supabase!.auth.signOut(); // a student session on a shared iPad
      const r = await supabase!.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (r.error) throw new Error(r.error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : r.error.message);
    } catch (e) { setErr(thaiError(e)); } finally { setBusy(false); }
  }
  return (
    <Page title="เข้าสู่ระบบครู" back={back}>
      <Card className="mx-auto max-w-sm space-y-3">
        <h2 className="text-lg font-bold">เข้าใช้ทันที (ไม่ต้องสมัคร)</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); quick(); }}>
          <Field label="ชื่อที่แสดง"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ครูเอิร์ท" /></Field>
          <Btn className="w-full" disabled={busy}>{busy ? 'กำลังเข้า…' : 'เข้าสู่ศูนย์ควบคุมครู'}</Btn>
        </form>
        <p className="text-xs opacity-70">ข้อมูลห้องและชุดโจทย์ผูกกับเบราว์เซอร์นี้ ใช้เครื่องเดิมทุกคาบ ถ้าล้างข้อมูลเบราว์เซอร์จะเริ่มใหม่ (ต้องการใช้หลายเครื่อง ให้ล็อกอินด้วยอีเมลด้านล่าง)</p>
        <hr className="border-navy/10" />
        <h2 className="font-bold">หรือเข้าด้วยอีเมล</h2>
        {auth.state === 'notTeacher' && auth.email && <Btn variant="teal" className="w-full" disabled={busy} onClick={quick}>เปิดสิทธิ์ครูให้บัญชี {auth.email}</Btn>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); login(); }}>
          <Field label="อีเมล"><input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="รหัสผ่าน"><input className={inputCls} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
          <Btn className="w-full" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</Btn>
        </form>
        {auth.state === 'notTeacher' && <Btn variant="navy" className="w-full" onClick={() => supabase!.auth.signOut()}>ออกจากระบบ</Btn>}
        {err && <ErrorBox msg={err} />}
      </Card>
    </Page>
  );
}
