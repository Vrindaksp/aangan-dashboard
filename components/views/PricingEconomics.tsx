// Pricing & unit-economics monitor. Shown to the founder AND designers.
// Aggregates are visible to both; the per-enquiry table and the internal rate card are designer-only.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Empty, Kpi, Panel, SectionHead, type Tone } from '../ui';
import { DistributionList, Stat, StatGrid } from '../charts';
import type { ViewCtx } from '../types';
import { RATE_CARD } from '@/lib/config';
import { formatInr, formatLakhCr, formatRange, pct, titleCase } from '@/lib/format';
import type { PricingRow } from '@/lib/metrics';
import { href } from '@/lib/url';
import type { BudgetFlag } from '@/lib/types';

const ROW_CAP = 60;

const FLAGS: { key: BudgetFlag; label: string; tone: Tone }[] = [
  { key: 'not_stated', label: 'Not stated', tone: 'neutral' },
  { key: 'within_range', label: 'Within range', tone: 'ok' },
  { key: 'below_range', label: 'Below range', tone: 'warn' },
  { key: 'below_minimum', label: 'Below minimum', tone: 'crit' },
  { key: 'above_range', label: 'Above range', tone: 'info' },
];
const flagMeta = (k: string) => FLAGS.find((f) => f.key === k) ?? { key: k, label: titleCase(k), tone: 'neutral' as Tone };

const multiple = (n: number | null) => (n === null ? '—' : `${n >= 100 ? Math.round(n) : n.toFixed(1)}×`);
const channelText = (c: string) => (c === 'web_form' ? 'Web form' : c === 'whatsapp' ? 'WhatsApp' : 'Phone');

export function PricingEconomics({ ctx }: { ctx: ViewCtx }) {
  const { m, role } = ctx;
  const { money, pricing: p } = m;
  const isDesigner = role === 'designer';
  const flagTotal = FLAGS.reduce((a, f) => a + (p.flagCounts[f.key] ?? 0), 0) + Object.entries(p.flagCounts).filter(([k]) => !FLAGS.some((f) => f.key === k)).reduce((a, [, n]) => a + n, 0);
  const basis = money.avgProjectBasis === 'won' ? 'Basis: won deals' : money.avgProjectBasis === 'estimate' ? 'Basis: pipeline estimates (no wins yet)' : 'No data yet';

  return (
    <div className="space-y-12">
      <div>
        <div className="label">Pricing &amp; unit economics · {m.monthLabel}</div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">Pricing monitor</h2>
        <div className="mt-3 border-2 border-accent bg-accent/10 px-4 py-3" role="note">
          <span className="mr-3 font-mono text-[11px] uppercase tracking-arch text-accent">Internal only</span>
          <span className="text-sm font-medium text-bone">
            Pricing is never quoted to clients. Everything below is an internal estimate for pipeline value and designer calibration.
          </span>
        </div>
        {m.syntheticCount > 0 && (
          <p className="mt-3 text-xs text-warn">Includes {m.syntheticCount} synthetic {m.syntheticCount === 1 ? 'row' : 'rows'}.</p>
        )}
      </div>

      {/* ---------------------------------------------------------------- KPIs */}
      <section aria-label="Headline numbers">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi hot label="Pipeline value" value={money.pipelineCount > 0 ? formatLakhCr(money.pipelineInr) : '—'} sub={money.pipelineCount > 0 ? `${money.pipelineCount} qualified, live · internal estimate` : 'No qualified live leads with an estimate'} />
          <Kpi hot label="Won revenue" value={money.wonCount > 0 ? formatLakhCr(money.wonInr) : '—'} sub={money.wonCount > 0 ? `${money.wonCount} won` : 'No outcomes logged yet'} />
          <Kpi label="Average project size" value={money.avgProjectInr !== null ? formatLakhCr(money.avgProjectInr) : '—'} sub={`${basis}. Computed from data, not assumed.`} />
          <Kpi label="System running cost" value={formatLakhCr(money.totalCostInr)} sub={`AI ${formatInr(money.aiVariableCostInr)} + fixed ${formatInr(money.fixedCostInr)}`} />
          <Kpi label="Cost per enquiry" value={formatInr(money.costPerEnquiryInr)} sub={`Across ${m.volume.total} ${m.volume.total === 1 ? 'enquiry' : 'enquiries'}`} />
          <Kpi label="Cost per qualified lead" value={formatInr(money.costPerQualifiedInr)} sub={m.funnel[2] ? `Across ${m.funnel[2].n} qualified` : undefined} />
          <Kpi label="Pipeline ÷ cost" value={multiple(money.pipelineMultiple)} sub="Pipeline value for every ₹1 of running cost" />
          <Kpi label="Won ÷ cost" value={multiple(money.wonMultiple)} sub={money.wonMultiple === null ? 'Needs won deals and logged costs' : 'Won revenue for every ₹1 of running cost'} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- 01 unit economics */}
      <section>
        <SectionHead index="01" title="Unit economics" note="What the enquiry system costs to run this month: AI usage (variable, per transcript) plus fixed tool subscriptions." />
        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th">Cost line</th>
                  <th scope="col" className="th">Vendor</th>
                  <th scope="col" className="th text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="td text-left font-normal">AI transcription &amp; extraction <span className="block text-xs text-mute">Variable — per transcript</span></th>
                  <td className="td text-mute">Gemini</td>
                  <td className="td mono text-right">{formatInr(money.aiVariableCostInr)}</td>
                </tr>
                {money.costLines.map((l, i) => (
                  <tr key={`${l.category}-${i}`}>
                    <th scope="row" className="td text-left font-normal">
                      {titleCase(l.category)}
                      {l.note && <span className="block text-xs text-mute">{l.note}</span>}
                    </th>
                    <td className="td text-mute">{l.vendor ?? '—'}</td>
                    <td className="td mono text-right">
                      {l.amount === 0 && <span className="mr-2"><Badge tone="warn">Placeholder</Badge></span>}
                      {formatInr(l.amount)}
                    </td>
                  </tr>
                ))}
                {money.costLines.length === 0 && (
                  <tr><td colSpan={3} className="td text-mute">No fixed cost lines recorded for this month.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className="border-t border-rule px-3 py-3 text-left font-mono text-[11px] uppercase tracking-arch text-bone">Total</th>
                  <td className="mono border-t border-rule px-3 py-3 text-right text-base font-bold">{formatInr(money.totalCostInr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
        <p className="mt-2 text-xs text-mute">
          Fixed-cost rows marked ₹0 (Vaani Labs, HubSpot) are placeholders and must be replaced with real invoice amounts before these ratios are relied on.
        </p>
      </section>

      {/* ---------------------------------------------------------------- 02 budget & anchoring */}
      <section>
        <SectionHead
          index="02"
          title="Budget &amp; anchoring guardrail"
          note="We never ask a client for a budget. When one is volunteered and sits below our indicative band, it is flagged so it does not become the anchor for the final price."
        />
        <div className="grid gap-3 lg:grid-cols-5">
          <Panel title="Volunteered budget vs indicative band" className="lg:col-span-3" right={<span className="mono text-xs text-mute">{flagTotal} priced</span>}>
            <DistributionList
              items={FLAGS.map((f) => ({ label: f.label, n: p.flagCounts[f.key] ?? 0, tone: f.tone }))}
              total={flagTotal}
              scale="max"
              empty="No enquiries have been priced this month."
            />
          </Panel>
          <div className="lg:col-span-2">
            <StatGrid className="grid-cols-2">
              <Stat label="Budget volunteered" value={p.statedBudgetCount} sub={flagTotal > 0 ? `Of ${flagTotal} priced. We never ask.` : 'We never ask'} />
              <Stat label="Anchor risk" value={p.anchorRisk} tone={p.anchorRisk > 0 ? 'crit' : 'ok'} sub="Low figure that could anchor" />
              <Stat label="Needs review" value={p.requiresReview} tone={p.requiresReview > 0 ? 'warn' : 'ok'} sub="Held for a designer's eye" />
              <Stat label="Formal estimates" value={p.formalEstimates} sub="Issued after consultation" />
            </StatGrid>
            <div className="mt-3 border border-line bg-panel p-4">
              <div className="label">Anchoring drift</div>
              {p.avgFinalVsIndicativeLow !== null ? (
                <p className="mt-1.5 text-sm text-bone">
                  Signed values land <span className="num text-xl text-accent">{p.avgFinalVsIndicativeLow.toFixed(2)}×</span> the initial indicative low
                  <span className="text-mute"> ({pct(p.avgFinalVsIndicativeLow - 1)} {p.avgFinalVsIndicativeLow >= 1 ? 'above' : 'below'}), averaged over won deals.</span>
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-mute">Needs won deals with a logged indicative range. No signed values yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- designer-only */}
      {isDesigner && (
        <>
          <section>
            <SectionHead
              index="03"
              title="Per-enquiry pricing"
              note="Internal indicative ranges for designer calibration. Do not quote any of these figures to a client."
              right={<Badge tone="accent">Designer only</Badge>}
            />
            <PricingTable rows={p.rows} sp={ctx.sp} />
          </section>

          <section>
            <SectionHead index="04" title="Internal rate card" note="Internal — carpet area of the designed space — never quote." right={<Badge tone="accent">Designer only</Badge>} />
            <RateCard />
          </section>
        </>
      )}
    </div>
  );
}

// ---- designer-only pieces -------------------------------------------------------------------------

function PricingTable({ rows, sp }: { rows: PricingRow[]; sp: ViewCtx['sp'] }) {
  if (rows.length === 0) return <Empty>No enquiries have been priced this month.</Empty>;
  // Anchor-risk first, then the biggest pipeline estimates.
  const sorted = [...rows].sort((a, b) => Number(b.log.anchor_risk) - Number(a.log.anchor_risk) || (b.log.pipeline_estimate_inr ?? 0) - (a.log.pipeline_estimate_inr ?? 0));
  const shown = sorted.slice(0, ROW_CAP);
  return (
    <div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className="th">Enquiry</th>
              <th scope="col" className="th">Channel</th>
              <th scope="col" className="th">Segment · area</th>
              <th scope="col" className="th">Indicative (internal)</th>
              <th scope="col" className="th text-right">Pipeline est.</th>
              <th scope="col" className="th">Volunteered budget</th>
              <th scope="col" className="th">Flag</th>
              <th scope="col" className="th text-right">Formal est.</th>
              <th scope="col" className="th text-right">Final value</th>
              <th scope="col" className="th text-right">Final vs est.</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ enquiryId, log, enquiry }) => {
              const flag = flagMeta(log.budget_flag);
              const budget = log.budget_low_inr === null && log.budget_high_inr === null ? null : formatRange(log.budget_low_inr, log.budget_high_inr);
              const area = log.area_sqft ?? enquiry.area_sqft;
              const final = enquiry.final_value_inr;
              const variance = final && log.pipeline_estimate_inr ? final / log.pipeline_estimate_inr - 1 : null;
              return (
                <tr key={log.id} className="hover:bg-raised">
                  <td className="td">
                    <Link href={href(sp, { view: 'queue', enquiry: enquiryId })} className="font-medium text-bone underline decoration-line underline-offset-4 hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                      {enquiry.client_name ?? enquiry.source_ref ?? enquiryId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="td text-mute">{channelText(enquiry.channel)}</td>
                  <td className="td">
                    {titleCase(log.segment)}
                    <span className="mono block text-xs text-mute">{area ? `${area.toLocaleString('en-IN')} sq ft` : 'area unknown'}</span>
                  </td>
                  <td className="td mono">{formatRange(log.indicative_low_inr, log.indicative_high_inr)}</td>
                  <td className="td mono text-right">{formatLakhCr(log.pipeline_estimate_inr)}</td>
                  <td className="td mono">{budget ?? <span className="text-mute">—</span>}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={flag.tone}>{flag.label}</Badge>
                      {log.anchor_risk && <Badge tone="crit" title="A volunteered figure below our band could become the anchor">Anchor risk</Badge>}
                      {log.requires_review && <Badge tone="warn">Review</Badge>}
                    </div>
                  </td>
                  <td className="td mono text-right">{formatLakhCr(log.formal_estimate_inr)}</td>
                  <td className="td mono text-right">{formatLakhCr(final)}</td>
                  <td className={`td mono text-right ${variance === null ? 'text-mute' : variance >= 0 ? 'text-ok' : 'text-warn'}`}>
                    {variance === null ? '—' : `${variance >= 0 ? '+' : ''}${pct(variance)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-mute">
        Showing {shown.length} of {rows.length}
        {rows.length > shown.length ? ` (anchor-risk first, then largest estimates)` : ''}. Indicative ranges and pipeline estimates are internal.
      </p>
    </div>
  );
}

function RateCard() {
  const perSqft = (r: { low: number; high: number }) => `${formatInr(r.low)} – ${formatInr(r.high)} / sq ft`;
  const groups: { title: string; rows: { label: string; value: ReactNode }[] }[] = [
    { title: 'Residential', rows: (['standard', 'premium', 'luxury'] as const).map((k) => ({ label: titleCase(k), value: perSqft(RATE_CARD.residential[k]) })) },
    { title: 'Commercial', rows: (['basic', 'mid', 'premium'] as const).map((k) => ({ label: k === 'mid' ? 'Mid-range' : titleCase(k), value: perSqft(RATE_CARD.commercial[k]) })) },
    { title: 'Single room redesign', rows: [{ label: 'All-in', value: formatRange(RATE_CARD.singleRoom.low, RATE_CARD.singleRoom.high) }] },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {groups.map((g) => (
        <Panel key={g.title} title={g.title}>
          <dl className="space-y-2.5 text-sm">
            {g.rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
                <dt className="text-mute">{r.label}</dt>
                <dd className="mono text-right text-bone">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}
      <p className="text-xs text-mute md:col-span-3">Internal — carpet area of the designed space — never quote.</p>
    </div>
  );
}
