// Small server-rendered chart helpers (inline SVG / div bars, CSS-variable colours, no client JS).
// Used by the Overview and Pricing views. Every chart has role="img" + aria-label and a text legend,
// so colour is never the only signal.

import type { ReactNode } from 'react';
import { Bar, TONE_BG, type Tone } from './ui';

const pctText = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

// ---- Stat: compact numeral cell (sits inside panels / grids) --------------------------------------

const STAT_TEXT: Record<Tone, string> = {
  neutral: 'text-bone', ok: 'text-ok', warn: 'text-warn', crit: 'text-crit', info: 'text-info', accent: 'text-accent',
};

/** Mid-size numeral with a caption. `grid gap-px bg-line` parents give the hairline-grid look. */
export function Stat({ label, value, sub, tone = 'neutral', unit }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; unit?: string }) {
  return (
    <div className="bg-panel p-4">
      <div className="label">{label}</div>
      <div className={`num mt-1.5 text-2xl leading-none md:text-3xl ${STAT_TEXT[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-mute">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs leading-snug text-mute">{sub}</div>}
    </div>
  );
}

/** Hairline grid wrapper for Stat cells: 1px lines between cells, no outer gaps. */
export function StatGrid({ children, className = 'grid-cols-2 md:grid-cols-4' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-px border border-line bg-line ${className}`}>{children}</div>;
}

// ---- Stacked daily volume ------------------------------------------------------------------------

export interface DailyPoint { day: string; phone: number; whatsapp: number; web_form: number; total: number }

// Stack order bottom → top. Three clearly different lightness steps: vermilion, blue, bone.
const SERIES = [
  { key: 'phone', label: 'Phone', fill: 'rgb(var(--accent))', swatch: 'bg-accent' },
  { key: 'whatsapp', label: 'WhatsApp', fill: 'rgb(var(--info))', swatch: 'bg-info' },
  { key: 'web_form', label: 'Web form', fill: 'rgb(var(--bone))', swatch: 'bg-bone' },
] as const;

export function ChannelLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
      {SERIES.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-mute">
          <span className={`inline-block h-2.5 w-2.5 ${s.swatch}`} aria-hidden />
          {s.label}
          <span className="text-dim">{i === 0 ? '(bottom)' : i === 2 ? '(top)' : ''}</span>
        </li>
      ))}
    </ul>
  );
}

/** One column per day of the month; segments stacked phone → WhatsApp → web form. */
export function StackedDailyBars({ days, height = 168 }: { days: DailyPoint[]; height?: number }) {
  const n = days.length;
  const max = Math.max(1, ...days.map((d) => d.total));
  // Round the axis ceiling up to a tidy number so gridlines read cleanly.
  const ceil = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const W = n * 10;
  const H = 100;
  const total = days.reduce((a, d) => a + d.total, 0);
  const peak = days.reduce((a, d) => (d.total > a.total ? d : a), days[0]);
  const label = `Daily enquiries, stacked by channel. ${total} in total across ${n} days; busiest day ${peak?.day ?? ''} with ${peak?.total ?? 0}.`;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        <span className="absolute -top-2 left-0 font-mono text-[10px] text-mute">{ceil}</span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className="h-full w-full pl-5">
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={0} x2={W} y1={H - f * H} y2={H - f * H} stroke="rgb(var(--line))" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {days.map((d, i) => {
            let y = H;
            return (
              <g key={d.day}>
                <title>{`${d.day}: ${d.total} enquiries (phone ${d.phone}, WhatsApp ${d.whatsapp}, web form ${d.web_form})`}</title>
                {SERIES.map((s) => {
                  const v = d[s.key];
                  if (!v) return null;
                  const h = (v / ceil) * H;
                  y -= h;
                  return <rect key={s.key} x={i * 10 + 1.5} y={y} width={7} height={h} fill={s.fill} stroke="rgb(var(--panel))" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid pl-5 pt-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
        {days.map((d, i) => (
          <span key={d.day} className="whitespace-nowrap font-mono text-[10px] text-mute">
            {i === 0 || (i + 1) % 5 === 0 ? Number(d.day.slice(8)) : ''}
          </span>
        ))}
      </div>
      <figcaption className="mt-3"><ChannelLegend /></figcaption>
    </figure>
  );
}

// ---- Horizontal distribution list ----------------------------------------------------------------

export interface DistItem { label: string; n: number; tone?: Tone; sub?: ReactNode }

/** Label · bar · count · share. Bars are scaled to the largest item (or `total` if given). */
export function DistributionList({ items, total, scale = 'max', empty = 'Nothing recorded yet.' }: { items: DistItem[]; total?: number; scale?: 'max' | 'total'; empty?: string }) {
  const sumN = total ?? items.reduce((a, i) => a + i.n, 0);
  const max = scale === 'total' ? sumN : Math.max(1, ...items.map((i) => i.n));
  if (sumN === 0) return <p className="text-sm text-mute">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-bone">{it.label}</span>
            <span className="mono text-sm text-bone">
              {it.n}
              <span className="ml-2 text-xs text-mute">{pctText(it.n / sumN)}</span>
            </span>
          </div>
          <div className="mt-1"><Bar value={it.n} max={max} tone={it.tone ?? 'accent'} height={8} label={`${it.label}: ${it.n} of ${sumN}`} /></div>
          {it.sub && <div className="mt-1 text-xs text-mute">{it.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

// ---- Segmented bar (parts of a whole) ------------------------------------------------------------

export interface Segment { label: string; n: number; tone: Tone }

/** One bar split into labelled segments, with a legend that carries the counts (not colour alone). */
export function SegmentedBar({ segments, height = 18 }: { segments: Segment[]; height?: number }) {
  const total = segments.reduce((a, s) => a + s.n, 0);
  if (total === 0) return <p className="text-sm text-mute">Nothing recorded yet.</p>;
  const label = segments.map((s) => `${s.label} ${s.n}`).join(', ') + `; total ${total}`;
  return (
    <div>
      <div className="flex w-full gap-px bg-line" style={{ height }} role="img" aria-label={label}>
        {segments.filter((s) => s.n > 0).map((s) => (
          <div key={s.label} className={TONE_BG[s.tone]} style={{ width: `${(s.n / total) * 100}%` }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
        {segments.map((s) => (
          <li key={s.label} className="flex items-start gap-2">
            <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 ${TONE_BG[s.tone]}`} aria-hidden />
            <span>
              <span className="num block text-xl leading-none">{s.n}</span>
              <span className="label block pt-1">{s.label} · {pctText(s.n / total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Funnel --------------------------------------------------------------------------------------

/** Horizontal funnel. Each step shows its count and the conversion from the step above. */
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const top = Math.max(1, steps[0]?.n ?? 0);
  return (
    <ol className="space-y-px border border-line bg-line" aria-label="Funnel from enquiry to won project">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].n : null;
        const step = prev !== null && prev > 0 ? s.n / prev : null;
        const widthPct = Math.max(s.n > 0 ? 1.5 : 0, (s.n / top) * 100);
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 bg-panel px-4 py-2.5 sm:grid-cols-[11rem_1fr_9rem]">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-sm font-medium text-bone">{s.label}</span>
            </div>
            <div className="order-3 col-span-2 sm:order-none sm:col-span-1" role="img" aria-label={`${s.label}: ${s.n} (${pctText(s.n / top)} of enquiries)`}>
              <div className="h-5 w-full bg-line/50">
                <div className={`h-full ${last ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
            <div className="text-right">
              <span className="num text-2xl leading-none">{s.n}</span>
              <span className="mono ml-2 text-xs text-mute">{i === 0 ? 'start' : step === null ? '—' : `${pctText(step)} of prev`}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
