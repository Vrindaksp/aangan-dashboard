// Shared UI primitives. Server components only (no client JS). Keep these stable — every view uses them.

import Link from 'next/link';
import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'accent';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-bone', ok: 'text-ok', warn: 'text-warn', crit: 'text-crit', info: 'text-info', accent: 'text-accent',
};
const TONE_BORDER: Record<Tone, string> = {
  neutral: 'border-line text-mute', ok: 'border-ok/60 text-ok', warn: 'border-warn/60 text-warn', crit: 'border-crit/60 text-crit',
  info: 'border-info/60 text-info', accent: 'border-accent/70 text-accent',
};
export const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-bone', ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-info', accent: 'bg-accent',
};

/** Status chip. Always carries text (never colour alone). */
export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TONE_BORDER[tone]}`}>
      {children}
    </span>
  );
}

/** Numbered section heading, drawing-sheet style:  01 — VOLUME */
export function SectionHead({ index, title, note, right }: { index?: string; title: string; note?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-rule pb-2">
      <div>
        <h2 className="flex items-baseline gap-3 font-display text-lg font-bold uppercase tracking-wide">
          {index && <span className="font-mono text-xs text-accent">{index}</span>}
          {title}
        </h2>
        {note && <p className="mt-1 max-w-3xl text-xs text-mute">{note}</p>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ title, right, hot, children, className = '', pad = true }: { title?: ReactNode; right?: ReactNode; hot?: boolean; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`${hot ? 'panel-hot' : 'panel'} ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h3 className="label">{title}</h3>
          {right}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

/** Big-number KPI cell. `hot` = accent top rule (use for the 1–2 numbers that matter most). */
export function Kpi({ label, value, sub, tone = 'neutral', hot, href, unit }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; hot?: boolean; href?: string; unit?: string }) {
  const body = (
    <div className={`${hot ? 'panel-hot' : 'panel'} h-full p-4 transition-colors ${href ? 'hover:bg-raised' : ''}`}>
      <div className="label">{label}</div>
      <div className={`num mt-2 text-4xl leading-none md:text-5xl ${TONE_TEXT[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-lg font-medium text-mute">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-xs text-mute">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{body}</Link> : body;
}

/** Thin horizontal bar. value/max in the same units. */
export function Bar({ value, max, tone = 'accent', height = 6, label }: { value: number; max: number; tone?: Tone; height?: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="w-full bg-line/60" style={{ height }} role="img" aria-label={label ?? `${Math.round(pct)}%`}>
      <div className={`h-full ${TONE_BG[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Confidence meter with the escalation threshold marked. Below the line = held for a human.
 * `value` and `threshold` are 0–1.
 */
export function ConfidenceMeter({ value, threshold = 0.85, label = true }: { value: number | null; threshold?: number; label?: boolean }) {
  if (value === null) return <span className="mono text-xs text-dim">n/a</span>;
  const ok = value >= threshold;
  return (
    <div className="flex items-center gap-2" title={`Threshold ${(threshold * 100).toFixed(0)}%`}>
      <div className="relative h-2 w-28 bg-line/60" role="img" aria-label={`Confidence ${(value * 100).toFixed(0)}% (threshold ${(threshold * 100).toFixed(0)}%)`}>
        <div className={`h-full ${ok ? 'bg-ok' : 'bg-crit'}`} style={{ width: `${value * 100}%` }} />
        <div className="absolute -top-1 h-4 w-px bg-bone" style={{ left: `${threshold * 100}%` }} />
      </div>
      {label && <span className={`mono text-xs ${ok ? 'text-ok' : 'text-crit'}`}>{(value * 100).toFixed(0)}%{ok ? '' : ' · held'}</span>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-line px-4 py-6 text-center text-sm text-mute">{children}</div>;
}

/** Status message shown after an action (?msg=…&ok=1|0). */
export function Flash({ msg, ok }: { msg?: string; ok?: string }) {
  if (!msg) return null;
  const good = ok !== '0';
  return (
    <div role="status" className={`mb-4 flex items-start gap-3 border px-4 py-2.5 text-sm ${good ? 'border-ok/60 bg-ok/10 text-ok' : 'border-crit/60 bg-crit/10 text-crit'}`}>
      <span className="font-mono text-[11px] uppercase tracking-arch">{good ? 'Done' : 'Not done'}</span>
      <span className="text-bone">{msg}</span>
    </div>
  );
}

/** Every form must carry this so actions redirect back to the same view. */
export function ReturnTo({ value }: { value: string }) {
  return <input type="hidden" name="return_to" value={value} />;
}

// ---- tone helpers ----------------------------------------------------------------------------

export const qualTone = (q: string | null | undefined): Tone =>
  q === 'qualified' ? 'ok' : q === 'unqualified' ? 'neutral' : q === 'review' ? 'warn' : 'neutral';
export const qualLabel = (q: string | null | undefined) =>
  q === 'qualified' ? 'Qualified' : q === 'unqualified' ? 'Declined' : q === 'review' ? 'Needs review' : q === 'not_applicable' ? 'Not a lead' : '—';
export const severityTone = (s: string): Tone => (s === 'critical' ? 'crit' : s === 'high' ? 'crit' : s === 'medium' ? 'warn' : 'neutral');
export const statusTone = (s: string): Tone =>
  s === 'won' ? 'ok' : s === 'handed_off' ? 'info' : s === 'escalated' ? 'warn' : s === 'lost' ? 'crit' : 'neutral';
export const channelLabel = (c: string) => (c === 'web_form' ? 'Web form' : c === 'whatsapp' ? 'WhatsApp' : 'Phone');
