import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { fetchGoogleSheetData } from './utils/googleSheets';

interface DBRow {
  uniqueKey: string;
  clientName: string;
  planned: string;
  step: string;
  how: string;
  doerName: string;
  link: string;
  forPc: string;
  doerEmail: string;
  finalDoerEmail: string;
  finalDoerName: string;
}

interface CompRow {
  timestamp: string;
  uniqueKey: string;
  clientName: string;
  step: string;
  doerName: string;
  doerEmail: string;
  status: string;
}

interface StageView {
  num: number;
  name: string;
  how: string;
  status: 'completed' | 'pending' | 'not-started';
  planned: string;
  link: string;
  timestamp: string;
  dbStep: string;
}

const MASTER_STEPS = [
  { num: 1, name: 'Data Required Mail & Call', how: 'Send formal data collection email & call responsible person.' },
  { num: 2, name: 'Reminder for Pending Data', how: 'Send reminder email & make reminder call.' },
  { num: 3, name: 'Receipt & Storage of Client Data', how: 'Acknowledge receipt via email. Save data in Client Folder.' },
  { num: 4, name: 'Data Verification & Clarification', how: 'Verify completeness & accuracy. Inform client of discrepancy.' },
  { num: 5, name: 'Accounting Entries', how: 'Pass sales/debit/credit entries in Tally. Update books.' },
  { num: 6, name: 'Preparation in Excel Format', how: 'Copy standard Excel format. Fill data. Follow GSTR-1 checklist.' },
  { num: 7, name: 'Online Data Entry on GST Portal', how: 'Login to GST portal. Fill invoice details. Generate draft summary.' },
  { num: 8, name: 'Self Cross-Check & Checklist', how: 'Cross-check with checklist, Excel working, Tally data.' },
  { num: 9, name: 'Submission to Senior for Review', how: 'Email Senior with working file, checklist, data path.' },
  { num: 10, name: 'Rectification (Senior Review)', how: 'Make corrections per senior feedback. Re-verify & resubmit.' },
  { num: 11, name: 'Filing of GSTR-1', how: 'File GSTR-1 using OTP/DSC. Download acknowledgment.' },
  { num: 12, name: 'Post-Filing & Record Keeping', how: 'Send acknowledgment to client. Save in data folder.' },
];

const SCRIPT = 'https://script.google.com/macros/s/AKfycbw98-Kh210wOX0roBEuRMEBENL71j3ht0pL9kp-7NS_YplvbDkLyWiAEXCQgp1YZqwxFg/exec';
const SHEET = 'https://docs.google.com/spreadsheets/d/13yOxJe9Tv7v6dmlZ3pybYTClQjiU3WnvOYonAL5KSBU/edit';
void SHEET;

function fmtD(d: any): string {
  if (!d) return '';
  if (typeof d === 'object' && d.getTime) return d.toLocaleDateString();
  return String(d);
}

function mapR(r: any): DBRow {
  return {
    uniqueKey: r['Unique Key'] || r['UNikey'] || '',
    clientName: r['CLIENT'] || r['Client Name'] || '',
    planned: fmtD(r['Planned'] || r['planned'] || ''),
    step: r['Step'] || r['step'] || '',
    how: r['How'] || r['how'] || '',
    doerName: r['Doer Name'] || '',
    link: r['Link'] || r['link'] || '',
    forPc: r['For PC'] || '',
    doerEmail: r['Doer Email'] || '',
    finalDoerEmail: r['Final Doer Email'] || '',
    finalDoerName: r['Final Doer Name'] || '',
  };
}

function mapC(r: any): CompRow {
  return {
    timestamp: String(r['Timestamp'] || ''),
    uniqueKey: r['Unique Key'] || '',
    clientName: r['Client Name'] || '',
    step: r['Step'] || '',
    doerName: r['Doer Name'] || '',
    doerEmail: r['Doer Email'] || '',
    status: r['Status'] || 'Completed',
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  const text = await response.text();

  if (text.trim().startsWith('<')) {
    throw new Error('Apps Script returned HTML instead of JSON. Check deployment URL and access permissions.');
  }

  return JSON.parse(text);
}

function taskToDBRow(task: any, fallbackEmail: string): DBRow {
  return {
    uniqueKey: task.uniqueKey || '',
    clientName: task.clientName || '',
    planned: task.plannedDate || '',
    step: task.step || '',
    how: task.how || '',
    doerName: task.finalDoerName || task.doerName || '',
    link: task.link || '',
    forPc: task.forPC || '',
    doerEmail: task.doerEmail || task.finalDoerEmail || fallbackEmail,
    finalDoerEmail: task.finalDoerEmail || task.doerEmail || fallbackEmail,
    finalDoerName: task.finalDoerName || task.doerName || fallbackEmail.split('@')[0],
  };
}

function normStep(s: string): string {
  return s.replace(/^step[-\s]*\d+[:\s.]*/i, '').trim().toLowerCase();
}

function stepNum(s: string): number {
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function stageKey(uniqueKey: string, dbStep: string) {
  return `${uniqueKey}__${dbStep}`;
}

function getStageFormLink(baseLink: string, uniqueKey: string, stageNo: number) {
  if (!baseLink) return '';

  try {
    const url = new URL(baseLink);
    url.searchParams.set('entry.1503257122', uniqueKey);
    url.searchParams.set('entry.1073343082', `R${stageNo}`);
    return url.toString();
  } catch {
    return baseLink
      .replace(/entry\.1503257122=[^&]*/i, `entry.1503257122=${encodeURIComponent(uniqueKey)}`)
      .replace(/entry\.1073343082=R?\d+/i, `entry.1073343082=R${stageNo}`);
  }
}

export default function App() {
  const [email, setEmail] = useState(() => localStorage.getItem('gm_email') || '');
  const [doerName, setDoerName] = useState(() => localStorage.getItem('gm_name') || '');
  const [inp, setInp] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoad, setLoginLoad] = useState(false);

  const [pending, setPending] = useState<DBRow[]>([]);
  const [completed, setCompleted] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState('');
  const [selClient, setSelClient] = useState('');
  const [search, setSearch] = useState('');
  const [marking, setMarking] = useState('');
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [hiddenClients, setHiddenClients] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);

  const loggedIn = Boolean(email && doerName);
  const hiddenStorageKey = `gm_hidden_clients_${email}`;

  useEffect(() => {
    if (!email) {
      setHiddenClients(new Set());
      return;
    }

    try {
      const saved = JSON.parse(localStorage.getItem(`gm_hidden_clients_${email}`) || '[]');
      setHiddenClients(new Set(Array.isArray(saved) ? saved : []));
    } catch {
      setHiddenClients(new Set());
    }
  }, [email]);

  const hideClientPermanently = (uniqueKey: string, clientName: string) => {
    const ids = [uniqueKey, clientName].filter(Boolean);
    setHiddenClients(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });
    setSelClient('');
  };

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      let db = { data: [] as any[] };
      let comp = { data: [] as any[] };

      try {
        [db, comp] = await Promise.all([
          fetchJson(`${SCRIPT}?action=getDB`).catch(() => ({ data: [] })),
          fetchJson(`${SCRIPT}?action=getCompleted`).catch(() => ({ data: [] })),
        ]);
      } catch (scriptError) {
        console.warn('Apps Script read failed, using published CSV fallback.', scriptError);
      }

      if (!db.data?.length && email) {
        const csvTasks = await fetchGoogleSheetData(email);
        db = { data: csvTasks.map(task => taskToDBRow(task, email)) };
      }

      if (db.data) setPending(db.data.map(mapR).filter((r: DBRow) => r.clientName && r.step));
      if (comp.data) setCompleted(comp.data.map(mapC).filter((r: CompRow) => r.clientName && r.step));
      setLastSync(new Date().toLocaleTimeString());
    } catch (e: any) {
      if (!silent) setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      fetchAll();
      timer.current = window.setInterval(() => fetchAll(true), 30000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
  }, [loggedIn, fetchAll]);

  const login = async () => {
    const e = inp.trim().toLowerCase();
    if (!e || !e.includes('@')) {
      setLoginErr('Enter a valid email');
      return;
    }

    setLoginLoad(true);
    setLoginErr('');
    try {
      let j: any = { data: [] as any[] };
      try {
        j = await fetchJson(`${SCRIPT}?action=getDB`);
        if (j.error) throw new Error(j.error);
      } catch (scriptError) {
        console.warn('Apps Script login check failed, using published CSV fallback.', scriptError);
      }

      if (!j.data?.length) {
        const csvTasks = await fetchGoogleSheetData(e);
        j = { data: csvTasks.map(task => taskToDBRow(task, e)) };
      }

      if (!j.data?.length) throw new Error('No data found for this email');

      const rows: DBRow[] = j.data.map(mapR).filter((row: DBRow) => row.clientName && row.step);
      const match = rows.find(row =>
        (row.finalDoerEmail || '').trim().toLowerCase() === e ||
        (row.doerEmail || '').trim().toLowerCase() === e
      );
      if (!match) {
        setLoginErr('Email not found in Final Doer Email / Doer Email column.');
        return;
      }

      const name = match.finalDoerName || match.doerName || e;
      setEmail(e);
      setDoerName(name);
      localStorage.setItem('gm_email', e);
      localStorage.setItem('gm_name', name);
      setPending(rows);
      setLastSync(new Date().toLocaleTimeString());
    } catch (e: any) {
      setLoginErr(e.message || 'Error');
    } finally {
      setLoginLoad(false);
    }
  };

  const logout = () => {
    setEmail('');
    setDoerName('');
    setInp('');
    localStorage.removeItem('gm_email');
    localStorage.removeItem('gm_name');
    setPending([]);
    setCompleted([]);
    setSelectedStages(new Set());
    setHiddenClients(new Set());
    setSelClient('');
    if (timer.current) clearInterval(timer.current);
  };

  const markDone = async (uniqueKey: string, clientName: string, stepName: string, link?: string) => {
    const key = stageKey(uniqueKey, stepName);
    const actualDate = new Date();
    setMarking(key);
    try {
      if (link) window.open(link, '_blank');
      await fetch(SCRIPT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'markDone',
          uniqueKey,
          clientName,
          step: stepName,
          doerName,
          doerEmail: email,
          status: 'Completed',
          actualDate: actualDate.toISOString(),
          timestamp: actualDate.toISOString()
        }),
      });

      confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 }, colors: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'] });
      if (stepNum(stepName) === 12) {
        hideClientPermanently(uniqueKey, clientName);
      }
      setSelectedStages(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setTimeout(() => fetchAll(), 2500);
    } catch {
      setError('Save failed');
    } finally {
      setMarking('');
    }
  };

  const markManyDone = async (stages: StageView[], clientName: string, uniqueKey: string) => {
    if (stages.length === 0) return;
    const actualDate = new Date();
    setMarking('multi');
    try {
      await Promise.all(stages.map(stage => fetch(SCRIPT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'markDone',
          uniqueKey,
          clientName,
          step: stage.dbStep,
          doerName,
          doerEmail: email,
          status: 'Completed',
          actualDate: actualDate.toISOString(),
          timestamp: actualDate.toISOString()
        }),
      })));

      confetti({ particleCount: 180, spread: 95, origin: { y: 0.62 }, colors: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'] });
      if (stages.some(stage => stage.num === 12 || stepNum(stage.dbStep) === 12)) {
        hideClientPermanently(uniqueKey, clientName);
      }
      setSelectedStages(new Set());
      setTimeout(() => fetchAll(), 2500);
    } catch {
      setError('Save failed');
    } finally {
      setMarking('');
    }
  };

  const markClientNotApplicable = async (clientName: string, uniqueKey: string) => {
    const actualDate = new Date();
    setMarking('not-applicable');
    try {
      await fetch(SCRIPT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setStepWiseTracking',
          applicable: 'No',
          uniqueKey,
          clientName,
          doerName,
          doerEmail: email,
          status: 'Completed',
          actualDate: actualDate.toISOString(),
          timestamp: actualDate.toISOString()
        }),
      });

      confetti({ particleCount: 220, spread: 100, origin: { y: 0.62 }, colors: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'] });
      setHiddenClients(prev => new Set(prev).add(uniqueKey || clientName));
      setSelectedStages(new Set());
      setSelClient('');
      setTimeout(() => fetchAll(), 2500);
    } catch {
      setError('Not applicable update failed');
    } finally {
      setMarking('');
    }
  };

  const myPending = pending.filter(row => {
    const e = email.toLowerCase();
    return (row.finalDoerEmail || '').trim().toLowerCase() === e || (row.doerEmail || '').trim().toLowerCase() === e;
  });
  const myCompleted = completed.filter(row => (row.doerEmail || '').toLowerCase() === email.toLowerCase());

  const clientMap = new Map<string, { clientName: string; uniqueKey: string; pendingSteps: DBRow[]; completedSteps: CompRow[] }>();
  myPending.forEach(row => {
    const key = row.uniqueKey || row.clientName;
    if (!clientMap.has(key)) clientMap.set(key, { clientName: row.clientName, uniqueKey: row.uniqueKey, pendingSteps: [], completedSteps: [] });
    clientMap.get(key)!.pendingSteps.push(row);
  });
  myCompleted.forEach(row => {
    const key = row.uniqueKey || row.clientName;
    if (!clientMap.has(key)) clientMap.set(key, { clientName: row.clientName, uniqueKey: row.uniqueKey, pendingSteps: [], completedSteps: [] });
    clientMap.get(key)!.completedSteps.push(row);
  });

  const clients = Array.from(clientMap.entries()).filter(([key, value]) => {
    if (hiddenClients.has(key) || hiddenClients.has(value.uniqueKey || value.clientName)) return false;
    if (value.completedSteps.some(step => stepNum(step.step) === 12 || normStep(step.step) === normStep(MASTER_STEPS[11].name))) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return value.clientName.toLowerCase().includes(s) || value.uniqueKey.toLowerCase().includes(s);
  }).sort((a, b) => a[1].clientName.localeCompare(b[1].clientName));

  useEffect(() => {
    if (clients.length > 0 && !clients.find(([key]) => key === selClient)) setSelClient(clients[0][0]);
  }, [clients, selClient]);

  const sel = clientMap.get(selClient);

  const buildStages = (data: { pendingSteps: DBRow[]; completedSteps: CompRow[] }) => MASTER_STEPS.map(masterStep => {
    const comp = data.completedSteps.find(row => stepNum(row.step) === masterStep.num || normStep(row.step) === normStep(masterStep.name));
    const pend = data.pendingSteps.find(row => stepNum(row.step) === masterStep.num || normStep(row.step) === normStep(masterStep.name));
    const baseLink = data.pendingSteps.find(row => row.link)?.link || '';
    const uniqueKey = data.pendingSteps[0]?.uniqueKey || data.completedSteps[0]?.uniqueKey || '';

    return {
      ...masterStep,
      status: comp ? 'completed' as const : pend ? 'pending' as const : 'not-started' as const,
      planned: pend?.planned || '',
      link: pend?.link || getStageFormLink(baseLink, uniqueKey, masterStep.num),
      how: pend?.how || masterStep.how,
      timestamp: comp?.timestamp || '',
      dbStep: pend?.step || comp?.step || `Step-${masterStep.num} ${masterStep.name}`,
    };
  });

  const totalPending = myPending.length;

  const getRunningStage = (stages: StageView[]) => stages.find(stage => stage.status === 'pending') || stages.find(stage => stage.status === 'not-started');

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#05050f] flex items-center justify-center p-4 overflow-hidden relative select-none">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-violet-700/8 rounded-full blur-[120px] ani-float" />
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-600/6 rounded-full blur-[100px]" />
          <div className="absolute top-[50%] left-[60%] w-[350px] h-[350px] bg-fuchsia-600/5 rounded-full blur-[100px]" />
          {[...Array(18)].map((_, i) => (
            <div key={i} className="absolute w-[2px] h-[2px] bg-white rounded-full ani-star" style={{ top: `${8 + Math.random() * 84}%`, left: `${5 + Math.random() * 90}%`, animationDelay: `${i * 0.4}s`, animationDuration: `${2 + Math.random() * 3}s` }} />
          ))}
          <div className="absolute top-[15%] right-[10%] w-[2px] h-[80px] bg-gradient-to-b from-violet-400 to-transparent rotate-[225deg] ani-meteor opacity-40" />
          <div className="absolute top-[30%] right-[30%] w-[1.5px] h-[60px] bg-gradient-to-b from-cyan-400 to-transparent rotate-[225deg] ani-meteor opacity-30" />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.3) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="absolute top-1/2 left-1/2 pointer-events-none">
          <div className="absolute w-2.5 h-2.5 bg-violet-500 rounded-full ani-orbit opacity-40 shadow-lg shadow-violet-500/50" />
          <div className="absolute w-2 h-2 bg-cyan-400 rounded-full opacity-30 shadow-lg shadow-cyan-400/50" style={{ animation: 'orbit2 22s linear infinite' }} />
          <div className="absolute w-1.5 h-1.5 bg-fuchsia-400 rounded-full opacity-25 shadow-lg shadow-fuchsia-400/50" style={{ animation: 'orbit3 14s linear infinite' }} />
        </div>

        <div className="relative max-w-md w-full ani-scaleIn" style={{ animationDuration: '.5s' }}>
          <div className="absolute top-1/2 left-1/2 w-[340px] h-[340px] border border-violet-500/10 rounded-full ani-hero-ring pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 w-[440px] h-[440px] border border-violet-500/5 rounded-full ani-hero-ring-rev pointer-events-none" />
          <div className="absolute top-[80px] left-1/2 w-20 h-20 border border-violet-500/20 rounded-full ani-wave pointer-events-none" />
          <div className="absolute top-[80px] left-1/2 w-20 h-20 border border-violet-500/15 rounded-full ani-wave pointer-events-none" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[80px] left-1/2 w-20 h-20 border border-violet-500/10 rounded-full ani-wave pointer-events-none" style={{ animationDelay: '2s' }} />

          <div className="relative bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-8 pt-24 space-y-6 border border-slate-700/30 ani-hero-card overflow-visible">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 ani-hero-icon z-10">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-cyan-500/30 rounded-3xl blur-xl" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-violet-600/40 border border-violet-400/20 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="relative drop-shadow-lg">
                    <rect x="4" y="20" width="6" height="16" rx="1.5" fill="#34d399" />
                    <rect x="13" y="14" width="6" height="22" rx="1.5" fill="#a78bfa" />
                    <rect x="22" y="8" width="6" height="28" rx="1.5" fill="#818cf8" />
                    <rect x="31" y="4" width="6" height="32" rx="1.5" fill="#f0abfc" />
                    <path d="M7 18 L16 12 L25 6 L34 2" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
                    <circle cx="34" cy="2" r="2.5" fill="#22d3ee" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="text-center space-y-2 pt-4">
              <h1 className="text-4xl font-black tracking-tight ani-hero-text">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-400">GSTR-1</span>
              </h1>
              <h2 className="text-2xl font-black tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-white to-slate-300">Mark Dashboard</span>
              </h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">12-Stage GST Return Workflow Tracker</p>
              <div className="flex justify-center gap-2 pt-2 flex-wrap">
                {['Data', 'Verify', 'Excel', 'Portal', 'Review', 'File'].map((s, i) => (
                  <span key={s} className="text-[9px] font-bold px-2 py-1 rounded-full border ani-badge" style={{ animationDelay: `${i * 0.3}s`, borderColor: i < 2 ? 'rgba(52,211,153,.3)' : i < 4 ? 'rgba(167,139,250,.3)' : 'rgba(34,211,238,.3)', color: i < 2 ? '#34d399' : i < 4 ? '#a78bfa' : '#22d3ee', background: i < 2 ? 'rgba(52,211,153,.06)' : i < 4 ? 'rgba(167,139,250,.06)' : 'rgba(34,211,238,.06)' }}>
                    {i < 2 ? '✓' : i < 4 ? '⏳' : '○'} {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
              <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Login</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-violet-500 inline-block" />
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-cyan-500/20 rounded-2xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                  <input
                    type="email"
                    value={inp}
                    onChange={e => { setInp(e.target.value); setLoginErr(''); }}
                    onKeyDown={e => e.key === 'Enter' && !loginLoad && login()}
                    placeholder="Enter your work email"
                    autoFocus
                    disabled={loginLoad}
                    className="relative w-full px-4 py-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 disabled:opacity-40 transition-all"
                  />
                </div>
              </div>

              {loginErr && (
                <div className="text-xs text-red-400 bg-red-950/40 px-4 py-3 rounded-xl border border-red-800/30 ani-slideUp flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">!</span>
                  <span>{loginErr}</span>
                </div>
              )}

              <button onClick={login} disabled={loginLoad} className="w-full relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-xl shadow-violet-900/40 hover:shadow-2xl hover:shadow-violet-600/30 hover:-translate-y-1 active:translate-y-0 active:shadow-lg flex items-center justify-center gap-2 group ani-grad">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">
                  {loginLoad ? (
                    <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying in DB Format...</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Login</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-1 transition-transform"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  )}
                </span>
              </button>
            </div>

            <div className="text-center space-y-2 pt-1">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="4" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3 4V3a3 3 0 116 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                <span>Secured • Validated against <span className="text-violet-400 font-semibold">Final Doer Email</span> column</span>
              </div>
              <p className="text-[9px] text-slate-700">Powered by Google Sheets + Apps Script</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <header className="glass-dark border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-lg shadow-lg shadow-violet-600/30 animate-pulse">📊</div>
            <div>
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400">GSTR-1 Mark Dashboard</h1>
              <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live • 30s refresh {lastSync && `• ${lastSync}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => fetchAll()} disabled={loading} className="flex items-center gap-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 transition-all hover:-translate-y-0.5">
              <span className={loading ? 'animate-spin' : ''}>↻</span>{loading ? 'Syncing...' : 'Refresh'}
            </button>
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-[11px] font-bold shadow-md">{doerName[0]?.toUpperCase()}</div>
              <div><p className="text-xs font-bold text-slate-200 leading-none">{doerName}</p><p className="text-[10px] text-slate-500 leading-none mt-0.5">{email}</p></div>
            </div>
            <button onClick={logout} className="text-xs text-red-400 font-semibold px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors">Logout</button>
          </div>
        </div>
      </header>

      <div className="glass-dark border-b border-slate-800/50">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap gap-3 items-center">
          <StatCard label="Clients" value={clients.length} icon="🏢" className="bg-slate-800/40 border-slate-700/40 text-white" />
          <StatCard label="Pending" value={totalPending} icon="⏳" className="bg-amber-900/20 border-amber-700/30 text-amber-300" />
          {error && <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded-lg border border-red-800/30">! {error}</span>}
          <div className="flex-1" />
          <div className="relative">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search client or ID..." className="bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-300 placeholder-slate-600" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">x</button>}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        {loading && pending.length === 0 ? (
          <EmptyState icon="📊" title="Loading your tasks..." />
        ) : clients.length === 0 ? (
          <EmptyState icon={pending.length === 0 ? '📭' : '🎉'} title={pending.length === 0 ? 'No data loaded' : 'All caught up!'} subtitle={pending.length === 0 ? 'Check connection' : 'No pending tasks!'} onRefresh={() => fetchAll()} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 ani-fadeIn">
            <div className="lg:col-span-4 xl:col-span-3">
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden sticky top-[120px]">
                <div className="p-3 border-b border-slate-800 bg-slate-800/30">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{doerName}'s Clients ({clients.length})</h2>
                </div>
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto divide-y divide-slate-800/50">
                  {clients.map(([key, value]) => {
                    const isActive = selClient === key;
                    const stages = buildStages(value);
                    const done = stages.filter(stage => stage.status === 'completed').length;
                    const runningStage = getRunningStage(stages);
                    return (
                      <button key={key} onClick={() => setSelClient(key)} className={`w-full text-left p-3 transition-all hover:bg-slate-800/30 ${isActive ? 'bg-violet-900/20 border-l-4 border-violet-500' : 'border-l-4 border-transparent'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isActive ? 'text-violet-300' : 'text-slate-300'}`}>{value.clientName}</p>
                            <p className="text-[10px] text-violet-500 font-mono mt-0.5">{value.uniqueKey}</p>
                            {runningStage && <p className="text-[10px] text-amber-400 font-bold mt-1">Running: Step {runningStage.num}</p>}
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-slate-800 text-slate-400">{done}/12</span>
                        </div>
                        <div className="mt-2 flex gap-0.5">
                          {stages.map((stage, i) => <div key={i} className={`flex-1 h-1 rounded-full ${stage.status === 'completed' ? 'bg-emerald-500' : stage.status === 'pending' ? 'bg-amber-500/60' : 'bg-slate-700'}`} />)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 xl:col-span-9 space-y-4">
              {!sel ? (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center"><p className="text-4xl mb-3 animate-bounce">←</p><h3 className="text-xl font-bold text-slate-300">Select a Client</h3></div>
              ) : (() => {
                const stages = buildStages(sel);
                const done = stages.filter(stage => stage.status === 'completed').length;
                const pct = Math.round((done / 12) * 100);
                const selectedForClient = stages.filter(stage => selectedStages.has(stageKey(sel.uniqueKey, stage.dbStep)) && stage.status !== 'completed');
                const twelfth = stages[11];
                const openStages = stages.filter(stage => stage.status !== 'completed');
                const runningStage = getRunningStage(stages);
                return (
                  <div className="space-y-4">
                    <div className="card-3d bg-slate-900/50 rounded-2xl border border-slate-800 p-5 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h2 className="text-xl font-black text-white">{sel.clientName}</h2>
                        <p className="text-sm text-violet-400 font-mono font-bold mt-0.5">{sel.uniqueKey}</p>
                        {runningStage && (
                          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-black text-amber-300">
                            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                            Running: Step {runningStage.num} - {runningStage.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {openStages.length > 0 && (
                          <button onClick={() => setSelectedStages(prev => {
                            const next = new Set(prev);
                            openStages.forEach(stage => next.add(stageKey(sel.uniqueKey, stage.dbStep)));
                            return next;
                          })} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black px-4 py-2.5 rounded-xl hover:border-violet-500 hover:text-white transition-all">
                            Select Open Stages
                          </button>
                        )}
                        {selectedForClient.length > 0 && (
                          <button onClick={() => markManyDone(selectedForClient, sel.clientName, sel.uniqueKey)} disabled={!!marking} className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg hover:-translate-y-0.5 transition-all">
                            {marking === 'multi' ? 'Saving...' : `✅ Mark Selected (${selectedForClient.length})`}
                          </button>
                        )}
                        {twelfth.status !== 'completed' && (
                          <button onClick={() => markDone(sel.uniqueKey, sel.clientName, twelfth.dbStep, twelfth.link)} disabled={!!marking} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg hover:-translate-y-0.5 transition-all">
                            Submit 12th Stage
                          </button>
                        )}
                        <button onClick={() => markClientNotApplicable(sel.clientName, sel.uniqueKey)} disabled={!!marking} className="bg-gradient-to-r from-slate-700 to-slate-900 border border-slate-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg hover:-translate-y-0.5 hover:border-cyan-400 transition-all">
                          {marking === 'not-applicable' ? 'Updating...' : 'Step Wise Tracking: No'}
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                          <span className="text-sm font-bold text-slate-400">{pct}%</span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{done}<span className="text-slate-600">/12</span></p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Stages Done</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {stages.map((stage, idx) => {
                        const isDone = stage.status === 'completed';
                        const isPend = stage.status === 'pending';
                        const key = stageKey(sel.uniqueKey, stage.dbStep);
                        const isMarking = marking === key;
                        const isSelected = selectedStages.has(key);
                        const isRunning = runningStage?.num === stage.num;
                        return (
                          <div key={idx} className={`card-3d rounded-2xl border overflow-hidden transition-all ani-slideUp ${
                            isRunning
                              ? 'bg-amber-950/30 border-amber-400/70 shadow-[0_0_32px_rgba(245,158,11,0.20)] scale-[1.015]'
                              : isPend
                              ? 'bg-slate-900/70 border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.12)] hover:border-violet-500/70'
                              : isDone
                                ? 'bg-emerald-900/10 border-emerald-700/30 hover:border-emerald-500/50'
                                : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-600'
                          }`} style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className={`px-4 py-2.5 flex items-center justify-between border-b ${isDone ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-md ${isDone ? 'bg-emerald-500 text-white shadow-emerald-500/30' : isPend ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-violet-500/30' : 'bg-slate-700 text-slate-500'}`}>{isDone ? '✓' : stage.num}</div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isRunning ? 'text-amber-300' : isDone ? 'text-emerald-400' : isPend ? 'text-violet-400' : 'text-slate-600'}`}>{isRunning ? 'Running ' : ''}Step {stage.num}</span>
                              </div>
                              {!isDone ? (
                                <button onClick={() => setSelectedStages(prev => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key); else next.add(key);
                                  return next;
                                })} className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-500 hover:border-emerald-400 hover:text-emerald-400'}`} title="Select for multiple tick mark">
                                  {isSelected ? '✓' : ''}
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">DONE</span>
                              )}
                            </div>
                            <div className="p-4 space-y-3">
                              <h4 className={`text-sm font-bold leading-tight ${isDone ? 'text-emerald-300/70 line-through' : 'text-slate-200'}`}>{stage.name}</h4>
                              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{stage.how}</p>
                              {stage.planned && <p className="text-[10px] text-slate-500">Plan: <span className="text-amber-400 font-semibold">{stage.planned}</span></p>}
                              {isDone && stage.timestamp && <p className="text-[10px] text-emerald-500">Done: {stage.timestamp}</p>}
                              {!isDone && (
                                <button onClick={() => markDone(sel.uniqueKey, sel.clientName, stage.dbStep, stage.link)} disabled={!!marking} className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${isMarking ? 'bg-slate-700 text-slate-400' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-600/20 hover:-translate-y-0.5'}`}>
                                  {isMarking ? 'Saving...' : '✅ Mark Complete'}
                                </button>
                              )}
                              {isDone && <div className="w-full py-2 rounded-xl text-xs font-bold text-emerald-500 bg-emerald-900/20 border border-emerald-800/30 text-center">✓ Completed</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, className }: { label: string; value: number; icon: string; className: string }) {
  return (
    <div className={`card-3d flex items-center gap-2 border px-3 py-2 rounded-xl ${className}`}>
      <span className="text-lg">{icon}</span>
      <div><p className="text-[9px] text-slate-500 font-bold uppercase">{label}</p><p className="text-lg font-black leading-none">{value}</p></div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, onRefresh }: { icon: string; title: string; subtitle?: string; onRefresh?: () => void }) {
  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-16 text-center ani-scaleIn">
      <div className="text-5xl mb-4 animate-bounce">{icon}</div>
      <h3 className="text-xl font-bold text-slate-200">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-2">{subtitle}</p>}
      {onRefresh && <button onClick={onRefresh} className="mt-5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5">Refresh</button>}
    </div>
  );
}