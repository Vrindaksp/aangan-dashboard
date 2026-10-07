// Enquiry Live Stream + Transcription Inspector: the designers' main working screen. Designer-only.

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ViewCtx } from '@/components/types';
import { Badge, ConfidenceMeter, Empty, SectionHead, channelLabel, qualLabel, qualTone } from '@/components/ui';
import { GUARDRAILS } from '@/lib/config';
import { formatDateTime, formatDuration, pct } from '@/lib/format';
import { effectiveQualification, monthKey, monthLabel } from '@/lib/metrics';
import type { Channel, EnquiryRow } from '@/lib/types';
import { href } from '@/lib/url';
import { Inspector } from './Inspector';

const MAX_ROWS = 80;

type StatusFilter = 'all' | 'action' | 'qualified' | 'declined' | 'norespons';
const STATUS_CHIPS: { key: StatusFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Every enquiry this month' },
  { key: 'action', label: 'Needs a human', hint: 'AI sent to review with no final decision, or an open escalation' },
  { key: 'qualified', label: 'Qualified', hint: 'The decision that counts is qualified' },
  { key: 'declined', label: 'Declined', hint: 'The decision that counts is declined' },
  { key: 'norespons', label: 'No response', hint: 'Active lead with no first response recorded' },
];
const CHANNEL_CHIPS: { key: Channel; label: string }[] = [
  { key: 'phone', label: 'Phone' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'web_form', label: 'Web form' },
];

const STAR_FLAGS: Record<string, string> = { founder_connection: 'Founder', referral: 'Referral', large_project: 'Large' };

function isActiveLead(e: EnquiryRow): boolean {
  const eff = effectiveQualification(e);
  return (eff === 'qualified' || eff === 'review') && ['new', 'escalated', 'handed_off'].includes(e.status);
}

function Chip({ href: to, active, children, title }: { href: string; active: boolean; children: ReactNode; title?: string }) {
  return (
    <Link
      href={to}
      title={title}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${active ? 'border-accent bg-accent text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
    >
      {children}
    </Link>
  );
}

function ResponseChip({ e, active }: { e: EnquiryRow; active: boolean }) {
  if (e.first_response_at) {
    const mins = (new Date(e.first_response_at).getTime() - new Date(e.received_at).getTime()) / 60_000;
    return <Badge tone={mins <= GUARDRAILS.fastResponseMinutes ? 'ok' : 'neutral'} title="Time to first response">Replied in {formatDuration(Math.max(0, mins))}</Badge>;
  }
  if (e.channel === 'web_form') return <Badge title="Web-form response times were never logged">Reply not recorded</Badge>;
  if (active) return <Badge tone="warn">No reply yet</Badge>;
  return null;
}

export async function Queue({ ctx }: { ctx: ViewCtx }) {
  if (ctx.role !== 'designer') return <Empty>The enquiry desk is for designers only.</Empty>;
  const { sp } = ctx;

  // ---- base set: this month, respecting the synthetic toggle, newest first ----
  const month = ctx.ds.enquiries
    .filter((e) => monthKey(e.received_at) === ctx.month && (ctx.includeSynthetic || !e.is_synthetic))
    .sort((a, b) => b.received_at.localeCompare(a.received_at));

  const openEsc = new Map<string, number>();
  for (const x of ctx.ds.escalations) if (x.status !== 'resolved') openEsc.set(x.enquiry_id, (openEsc.get(x.enquiry_id) ?? 0) + 1);

  const f: StatusFilter = STATUS_CHIPS.some((c) => c.key === sp.f) ? (sp.f as StatusFilter) : 'all';
  const ch = CHANNEL_CHIPS.find((c) => c.key === sp.ch)?.key ?? null;
  const q = (sp.q ?? '').trim();
  const ql = q.toLowerCase();

  const matchesStatus = (e: EnquiryRow, key: StatusFilter): boolean => {
    switch (key) {
      case 'action': return (e.ai_qualification === 'review' && !e.final_qualification) || (openEsc.get(e.id) ?? 0) > 0;
      case 'qualified': return effectiveQualification(e) === 'qualified';
      case 'declined': return effectiveQualification(e) === 'unqualified';
      case 'norespons': return !e.first_response_at && isActiveLead(e);
      default: return true;
    }
  };
  const matchesChannel = (e: EnquiryRow) => !ch || e.channel === ch;
  const matchesQuery = (e: EnquiryRow) =>
    !ql || [e.client_name, e.location, e.source_ref].some((v) => v?.toLowerCase().includes(ql));

  const statusCounts = Object.fromEntries(STATUS_CHIPS.map((c) => [c.key, month.filter((e) => matchesChannel(e) && matchesQuery(e) && matchesStatus(e, c.key)).length])) as Record<StatusFilter, number>;
  const channelCounts = Object.fromEntries(CHANNEL_CHIPS.map((c) => [c.key, month.filter((e) => e.channel === c.key && matchesQuery(e) && matchesStatus(e, f)).length])) as Record<Channel, number>;
  const channelAll = month.filter((e) => matchesQuery(e) && matchesStatus(e, f)).length;

  const rows = month.filter((e) => matchesStatus(e, f) && matchesChannel(e) && matchesQuery(e));
  const shown = rows.slice(0, MAX_ROWS);

  const selected = sp.enquiry ? ctx.ds.enquiries.find((e) => e.id === sp.enquiry) ?? null : null;
  const base = { view: 'queue' as const, slot: null, sd: null, email: null, ed: null, cb: null, eq: null, en: null };
  const to = (patch: Record<string, string | null>) => href(sp, { ...patch });

  // Hidden inputs so the GET search form keeps month / filters / selection.
  const keep = Object.entries(sp).filter(([k, v]) => v !== undefined && !['q', 'msg', 'ok', 'slot', 'sd', 'email', 'ed', 'cb', 'eq', 'en'].includes(k)) as [string, string][];

  const list = (
    <div className="min-w-0">
      <SectionHead
        index="01"
        title="Live stream"
        note={`${monthLabel(ctx.month)} · newest first · ${rows.length} of ${month.length} enquiries`}
      />

      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {STATUS_CHIPS.map((c) => (
            <Chip key={c.key} href={to({ f: c.key === 'all' ? null : c.key })} active={f === c.key} title={c.hint}>
              {c.label} <span className="opacity-80">{statusCounts[c.key]}</span>
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by channel">
          <Chip href={to({ ch: null })} active={!ch}>Any channel <span className="opacity-80">{channelAll}</span></Chip>
          {CHANNEL_CHIPS.map((c) => (
            <Chip key={c.key} href={to({ ch: c.key })} active={ch === c.key}>{c.label} <span className="opacity-80">{channelCounts[c.key]}</span></Chip>
          ))}
        </div>
        <form action="/" method="get" role="search" className="flex gap-2">
          {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label htmlFor="q" className="sr-only">Search by name, location or reference</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search name, location or ref (e.g. T07)" className="field" />
          <button type="submit" className="btn">Search</button>
          {q && <Link href={to({ q: null })} className="btn-ghost">Clear</Link>}
        </form>
      </div>

      {shown.length === 0 ? (
        <Empty>No enquiries match these filters{q ? ` for "${q}"` : ''}.</Empty>
      ) : (
        <ul className={`space-y-1.5 ${selected ? '' : 'xl:grid xl:grid-cols-2 xl:gap-1.5 xl:space-y-0'}`}>
          {shown.map((e) => {
            const on = e.id === selected?.id;
            const eff = effectiveQualification(e);
            const escN = openEsc.get(e.id) ?? 0;
            const stars = e.priority_flags.filter((p) => p in STAR_FLAGS);
            const conf = e.composite_confidence;
            return (
              <li key={e.id}>
                <Link
                  href={to({ ...base, enquiry: e.id })}
                  aria-current={on ? 'true' : undefined}
                  className={`block border p-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${on ? 'border-accent bg-raised' : 'border-line bg-panel hover:border-bone/60 hover:bg-raised'}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="mono text-xs text-mute">{e.source_ref ?? e.id.slice(0, 8)} · {formatDateTime(e.received_at)}</span>
                    {stars.length > 0 && (
                      <span className="flex gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent" title="Priority flags">
                        {stars.map((s) => <span key={s}>★ {STAR_FLAGS[s]}</span>)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-base font-bold">{e.client_name ?? <span className="text-mute">Unnamed</span>}</span>
                    <span className="text-xs text-mute">{e.location ?? 'location unknown'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge>{channelLabel(e.channel)}</Badge>
                    <Badge tone={qualTone(e.ai_qualification)} title="AI's call">{qualLabel(e.ai_qualification)}</Badge>
                    {e.final_qualification && e.final_qualification !== e.ai_qualification && (
                      <Badge tone={qualTone(eff)} title="The human's final decision">Final: {qualLabel(e.final_qualification)}</Badge>
                    )}
                    {conf !== null && (
                      <span className="flex items-center gap-1.5" title="Composite confidence vs the gate">
                        <ConfidenceMeter value={conf} threshold={GUARDRAILS.confidenceMin} label={false} />
                        <span className={`mono text-[11px] ${conf >= GUARDRAILS.confidenceMin ? 'text-mute' : 'text-crit'}`}>{pct(conf)}{conf < GUARDRAILS.confidenceMin ? ' held' : ''}</span>
                      </span>
                    )}
                    <ResponseChip e={e} active={isActiveLead(e)} />
                    {e.after_hours && <Badge tone="warn">After hours</Badge>}
                    {escN > 0 && <Badge tone="crit">{escN} escalation{escN === 1 ? '' : 's'}</Badge>}
                    {e.is_synthetic && <Badge tone="info">Synthetic</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > MAX_ROWS && (
        <p className="mt-2 text-xs text-mute">Showing the newest {MAX_ROWS} of {rows.length}. Narrow the filters or search to see the rest.</p>
      )}
    </div>
  );

  if (!selected) {
    return (
      <div>
        {sp.enquiry && <p className="mb-3 border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">That enquiry could not be found. Pick one from the list.</p>}
        <p className="mb-4 border border-dashed border-line px-3 py-2 text-sm text-mute">
          Pick an enquiry to open the inspector: transcript, confidence, rubric, escalations, brief, consultation and client email.
        </p>
        {list}
      </div>
    );
  }

  const outsideMonth = monthKey(selected.received_at) !== ctx.month;
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-5">{list}</div>
      <div className="min-w-0 lg:sticky lg:top-3 lg:col-span-7 lg:max-h-[calc(100vh-1.5rem)] lg:self-start lg:overflow-y-auto scroll-thin" id="inspector">
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionHead index="02" title="Inspector" />
          <Link href={to({ ...base, enquiry: null })} className="btn-ghost mb-3 shrink-0">Close</Link>
        </div>
        {outsideMonth && (
          <p className="mb-3 border border-info/50 bg-info/10 px-3 py-2 text-xs text-bone">
            This enquiry is from {monthLabel(monthKey(selected.received_at))}, outside the month shown in the list.
          </p>
        )}
        <Inspector ctx={ctx} e={selected} />
      </div>
    </div>
  );
}
