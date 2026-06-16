import { ReactNode, useState } from 'react';
import { User } from '../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const { validateEmailInSheet } = await import('../utils/auth');
      const isValid = await validateEmailInSheet(email);

      if (!isValid) {
        setError('This email is not assigned in Final Doer Email column.');
        setIsLoading(false);
        return;
      }

      onLogin({ email: email.trim().toLowerCase(), name: email.split('@')[0] });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to verify email. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="star-field relative min-h-screen overflow-hidden bg-[#070714] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_49%_18%,rgba(147,51,234,0.24),transparent_26%),radial-gradient(circle_at_68%_48%,rgba(6,182,212,0.12),transparent_24%),radial-gradient(circle_at_26%_65%,rgba(88,28,135,0.18),transparent_30%)]" />
      <div className="pointer-events-none absolute left-[68%] top-[38%] h-px w-24 -rotate-45 bg-cyan-500/40 shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
      <div className="pointer-events-none absolute left-[14%] top-[77%] h-px w-20 -rotate-45 bg-cyan-500/25" />

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="login-card scanlines relative w-full max-w-[675px] rounded-[2.75rem] px-12 pb-12 pt-44 text-center shadow-[0_0_70px_rgba(168,85,247,0.15)]">
          <div className="absolute left-1/2 top-0 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-b-[2rem] rounded-t-none bg-gradient-to-br from-violet-500 to-fuchsia-700 shadow-[0_0_60px_rgba(168,85,247,0.45)]">
            <svg className="h-16 w-16 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 19V5m5 14V9m5 10V6m5 13V3" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 19h16" />
            </svg>
          </div>

          <h1 className="mb-3 text-6xl font-black leading-none tracking-tight">
            <span className="bg-gradient-to-b from-fuchsia-200 via-violet-300 to-purple-700 bg-clip-text text-transparent text-glow">
              GSTR-1
            </span>
          </h1>
          <h2 className="mb-5 text-4xl font-black tracking-tight text-white drop-shadow-lg">
            Mark Dashboard
          </h2>
          <p className="text-xl font-bold text-slate-500">
            12-Stage GST Return Workflow Tracker
          </p>

          <div className="mx-auto mt-7 flex max-w-[540px] flex-wrap justify-center gap-3">
            <Chip tone="done">✓ Data</Chip>
            <Chip tone="done">✓ Verify</Chip>
            <Chip tone="wait">⌛ Excel</Chip>
            <Chip tone="wait">⌛ Portal</Chip>
            <Chip tone="open">○ Review</Chip>
            <Chip tone="open">○ File</Chip>
          </div>

          <div className="my-10 flex items-center gap-5 text-sm font-black uppercase tracking-[0.3em] text-slate-600">
            <div className="h-px flex-1 bg-slate-700/70" />
            Login
            <div className="h-px flex-1 bg-slate-700/70" />
          </div>

          <form onSubmit={handleSubmit} className="mx-auto max-w-[580px] space-y-6 text-left">
            <div>
              <label htmlFor="email" className="mb-3 flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                className="input-glow w-full rounded-3xl border border-purple-500/50 bg-slate-800/70 px-7 py-6 text-xl font-semibold text-white outline-none placeholder:text-slate-600"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-neon flex w-full items-center justify-center gap-3 rounded-3xl px-6 py-6 text-xl font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Checking...' : 'Login'}
              {!isLoading && (
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.7} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </form>

          <div className="mt-9 text-sm font-semibold text-slate-600">
            <span className="mr-2">▢</span>
            Secured • Validated against <span className="font-black text-purple-300">Final Doer Email</span> column
          </div>
          <div className="mt-5 text-xs font-semibold text-slate-700">
            Powered by Google Sheets + Apps Script
          </div>
        </section>
      </main>
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: 'done' | 'wait' | 'open' }) {
  const styles = {
    done: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    wait: 'border-purple-400/30 bg-purple-400/10 text-purple-300',
    open: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
  };

  return (
    <span className={`rounded-full border px-4 py-2 text-sm font-black ${styles[tone]}`}>
      {children}
    </span>
  );
}