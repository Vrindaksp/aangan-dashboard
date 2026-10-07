// Shared types + small helpers for the Enquiry Inspector panels (designer-only screen).

import type { ReactNode } from 'react';
import type { ViewCtx } from '@/components/types';
import type { DesignerRow, EnquiryRow, EscalationRow, PricingLogRow, TranscriptRow } from '@/lib/types';

/** Everything an inspector panel needs, fetched once in Inspector.tsx. */
export interface InspectorData {
  ctx: ViewCtx;
  e: EnquiryRow;
  tr: TranscriptRow | null;
  escs: EscalationRow[];
  pricing: PricingLogRow | null;
  designers: DesignerRow[];
}

export const designerLabel = (d: DesignerRow) => `${d.name}${d.is_sample ? ' (sample)' : ''}`;
export const isOpenEsc = (x: EscalationRow) => x.status !== 'resolved';

/** Mirrors the blocking rule in lib/workflow.ts (releaseHandoff) so the UI can explain why release is disabled. */
export function blockingEscalations(escs: EscalationRow[], e: Pick<EnquiryRow, 'final_qualification'>): EscalationRow[] {
  return escs.filter(
    (x) =>
      x.status !== 'resolved' &&
      (x.kind === 'transcription' || x.kind === 'lead_qualification' || (x.kind === 'pricing' && x.trigger !== 'agent_policy_breach') ||
        x.trigger === 'existing_client_complaint' || x.trigger === 'missed_call') &&
      (x.kind !== 'lead_qualification' || e.final_qualification !== 'qualified'),
  );
}

// ---- IST datetime-local helpers ------------------------------------------------------------------

const istFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Date -> 'YYYY-MM-DDTHH:mm' in IST, the value format of <input type="datetime-local">. */
export function istInput(d: Date): string {
  const p: Record<string, string> = {};
  for (const part of istFmt.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** 'YYYY-MM-DDTHH:mm' (IST) -> Date, or null if malformed. */
export function parseIstInput(v: string | undefined | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseIso(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---- tiny presentational bits --------------------------------------------------------------------

export function Field({ label, htmlFor, hint, children, className = '' }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label mb-1 block">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export function DesignerSelect({ id, name, designers, value, blankLabel }: { id: string; name: string; designers: DesignerRow[]; value: string | null | undefined; blankLabel: string }) {
  return (
    <select id={id} name={name} defaultValue={value ?? ''} className="field">
      <option value="">{blankLabel}</option>
      {designers.map((d) => (
        <option key={d.id} value={d.id}>{designerLabel(d)}</option>
      ))}
    </select>
  );
}

/** Small "key — value" row used in several panels. */
export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line/70 py-1.5 last:border-b-0">
      <dt className="label">{k}</dt>
      <dd className="mono text-right text-sm text-bone">{children}</dd>
    </div>
  );
}

/** Anchor target that leaves room for the sticky inspector header. */
export function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="scroll-mt-28">{children}</div>;
}
