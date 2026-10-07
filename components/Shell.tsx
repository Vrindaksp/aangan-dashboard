import Link from 'next/link';
import type { ReactNode } from 'react';
import { shortMonth } from '@/lib/metrics';
import { href } from '@/lib/url';
import { LiveRefresh } from './LiveRefresh';
import { Badge, Flash } from './ui';
import type { View, ViewCtx } from './types';

const TABS: Record<'designer' | 'founder', { view: View; label: string }[]> = {
  designer: [
    { view: 'queue', label: 'Enquiries' },
    { view: 'escalations', label: 'Escalations' },
    { view: 'calendar', label: 'Calendar' },
    { view: 'pricing', label: 'Pricing & costs' },
    { view: 'overview', label: 'Results' },
  ],
  founder: [
    { view: 'overview', label: 'Results' },
    { view: 'pricing', label: 'Pricing & costs' },
  ],
};

export const allowedViews = (role: 'designer' | 'founder'): View[] => TABS[role].map((t) => t.view);

export function Shell({ ctx, view, openEscalations, children }: { ctx: ViewCtx; view: View; openEscalations: number; children: ReactNode }) {
  const { role, sp, month, months, ds, includeSynthetic } = ctx;
  const synthetic = ds.enquiries.some((e) => e.is_synthetic);
  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-16 sm:px-6">
      {/* Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule pb-3 pt-6">
        <div>
          <div className="label">Aangan Studio · Pune</div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight sm:text-4xl">
            Enquiry <span className="text-accent">Desk</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveRefresh seconds={30} />
          <Badge tone={role === 'founder' ? 'info' : 'accent'} title={role === 'founder' ? 'Outcome-level numbers only — no transcripts or client details' : 'Full working access'}>
            {role === 'founder' ? 'Founder · results only' : 'Designer · full access'}
          </Badge>
          {role === 'founder' && (
            <Link href={process.env.OPEN_ACCESS === 'true' ? '/?as=designer' : '/?login=1'} className="btn-ghost" title="Designers and front desk: open the full working tool">
              {process.env.OPEN_ACCESS === 'true' ? 'Designer view' : 'Designer sign-in'}
            </Link>
          )}
          {role === 'designer' && process.env.OPEN_ACCESS === 'true' && (
            <Link href="/?as=founder" className="btn-ghost" title="Results only — no client details">
              Results view
            </Link>
          )}
        </div>
      </header>

      {ds.demo && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border border-warn/50 bg-warn/10 px-4 py-2 text-xs text-warn">
          <span className="font-mono uppercase tracking-arch">Demo mode</span>
          <span className="text-bone">
            Showing the 40 real September 2026 enquiries held in memory (changes reset on restart). Add Supabase keys to go live.
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3" aria-label="Views">
        <ul className="flex flex-wrap gap-1">
          {TABS[role].map((t) => {
            const active = t.view === view;
            return (
              <li key={t.view}>
                <Link
                  href={href(sp, { view: t.view, enquiry: null, week: null })}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 border px-3.5 py-2 font-mono text-[11px] uppercase tracking-arch transition-colors ${active ? 'border-accent bg-accent text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
                >
                  {t.label}
                  {t.view === 'escalations' && openEscalations > 0 && (
                    <span className={`px-1.5 text-[10px] ${active ? 'bg-ink text-accent' : 'bg-crit text-ink'}`}>{openEscalations}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          {synthetic && (
            <Link href={href(sp, { syn: includeSynthetic ? '0' : '1' })} className="btn-ghost" title="Synthetic rows are simulated, not real enquiries">
              {includeSynthetic ? 'Hide' : 'Include'} synthetic data
            </Link>
          )}
          <label className="flex items-center gap-2">
            <span className="label">Month</span>
            <div className="flex gap-1">
              {months.slice(0, 4).map((mo) => (
                <Link
                  key={mo}
                  href={href(sp, { month: mo, enquiry: null })}
                  aria-current={mo === month ? 'true' : undefined}
                  className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${mo === month ? 'border-bone text-bone' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
                >
                  {shortMonth(mo)}
                </Link>
              ))}
            </div>
          </label>
        </div>
      </nav>

      <main className="mt-5">
        <Flash msg={sp.msg} ok={sp.ok} />
        {children}
      </main>

      <footer className="mt-12 border-t border-line pt-4 font-mono text-[11px] uppercase tracking-arch text-dim">
        Aangan Studio · pricing is never quoted to clients · all times IST
      </footer>
    </div>
  );
}
