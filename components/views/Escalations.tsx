// Escalation & Guardrail Audit — designer-only.
// Open items are global (a held lead stays held whatever month it arrived); the resolved audit log is scoped to the
// selected month, using the same rule as lib/metrics.ts (the month the ENQUIRY was received).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { acknowledgeEscalationAction, resolveEscalationAction } from '@/app/actions';
import { GUARDRAILS } from '@/lib/config';
import { classifyOverride, type OverrideClass } from '@/lib/guardrails';
import { formatDateTime, formatDuration, formatLakhCr, pct, titleCase } from '@/lib/format';
import { monthKey } from '@/lib/metrics';
import { href } from '@/lib/url';
import type { AssignedTo, EnquiryRow, EscalationKind, EscalationRow, EscalationTrigger, Severity } from '@/lib/types';
import { Badge, ConfidenceMeter, Empty, Kpi, Panel, qualLabel, qualTone, ReturnTo, SectionHead, severityTone, channelLabel, type Tone } from '../ui';
import type { ViewCtx } from '../types';

// ---------------------------------------------------------------------------------------------- vocab

const OVERDUE_MINUTES = 24 * 60;
const LOG_CAP = 100;

const GUARDRAIL_NAME: Record<EscalationTrigger, string> = {
  low_confidence: 'Confidence gate (<85%)',
  ambiguous_scope: 'Ambiguous core parameter',
  ambiguous_location: 'Ambiguous core parameter',
  ai_failure: 'AI processing failed',
  needs_clarification: 'Gray-area lead — ask one question',
  high_value_fringe: 'High-value fringe lead',
  audit_sample: 'Random audit of a decline',
  budget_below_minimum: 'Budget clearly below minimum',
  custom_work: 'Custom / complex work',
  agent_policy_breach: 'Studio side quoted a price',
  existing_client_complaint: 'Existing client complaint',
  response_sla_breach: 'Response SLA breached',
  missed_call: 'Missed call',
};
// The "<85%" in the label is static copy; show the live threshold instead.
const guardrailName = (t: EscalationTrigger): string =>
  t === 'low_confidence' ? `Confidence gate (<${pct(GUARDRAILS.confidenceMin)})` : GUARDRAIL_NAME[t] ?? titleCase(t);

/** Failure-mode family from the brief: A confidence, B gray area, C pricing, R service recovery. */
const FAMILY: Record<EscalationTrigger, string> = {
  low_confidence: 'A', ambiguous_scope: 'A', ambiguous_location: 'A', ai_failure: 'A',
  needs_clarification: 'B', high_value_fringe: 'B', audit_sample: 'B',
  budget_below_minimum: 'C', custom_work: 'C', agent_policy_breach: 'C',
  existing_client_complaint: 'R', response_sla_breach: 'R', missed_call: 'R',
};

const KIND_LABEL: Record<EscalationKind, string> = {
  transcription: 'Transcription', lead_qualification: 'Lead qualification', pricing: 'Pricing', service_recovery: 'Service recovery',
};
const KINDS = Object.keys(KIND_LABEL) as EscalationKind[];
const OWNER_LABEL: Record<AssignedTo, string> = { front_desk: 'Front desk', founder: 'Founder', senior_designer: 'Senior designer' };
const OWNERS = Object.keys(OWNER_LABEL) as AssignedTo[];
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const RESOLUTION_LABEL: Record<string, string> = { qualified: 'Qualified', unqualified: 'Rejected', approved_ai: 'AI call approved', dismissed: 'Dismissed' };

const OVERRIDE_CHIP: Record<OverrideClass, { tone: Tone; label: string; title: string }> = {
  confirmed: { tone: 'ok', label: 'Confirmed', title: 'A human agreed with the AI' },
  false_positive: { tone: 'crit', label: 'False positive', title: 'AI said qualified, a human said no — wasted designer time' },
  false_negative: { tone: 'crit', label: 'False negative', title: 'AI said decline, a human said qualified — a lost lead' },
  gray_to_qualified: { tone: 'info', label: 'Gray → qualified', title: 'Review queue rescued a lead the AI was unsure about' },
  gray_to_unqualified: { tone: 'neutral', label: 'Gray → declined', title: 'Review queue declined a lead the AI was unsure about' },
};

type Status = 'open' | 'resolved' | 'all';
const minutesSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 60_000;
const enquiryName = (e: EnquiryRow) => e.client_name ?? e.source_ref ?? `Enquiry ${e.id.slice(0, 6)}`;
const isKind = (v: string | undefined): v is EscalationKind => KINDS.includes(v as EscalationKind);
const isOwner = (v: string | undefined): v is AssignedTo => OWNERS.includes(v as AssignedTo);

// ---------------------------------------------------------------------------------------------- view

export function Escalations({ ctx }: { ctx: ViewCtx }) {
  const { ds, m, sp, now, month } = ctx;
  const byId = new Map(ds.enquiries.filter((e) => ctx.includeSynthetic || !e.is_synthetic).map((e) => [e.id, e]));
  const visible = ds.escalations.filter((x) => byId.has(x.enquiry_id));

  const st: Status = sp.st === 'resolved' || sp.st === 'all' ? sp.st : 'open';
  const kind = isKind(sp.kind) ? sp.kind : null;
  const owner = isOwner(sp.owner) ? sp.owner : null;

  const openAll = visible.filter((x) => x.status !== 'resolved');
  const resolvedAll = visible.filter((x) => x.status === 'resolved' && x.resolved_at && monthKey(byId.get(x.enquiry_id)!.received_at) === month);

  // Facet counts respect the other facet, so a chip's number is what you get when you click it.
  const pool = st === 'resolved' ? resolvedAll : st === 'all' ? [...openAll, ...resolvedAll] : openAll;
  const kindCount = (k: EscalationKind) => pool.filter((x) => x.kind === k && (!owner || x.assigned_to === owner)).length;
  const ownerCount = (o: AssignedTo) => pool.filter((x) => x.assigned_to === o && (!kind || x.kind === kind)).length;
  const passes = (x: EscalationRow) => (!kind || x.kind === kind) && (!owner || x.assigned_to === owner);

  const openRows = openAll.filter(passes).sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const logRows = resolvedAll.filter(passes).sort((a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime());

  const q = m.qualification;
  const e = m.escalations;
  const link = (patch: Record<string, string | null>) => href(sp, patch);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ 01 KPIs */}
      <section>
        <SectionHead
          index="01"
          title="Escalation & guardrail audit"
          note="Every case the guardrails held back from a designer, who owns it, how long it has waited, and how often the AI turned out to be wrong."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Open now" value={e.open + e.acknowledged} hot sub={`${e.open} unacknowledged · ${e.acknowledged} acknowledged`} />
          <Kpi label={`Overdue >${OVERDUE_MINUTES / 60}h`} value={e.openOver24h} tone={e.openOver24h > 0 ? 'crit' : 'neutral'} sub={e.openOver24h > 0 ? 'Work these first' : 'Nothing overdue'} />
          <Kpi label="Median resolution" value={formatDuration(e.medianResolutionMinutes)} sub={e.medianResolutionMinutes === null ? `None resolved in ${m.monthLabel}` : `${e.resolved} resolved in ${m.monthLabel}`} />
          <Kpi label="Oldest open" value={formatDuration(e.oldestOpenMinutes)} sub={e.oldestOpenMinutes === null ? 'Queue is clear' : 'Waiting since creation'} />
          <Kpi
            label="False-positive rate"
            value={q.fpRate === null ? '—' : pct(q.fpRate)}
            sub={q.fpRate === null ? 'No AI-qualified leads yet' : `${q.falsePositives} of ${q.counts.qualified} AI-qualified`}
          />
          <Kpi
            label="False-negative rate"
            value={q.fnRate === null ? '—' : pct(q.fnRate)}
            tone={q.fnRate !== null && q.fnRate > 0 ? 'warn' : 'neutral'}
            sub={q.fnRate === null ? 'No audited declines resolved yet' : `${q.falseNegatives} of ${q.fnAudited} audited declines (n=${q.fnAudited})`}
          />
          <Kpi label="Gray-area rescued" value={q.grayRescued} tone={q.grayRescued > 0 ? 'ok' : 'neutral'} sub={`${q.grayDeclined} declined after review`} />
        </div>
      </section>

      {/* ------------------------------------------------------------------ filters */}
      <nav aria-label="Escalation filters" className="space-y-3 border border-line bg-panel p-3">
        <FilterRow label="Show">
          <Chip href={link({ st: null })} active={st === 'open'}>Open <Count n={openAll.filter(passes).length} /></Chip>
          <Chip href={link({ st: 'resolved' })} active={st === 'resolved'}>Resolved · {m.monthLabel} <Count n={resolvedAll.filter(passes).length} /></Chip>
          <Chip href={link({ st: 'all' })} active={st === 'all'}>All <Count n={openAll.filter(passes).length + resolvedAll.filter(passes).length} /></Chip>
        </FilterRow>
        <FilterRow label="Kind">
          <Chip href={link({ kind: null })} active={!kind}>Any</Chip>
          {KINDS.map((k) => (
            <Chip key={k} href={link({ kind: k })} active={kind === k}>{KIND_LABEL[k]} <Count n={kindCount(k)} /></Chip>
          ))}
        </FilterRow>
        <FilterRow label="Owner">
          <Chip href={link({ owner: null })} active={!owner}>Anyone</Chip>
          {OWNERS.map((o) => (
            <Chip key={o} href={link({ owner: o })} active={owner === o}>{OWNER_LABEL[o]} <Count n={ownerCount(o)} /></Chip>
          ))}
        </FilterRow>
      </nav>

      {/* ------------------------------------------------------------------ 02 open queue */}
      {st !== 'resolved' && (
        <section aria-labelledby="open-queue">
          <SectionHead
            index="02"
            title="Open queue"
            note="Most severe first, then oldest first. Open items are not limited to the selected month."
            right={<span id="open-queue" className="label">{openRows.length} shown</span>}
          />
          {openRows.length === 0 ? (
            openAll.length === 0 ? <QueueClear /> : <Empty>No open escalations match these filters. <Link className="text-accent underline" href={link({ kind: null, owner: null })}>Clear filters</Link></Empty>
          ) : (
            <ul className="space-y-3">
              {openRows.map((x) => (
                <li key={x.id}>
                  <EscalationCard esc={x} enquiry={byId.get(x.enquiry_id)!} ctx={ctx} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ 03 resolved log */}
      {st !== 'open' && (
        <section aria-labelledby="audit-log">
          <SectionHead
            index={st === 'all' ? '03' : '02'}
            title={`Resolved audit log · ${m.monthLabel}`}
            note="Scoped to enquiries received in the selected month. The chip on the right is what the human decision meant for the AI's call."
            right={<span id="audit-log" className="label">{logRows.length} resolved</span>}
          />
          {logRows.length === 0 ? (
            <Empty>Nothing resolved in {m.monthLabel} yet{kind || owner ? ' for these filters' : ''}. Resolutions you record in the open queue appear here with their latency and override class.</Empty>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="th">Resolved</th>
                    <th scope="col" className="th">Latency</th>
                    <th scope="col" className="th">Guardrail</th>
                    <th scope="col" className="th">Owner</th>
                    <th scope="col" className="th">Resolution</th>
                    <th scope="col" className="th">By</th>
                    <th scope="col" className="th">Note</th>
                    <th scope="col" className="th">Enquiry</th>
                    <th scope="col" className="th">Override class</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.slice(0, LOG_CAP).map((x) => {
                    const enq = byId.get(x.enquiry_id)!;
                    const cls = classifyOverride(enq);
                    const chip = cls ? OVERRIDE_CHIP[cls] : null;
                    return (
                      <tr key={x.id} className="hover:bg-raised">
                        <td className="td mono whitespace-nowrap text-xs">{formatDateTime(x.resolved_at)}</td>
                        <td className="td mono whitespace-nowrap text-xs">{formatDuration(minutesSince(x.created_at, new Date(x.resolved_at!)))}</td>
                        <td className="td">
                          <div className="font-medium">{guardrailName(x.trigger)}</div>
                          <div className="label mt-0.5">{KIND_LABEL[x.kind]}</div>
                        </td>
                        <td className="td text-mute">{OWNER_LABEL[x.assigned_to]}</td>
                        <td className="td"><Badge tone={x.resolution === 'dismissed' ? 'neutral' : 'accent'}>{x.resolution ? RESOLUTION_LABEL[x.resolution] ?? titleCase(x.resolution) : '—'}</Badge></td>
                        <td className="td text-mute">{x.resolved_by ?? '—'}</td>
                        <td className="td max-w-[18rem] text-mute">{x.resolution_note || '—'}</td>
                        <td className="td"><Link className="underline decoration-line underline-offset-2 hover:text-accent" href={href(sp, { view: 'queue', enquiry: enq.id })}>{enquiryName(enq)}</Link></td>
                        <td className="td">{chip ? <Badge tone={chip.tone} title={chip.title}>{chip.label}</Badge> : <span className="text-mute">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {logRows.length > LOG_CAP && <p className="border-t border-line px-3 py-2 text-xs text-mute">Showing the latest {LOG_CAP} of {logRows.length} resolved items.</p>}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ rules + how to read */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHead index={st === 'all' ? '04' : '03'} title="Guardrail rules in force" note="Live thresholds from configuration. Change them with the environment variables noted in lib/config.ts." />
          <RulesPanel />
        </section>
        <section>
          <SectionHead index={st === 'all' ? '05' : '04'} title="How to read the override rates" />
          <RatesPanel ctx={ctx} />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- pieces

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label w-12 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Chip({ href: to, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${active ? 'border-bone bg-bone text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
    >
      {children}
    </Link>
  );
}

const Count = ({ n }: { n: number }) => <span className="tabular-nums opacity-80">({n})</span>;

function QueueClear() {
  return (
    <div className="panel border-ok/50 px-6 py-10 text-center">
      <div className="num text-4xl text-ok">Queue clear</div>
      <p className="mx-auto mt-3 max-w-md text-sm text-mute">
        Nothing is waiting on a human. New low-confidence transcripts, gray-area leads, audits and service-recovery cases will appear here the moment the guardrails catch them.
      </p>
    </div>
  );
}

function EscalationCard({ esc, enquiry, ctx }: { esc: EscalationRow; enquiry: EnquiryRow; ctx: ViewCtx }) {
  const age = minutesSince(esc.created_at, ctx.now);
  const overdue = age > OVERDUE_MINUTES;
  const final = enquiry.final_qualification;
  const hot = esc.severity === 'critical' || esc.severity === 'high';
  return (
    <article className={`${hot ? 'panel-hot' : 'panel'} grid lg:grid-cols-[minmax(0,1fr)_22rem]`} aria-label={`${guardrailName(esc.trigger)} — ${enquiryName(enquiry)}`}>
      <div className="min-w-0 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={severityTone(esc.severity)}>{esc.severity}</Badge>
          <h4 className="font-display text-base font-bold uppercase tracking-wide">{guardrailName(esc.trigger)}</h4>
          <Badge title="Failure-mode family: A confidence · B gray area · C pricing · R service recovery">{FAMILY[esc.trigger]} · {KIND_LABEL[esc.kind]}</Badge>
          {esc.status === 'acknowledged' && <Badge tone="info">Acknowledged</Badge>}
          {overdue && <Badge tone="crit">Overdue · {formatDuration(age)}</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link href={href(ctx.sp, { view: 'queue', enquiry: enquiry.id })} className="font-medium underline decoration-line underline-offset-2 hover:text-accent">
            {enquiryName(enquiry)}
          </Link>
          <span className="text-mute">{channelLabel(enquiry.channel)}</span>
          <span className="text-mute">{enquiry.location ?? 'Location not stated'}</span>
          {enquiry.source_ref && enquiry.client_name && <span className="mono text-xs text-dim">{enquiry.source_ref}</span>}
        </div>

        <p className="text-sm text-bone">{esc.reason}</p>

        {esc.suggested_question && (
          <div>
            <div className="label mb-1">Ask the client — one question</div>
            <div className="select-all border border-accent/50 bg-raised px-3 py-2 text-sm leading-snug">{esc.suggested_question}</div>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-xs sm:grid-cols-4">
          <Meta label="AI call">
            <Badge tone={qualTone(enquiry.ai_qualification)}>{qualLabel(enquiry.ai_qualification)}</Badge>
            {final && <span className="ml-1.5 text-mute">→ <Badge tone={qualTone(final)}>{qualLabel(final)}</Badge></span>}
          </Meta>
          <Meta label="Age">
            <span className={`mono ${overdue ? 'text-crit' : ''}`}>{formatDuration(age)}</span>
            <span className="ml-1.5 text-mute">since {formatDateTime(esc.created_at)}</span>
          </Meta>
          <Meta label="Owner">{OWNER_LABEL[esc.assigned_to]}</Meta>
          <Meta label="Alerts sent">{esc.notified_via.length ? esc.notified_via.map(titleCase).join(', ') : <span className="text-warn">None sent</span>}</Meta>
        </dl>
        {esc.kind === 'transcription' && enquiry.composite_confidence !== null && (
          <ConfidenceMeter value={enquiry.composite_confidence} threshold={GUARDRAILS.confidenceMin} />
        )}
      </div>

      <div className="space-y-3 border-t border-line bg-ink/40 p-4 lg:border-l lg:border-t-0">
        <ResolveForm esc={esc} enquiry={enquiry} returnTo={ctx.returnTo} enquiryHref={href(ctx.sp, { view: 'queue', enquiry: enquiry.id })} />
        {esc.status === 'open' && (
          <form action={acknowledgeEscalationAction} className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <ReturnTo value={ctx.returnTo} />
            <input type="hidden" name="escalation_id" value={esc.id} />
            <span className="text-xs text-mute">Seen it, working on it?</span>
            <button type="submit" className="btn-ghost">Acknowledge</button>
          </form>
        )}
      </div>
    </article>
  );
}

const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="label mb-0.5">{label}</dt>
    <dd>{children}</dd>
  </div>
);

function ResolveForm({ esc, enquiry, returnTo, enquiryHref }: { esc: EscalationRow; enquiry: EnquiryRow; returnTo: string; enquiryHref: string }) {
  const recovery = esc.kind === 'service_recovery';
  const audit = esc.trigger === 'audit_sample';
  const ai = enquiry.ai_qualification;
  const canApprove = ai === 'qualified' || ai === 'unqualified';
  const approveFirst = ai === 'qualified';
  const noteId = `note-${esc.id}`;

  return (
    <form action={resolveEscalationAction} className="space-y-2.5">
      <ReturnTo value={returnTo} />
      <input type="hidden" name="escalation_id" value={esc.id} />
      <div>
        <label htmlFor={noteId} className="label mb-1 block">{recovery ? 'How was it handled?' : 'Note (kept in the audit log)'}</label>
        <input id={noteId} name="note" type="text" maxLength={500} className="field" placeholder={recovery ? 'e.g. Called back, apologised' : 'Why this call? (optional)'} />
      </div>
      <div className="flex flex-wrap gap-2">
        {recovery ? (
          <>
            <button type="submit" name="decision" value="dismiss" className="btn-solid">Dismiss — handled</button>
            <Link href={enquiryHref} className="btn-ghost">Open enquiry</Link>
          </>
        ) : audit ? (
          <>
            {canApprove && <button type="submit" name="decision" value="approve_ai" className="btn-solid">Decline was right</button>}
            <button type="submit" name="decision" value="qualify" className="btn">Wrong — this is a good lead</button>
          </>
        ) : (
          <>
            {approveFirst && <button type="submit" name="decision" value="approve_ai" className="btn-solid">Approve AI call</button>}
            <button type="submit" name="decision" value="qualify" className={approveFirst ? 'btn' : 'btn-solid'}>Qualify &amp; release to designer</button>
            <button type="submit" name="decision" value="reject" className="btn-danger">Reject lead</button>
            {canApprove && !approveFirst && <button type="submit" name="decision" value="approve_ai" className="btn">Approve AI call</button>}
            <button type="submit" name="decision" value="dismiss" className="btn-ghost">Dismiss — no change</button>
          </>
        )}
      </div>
      {audit && <p className="text-[11px] leading-snug text-mute">Audits measure the false-negative rate: only choose &ldquo;Decline was right&rdquo; if you would have declined it too.</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------------------------- reference panels

function Rule({ name, threshold, why }: { name: string; threshold?: ReactNode; why: string }) {
  return (
    <li className="grid gap-1 border-t border-line px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4">
      <div>
        <div className="text-sm font-medium">{name}</div>
        {threshold && <div className="mono mt-0.5 text-xs text-accent">{threshold}</div>}
      </div>
      <p className="text-xs leading-relaxed text-mute">{why}</p>
    </li>
  );
}

function RulesPanel() {
  const G = GUARDRAILS;
  return (
    <div className="space-y-3">
      <Panel title="A · Confidence gate — hold the brief" pad={false}>
        <ul>
          <Rule name="Confidence gate" threshold={`< ${pct(G.confidenceMin)} confidence`} why="A brief built on a shaky transcript wastes a designer's first call, so low-confidence enquiries are held for a human instead of being sent out." />
          <Rule name="Ambiguous core parameters" threshold="scope · location" why="If the scope or the location is unclear, the whole qualification can flip. The brief stays with the front desk until someone has confirmed it." />
          <Rule name="AI processing failed" why="If the model errors out, nothing is guessed — the raw enquiry is escalated for manual handling." />
        </ul>
      </Panel>
      <Panel title="B · Gray-area queue — never silently reject" pad={false}>
        <ul>
          <Rule name="Gray-area lead" threshold="unclear on a core criterion" why="A good lead is more expensive to lose than a poor one is to review, so uncertain cases get exactly one direct question rather than a decline." />
          <Rule name="High-value fringe" threshold={`budget ≥ ${formatLakhCr(G.highValueBudgetInr)} or ≥ ${G.highValueAreaSqft.toLocaleString('en-IN')} sq ft`} why={`A lead that fails only a practical criterion (service area, or timeline: under ${G.timelineFailWeeks} weeks fails, under ${G.timelineUnclearWeeks} is unclear) goes to review when it looks this valuable.`} />
          <Rule name="Random audit of declines" threshold={`${pct(G.auditSampleRate)} of auto-declines`} why="A sample of clear declines is looked at by a human, which is the only way to measure how many good leads the AI is rejecting." />
        </ul>
      </Panel>
      <Panel title="C · Pricing guardrails" pad={false}>
        <ul>
          <Rule name="Budget clearly below minimum" threshold={`top of range < ${pct(G.budgetClearlyBelowRatio)} of cheapest cost`} why="A budget is only judged when the client volunteers it — we never ask. Even then it only counts against a lead when it is clearly below the scope's cost." />
          <Rule name="Anchoring" why="Indicative ranges stay internal and are never quoted. A figure that could anchor the client's expectations is flagged for the designer." />
          <Rule name="Custom / complex work" why="Structural work, luxury specs, home automation, hospitality or oversize commercial need a designer's judgement before anyone talks numbers." />
          <Rule name="Studio side quoted a price" why="If the front desk or agent quoted a figure, a human must correct it before it becomes a commitment." />
        </ul>
      </Panel>
      <Panel title="Service recovery" pad={false}>
        <ul>
          <Rule name="Response SLA" threshold={`${G.slaBreachHours} h without a reply`} why="A live lead nobody has answered in this long is at risk, so it is raised with the front desk." />
          <Rule name="Complaints and missed calls" why="Existing-client complaints and missed calls need a person to call back — there is no qualify or reject decision, only a record that it was handled." />
        </ul>
      </Panel>
    </div>
  );
}

function RatesPanel({ ctx }: { ctx: ViewCtx }) {
  const q = ctx.m.qualification;
  return (
    <div className="space-y-3">
      <Panel title="False-positive rate — wasted designer time">
        <div className="flex items-baseline gap-3">
          <span className="num text-4xl">{q.fpRate === null ? '—' : pct(q.fpRate)}</span>
          <span className="mono text-xs text-mute">{q.fpRate === null ? 'No AI-qualified leads this month' : `${q.falsePositives} of ${q.counts.qualified} AI-qualified`}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-mute">AI-qualified leads that a human later flagged as bad. Each one cost a designer a brief and a call, so a high rate means the gate is too loose.</p>
      </Panel>
      <Panel title="False-negative rate — the costlier error">
        <div className="flex items-baseline gap-3">
          <span className="num text-4xl">{q.fnRate === null ? '—' : pct(q.fnRate)}</span>
          <span className="mono text-xs text-mute">{q.fnAudited === 0 ? 'No audited declines resolved yet' : `${q.falseNegatives} of ${q.fnAudited} audited declines`}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-mute">
          AI-declined leads a human rescued, measured only on declines someone actually looked at (the random audit plus manual rescues). Declines nobody reviewed are unknown, so a small sample means a wide margin.
          {q.estMissedGoodLeads !== null && <> Rough estimate of good leads lost this month: <span className="mono text-bone">{q.estMissedGoodLeads}</span>.</>}
        </p>
        {q.auditsOpen > 0 && <p className="mt-2 text-xs text-warn">{q.auditsOpen} audit{q.auditsOpen === 1 ? '' : 's'} still open — resolving them tightens this number.</p>}
      </Panel>
      <Panel title="Review outcomes this month">
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div><dt className="label">Confirmed</dt><dd className="num mt-1 text-2xl">{q.confirmed}</dd></div>
          <div><dt className="label">Gray → qualified</dt><dd className="num mt-1 text-2xl text-ok">{q.grayRescued}</dd></div>
          <div><dt className="label">Gray → declined</dt><dd className="num mt-1 text-2xl">{q.grayDeclined}</dd></div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-mute">Gray → qualified is the review queue earning its keep: leads the AI was unsure about that a human then took forward.</p>
      </Panel>
    </div>
  );
}
