// "Results" — the founder's main screen (outcome numbers only) and a designer tab.
// Aggregates only: nothing in here loops over enquiries or prints per-person data.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, ConfidenceMeter, Empty, Kpi, Panel, SectionHead, type Tone } from '../ui';
import { DistributionList, Funnel, SegmentedBar, Stat, StatGrid, StackedDailyBars } from '../charts';
import type { ViewCtx } from '../types';
import { GUARDRAILS } from '@/lib/config';
import { formatDuration, formatLakhCr, pct } from '@/lib/format';
import { href } from '@/lib/url';

const orDash = (v: number | null, f: (n: number) => string) => (v === null ? '—' : f(v));
const share = (v: number | null) => orDash(v, (n) => pct(n));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const KIND_LABEL: Record<string, string> = {
  transcription: 'Transcription (low confidence)',
  lead_qualification: 'Lead qualification',
  pricing: 'Pricing',
  service_recovery: 'Service recovery',
};
const OWNER_LABEL: Record<string, string> = { front_desk: 'Front desk', founder: 'Founder', senior_designer: 'Senior designer' };

export function Overview({ ctx }: { ctx: ViewCtx }) {
  const { m, role } = ctx;
  const { volume: v, response: r, qualification: q, handoff: h, escalations: e, calendar: c, money, funnel } = m;
  const realLeads = funnel[1]?.n ?? 0;
  const openEsc = e.open + e.acknowledged;

  return (
    <div className="space-y-12">
      {/* ---------------------------------------------------------------- header */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Results · outcome numbers only</div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">{m.monthLabel}</h2>
          </div>
          {m.syntheticCount > 0 && (
            <Badge tone="warn" title="Simulated rows are mixed into these numbers. Use the toggle in the header to hide them.">
              Includes {m.syntheticCount} synthetic {m.syntheticCount === 1 ? 'row' : 'rows'}
            </Badge>
          )}
        </div>
        {m.syntheticCount > 0 && (
          <p className="mt-3 border border-warn/50 bg-warn/10 px-4 py-2 text-xs text-bone">
            <span className="mr-2 font-mono uppercase tracking-arch text-warn">Synthetic data</span>
            This month includes {m.syntheticCount} synthetic {m.syntheticCount === 1 ? 'row' : 'rows'} (simulated, not real enquiries). Figures are not purely real-world.
          </p>
        )}
        {!m.hasData && (
          <div className="mt-3"><Empty>No enquiries recorded for {m.monthLabel} yet. Every number below will fill in as enquiries arrive.</Empty></div>
        )}
      </div>

      {/* ---------------------------------------------------------------- hero KPIs */}
      <section aria-label="Headline numbers">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi
            label="Enquiries this month"
            value={v.total}
            sub={`${v.byChannel.phone.n} phone · ${v.byChannel.whatsapp.n} WhatsApp · ${v.byChannel.web_form.n} web form`}
          />
          <Kpi
            hot
            label="Responded within 1 hour"
            value={r.withinHourShare === null ? '—' : pct(r.withinHourShare)}
            tone={r.withinHourShare === null ? 'neutral' : r.withinHourShare >= 0.5 ? 'ok' : 'warn'}
            sub={r.recorded > 0 ? `Of ${r.recorded} with a recorded response. Under 1 h converts best; over 48 h drops off.` : 'No first responses recorded yet.'}
          />
          <Kpi
            label="Qualified rate of real leads"
            value={q.qualifiedRate === null ? '—' : pct(q.qualifiedRate)}
            sub={realLeads > 0 ? `${q.counts.qualified} qualified of ${realLeads} real leads` : 'No real leads yet.'}
          />
          <Kpi
            hot
            label="Qualified pipeline value"
            value={money.pipelineCount > 0 ? formatLakhCr(money.pipelineInr) : '—'}
            sub={money.pipelineCount > 0 ? `${plural(money.pipelineCount, 'live lead')} · internal estimate` : 'No qualified live leads with an estimate yet.'}
          />
          <Kpi
            label="Won revenue"
            value={money.wonCount > 0 ? formatLakhCr(money.wonInr) : '—'}
            sub={
              money.wonCount + money.lostCount > 0
                ? `Win rate ${share(money.winRate)} · ${money.wonCount} won, ${money.lostCount} lost`
                : 'No outcomes logged yet'
            }
          />
          <Kpi
            label="Open escalations"
            value={openEsc}
            tone={openEsc > 0 ? 'warn' : 'ok'}
            href={role === 'designer' ? href(ctx.sp, { view: 'escalations', enquiry: null }) : undefined}
            sub={`${e.open} open · ${e.acknowledged} acknowledged${role === 'designer' ? ' · open the queue →' : ''}`}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- 01 volume */}
      <section>
        <SectionHead index="01" title="Enquiry volume" note="Phone carries the most volume and the most urgency. The front desk is staffed 10am–7pm, so after-hours enquiries wait for the next morning." />
        {v.total === 0 ? (
          <Empty>No enquiries this month.</Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Daily enquiries by channel" className="lg:col-span-2" right={<span className="mono text-xs text-mute">{v.total} total</span>}>
              <StackedDailyBars days={v.daily} />
            </Panel>
            <div className="space-y-3">
              <Panel title="Channel split">
                <DistributionList
                  items={[
                    { label: 'Phone', n: v.byChannel.phone.n, tone: 'accent' },
                    { label: 'WhatsApp', n: v.byChannel.whatsapp.n, tone: 'info' },
                    { label: 'Web form', n: v.byChannel.web_form.n, tone: 'neutral' },
                  ]}
                  total={v.total}
                  scale="total"
                />
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  <ChannelNote name="WhatsApp" endpoint="POST /api/ingest/whatsapp" n={v.byChannel.whatsapp.n} />
                  <ChannelNote name="Web form" endpoint="POST /api/ingest/web-form" n={v.byChannel.web_form.n} />
                </div>
              </Panel>
            </div>
            <div className="lg:col-span-3">
              <StatGrid>
                <Stat
                  label="After-hours share"
                  value={share(v.afterHoursShare)}
                  tone={v.afterHoursShare !== null && v.afterHoursShare >= 0.3 ? 'warn' : 'neutral'}
                  sub={`${plural(v.afterHours, 'enquiry', 'enquiries')} outside 10am–7pm`}
                />
                <Stat label="Missed calls" value={v.missedCalls} tone={v.missedCalls > 0 ? 'warn' : 'ok'} sub="Phone enquiries nobody picked up" />
                <Stat label="Dropped calls" value={v.droppedCalls} tone={v.droppedCalls > 0 ? 'warn' : 'ok'} sub="Caller hung up mid-conversation" />
                <Stat label="Phone share" value={pct(v.byChannel.phone.share)} sub="Of all enquiries this month" />
              </StatGrid>
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- 02 response time */}
      <section>
        <SectionHead
          index="02"
          title="Response time"
          note="The studio's own finding: replying within an hour converts best, and after 48 hours enquiries fall away. Conversion is won ÷ (won + lost) per bucket."
        />
        <div className="grid gap-3 lg:grid-cols-5">
          <Panel title="Time to first response" className="lg:col-span-3" right={<span className="mono text-xs text-mute">{r.recorded} recorded</span>}>
            {r.recorded === 0 ? (
              <p className="text-sm text-mute">No first responses recorded yet this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] border-collapse">
                  <thead>
                    <tr>
                      <th scope="col" className="th pl-0">Bucket</th>
                      <th scope="col" className="th w-[40%]">Enquiries</th>
                      <th scope="col" className="th text-right">Won ÷ decided</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.buckets.map((b) => {
                      const max = Math.max(1, ...r.buckets.map((x) => x.n));
                      const tone: Tone = b.key === 'lt1h' ? 'ok' : b.key === 'gt48h' ? 'crit' : 'accent';
                      return (
                        <tr key={b.key}>
                          <th scope="row" className="td pl-0 text-left font-normal text-bone">{b.label}</th>
                          <td className="td">
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 bg-line/60" role="img" aria-label={`${b.label}: ${b.n} enquiries`}>
                                <div className={`h-full ${tone === 'ok' ? 'bg-ok' : tone === 'crit' ? 'bg-crit' : 'bg-accent'}`} style={{ width: `${(b.n / max) * 100}%` }} />
                              </div>
                              <span className="mono w-8 text-right text-sm">{b.n}</span>
                            </div>
                          </td>
                          <td className="td text-right">
                            {b.conversion === null ? (
                              <span className="text-xs text-mute">No outcomes logged yet</span>
                            ) : (
                              <span className="mono text-sm">{pct(b.conversion)} <span className="text-xs text-mute">({b.won}/{b.resolved})</span></span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-mute">
              {r.notRecorded > 0
                ? `${plural(r.notRecorded, 'enquiry', 'enquiries')} have no recorded first response — web-form response times are not captured in the source data, and some enquiries are still waiting.`
                : 'Every enquiry this month has a recorded first response.'}
            </p>
          </Panel>

          <div className="lg:col-span-2">
            <StatGrid className="grid-cols-2">
              <Stat label="Within 1 hour" value={share(r.withinHourShare)} tone={r.withinHourShare !== null && r.withinHourShare >= 0.5 ? 'ok' : 'neutral'} />
              <Stat label="Over 48 hours" value={share(r.over48hShare)} tone={r.over48hShare !== null && r.over48hShare > 0 ? 'crit' : 'neutral'} />
              <Stat label="Median response" value={formatDuration(r.medianMinutes)} sub="All recorded enquiries" />
              <Stat label="Still awaiting" value={r.awaiting} tone={r.awaiting > 0 ? 'warn' : 'ok'} sub="Active leads with no reply yet" />
              <Stat label="In hours" value={formatDuration(r.medianInHours)} sub="Median, 10am–7pm" />
              <Stat label="After hours" value={formatDuration(r.medianAfterHours)} sub="Median, outside hours" />
            </StatGrid>
            <div className="mt-3 border border-line bg-panel p-4">
              <div className="label">Median by channel</div>
              <dl className="mt-2 grid grid-cols-3 gap-3">
                <MedianCell name="Phone" minutes={r.medianByChannel.phone} />
                <MedianCell name="WhatsApp" minutes={r.medianByChannel.whatsapp} />
                <MedianCell name="Web form" minutes={r.medianByChannel.web_form} missing="Not recorded" />
              </dl>
            </div>
            <div className="mt-3 border border-line bg-panel p-4">
              <div className="label">Speed vs conversion</div>
              {r.conversionLift !== null ? (
                <p className="mt-1.5 text-sm text-bone">
                  Enquiries answered within an hour convert <span className="num text-xl text-ok">{r.conversionLift.toFixed(1)}×</span> better than those answered after 48 hours.
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-mute">Shown once outcomes are logged for both the under-1-hour and over-48-hour groups.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 03 qualification */}
      <section>
        <SectionHead
          index="03"
          title="Lead qualification"
          note="AI screens every enquiry against the five-criteria rubric. A person reviews the gray area, then audits a sample of declines so we can measure how often the AI is wrong."
        />
        <div className="grid gap-3">
          <Panel title="AI outcome" right={<span className="mono text-xs text-mute">{v.total} enquiries</span>}>
            <SegmentedBar
              segments={[
                { label: 'Qualified', n: q.counts.qualified, tone: 'ok' },
                { label: 'Needs review', n: q.counts.review, tone: 'warn' },
                { label: 'Declined', n: q.counts.unqualified, tone: 'neutral' },
                { label: 'Not a lead', n: q.counts.not_applicable, tone: 'info' },
              ]}
            />
          </Panel>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Where the AI was overruled" className="lg:col-span-2">
              <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
                <div className="bg-panel p-4">
                  <div className="label">False-negative rate</div>
                  <div className={`num mt-1.5 text-4xl leading-none ${q.fnRate !== null && q.fnRate > 0 ? 'text-warn' : 'text-bone'}`}>{share(q.fnRate)}</div>
                  <p className="mt-2 text-xs leading-snug text-mute">
                    Declined by the AI, later rescued by a person.{' '}
                    {q.fnAudited > 0
                      ? `${q.falseNegatives} of ${q.fnAudited} audited ${q.fnAudited === 1 ? 'decline' : 'declines'}.`
                      : 'No declines audited yet.'}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-mute">
                    {q.estMissedGoodLeads !== null
                      ? `Estimated good leads missed: about ${q.estMissedGoodLeads} (an estimate from the audited share, not a count).`
                      : 'Missed-lead estimate appears once declines have been audited.'}
                  </p>
                </div>
                <div className="bg-panel p-4">
                  <div className="label">False-positive rate</div>
                  <div className={`num mt-1.5 text-4xl leading-none ${q.fpRate !== null && q.fpRate > 0 ? 'text-warn' : 'text-bone'}`}>{share(q.fpRate)}</div>
                  <p className="mt-2 text-xs leading-snug text-mute">
                    Qualified by the AI, later flagged bad.{' '}
                    {q.counts.qualified > 0 ? `${q.falsePositives} of ${q.counts.qualified} qualified.` : 'Nothing qualified yet.'}
                  </p>
                </div>
              </div>
              <p className="mt-3 border-l-2 border-accent pl-3 text-xs leading-snug text-bone">
                Why false negatives matter more: a good lead we turn away is lost revenue, while a false positive only costs a designer a little time.
              </p>
            </Panel>

            <Panel title="Model confidence">
              {q.avgConfidence === null ? (
                <p className="text-sm text-mute">No confidence scores recorded yet.</p>
              ) : (
                <>
                  <div className="num text-4xl leading-none">{pct(q.avgConfidence)}</div>
                  <div className="mt-3"><ConfidenceMeter value={q.avgConfidence} threshold={GUARDRAILS.confidenceMin} label={false} /></div>
                  <p className="mt-2 text-xs text-mute">
                    Average composite confidence against the {pct(GUARDRAILS.confidenceMin)} gate. Below the gate, a person checks the transcript before anything goes to a designer.
                  </p>
                </>
              )}
              <p className="mt-3 border-t border-line pt-3 text-xs text-mute">
                Gate trips this month: <span className="mono text-bone">{q.gateTrips}</span>
              </p>
            </Panel>
          </div>

          <StatGrid>
            <Stat label="Gray-area queue" value={q.awaitingReview} tone={q.awaitingReview > 0 ? 'warn' : 'ok'} sub="Waiting for a person to decide" />
            <Stat label="Gray-area rescued" value={q.grayRescued} sub={`${q.grayDeclined} declined after review`} />
            <Stat label="Audits pending" value={q.auditsOpen} tone={q.auditsOpen > 0 ? 'warn' : 'neutral'} sub="Sampled declines not yet checked" />
            <Stat label="AI confirmed" value={q.confirmed} sub="Reviewed and the AI was right" />
          </StatGrid>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 04 handoff */}
      <section>
        <SectionHead index="04" title="Designer handoff" note="A handoff succeeds when the designer accepts the brief without having to go back to the client for missing basics." />
        {h.sent === 0 ? (
          <Empty>
            No briefs have been sent to designers yet this month.
            {h.pendingRelease > 0 && <> {plural(h.pendingRelease, 'qualified lead')} {h.pendingRelease === 1 ? 'is' : 'are'} ready to release.</>}
          </Empty>
        ) : (
          <StatGrid>
            <Stat label="Handoff success" value={share(h.successRate)} tone={h.successRate !== null && h.successRate >= 0.8 ? 'ok' : 'warn'} sub={`Accepted without a re-ask, of ${h.sent} sent`} />
            <Stat label="Re-ask rate" value={share(h.reaskRate)} tone={h.reaskRate !== null && h.reaskRate > 0.2 ? 'warn' : 'neutral'} sub={`${plural(h.reasked, 'brief')} sent back for missing basics`} />
            <Stat label="Median time to accept" value={formatDuration(h.medianAcceptMinutes)} sub={`${h.accepted} accepted · ${h.declined} declined`} />
            <Stat label="Pending release" value={h.pendingRelease} tone={h.pendingRelease > 0 ? 'warn' : 'neutral'} sub="Qualified, brief not yet sent" />
          </StatGrid>
        )}
      </section>

      {/* ---------------------------------------------------------------- 05 escalations */}
      <section>
        <SectionHead
          index="05"
          title="Escalations"
          note="Counts only. Open and acknowledged escalations are studio-wide; the by-kind split covers this month's enquiries."
          right={role === 'designer' ? <Link href={href(ctx.sp, { view: 'escalations', enquiry: null })} className="btn-ghost">Work the queue</Link> : undefined}
        />
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <StatGrid>
              <Stat label="Open" value={e.open} tone={e.open > 0 ? 'crit' : 'ok'} />
              <Stat label="Acknowledged" value={e.acknowledged} tone={e.acknowledged > 0 ? 'warn' : 'neutral'} />
              <Stat label="Resolved" value={e.resolved} tone="ok" sub="This month" />
              <Stat label="Open over 24 h" value={e.openOver24h} tone={e.openOver24h > 0 ? 'crit' : 'ok'} sub={`Oldest open: ${formatDuration(e.oldestOpenMinutes)}`} />
            </StatGrid>
          </div>
          <Panel title="By kind (this month)">
            <DistributionList
              items={Object.entries(KIND_LABEL).map(([k, label]) => ({ label, n: e.byKind[k] ?? 0, tone: 'accent' as Tone }))}
              empty="No escalations raised this month."
            />
          </Panel>
          <Panel title="Open by owner">
            <DistributionList
              items={Object.entries(OWNER_LABEL).map(([k, label]) => ({ label, n: e.openByOwner[k] ?? 0, tone: 'warn' as Tone }))}
              empty="Nothing open. Every escalation has been resolved."
            />
          </Panel>
          <Panel title="Resolution & policy">
            <dl className="space-y-3 text-sm">
              <Row k="Median resolution" v={e.resolved > 0 ? formatDuration(e.medianResolutionMinutes) : 'None resolved yet'} />
              <Row k="90th percentile" v={e.resolved > 0 ? formatDuration(e.p90ResolutionMinutes) : '—'} />
              <Row k="Price-policy breaches" v={<span className={e.policyBreaches > 0 ? 'text-crit' : 'text-ok'}>{e.policyBreaches}{e.policyBreaches === 0 ? ' · none' : ' · agent quoted a price'}</span>} />
            </dl>
          </Panel>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 06 consultations */}
      <section>
        <SectionHead index="06" title="Consultations" note="Booked consultations by status this month; upcoming and awaiting-outcome cover all months." />
        <StatGrid className="grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Booked" value={c.scheduled} sub="Still scheduled" />
          <Stat label="Held" value={c.completed} tone={c.completed > 0 ? 'ok' : 'neutral'} />
          <Stat label="No-show" value={c.noShow} tone={c.noShow > 0 ? 'warn' : 'neutral'} />
          <Stat label="Cancelled" value={c.cancelled} />
          <Stat label="Next 7 days" value={c.upcoming7d} sub="Upcoming" />
          <Stat label="Awaiting outcome" value={c.awaitingOutcome} tone={c.awaitingOutcome > 0 ? 'warn' : 'neutral'} sub="Past, not marked held" />
          <Stat label="Booking rate" value={share(c.bookingRate)} sub="Of qualified leads" />
        </StatGrid>
      </section>

      {/* ---------------------------------------------------------------- 07 funnel */}
      <section>
        <SectionHead index="07" title="Funnel" note="From first enquiry to a signed project. Each step shows what share of the step above made it through." />
        {v.total === 0 ? <Empty>No enquiries this month.</Empty> : <Funnel steps={funnel} />}
        {v.total > 0 && funnel[funnel.length - 1].n === 0 && <p className="mt-2 text-xs text-mute">No won projects logged yet.</p>}
      </section>
    </div>
  );
}

// ---- small local pieces ---------------------------------------------------------------------------

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
      <dt className="text-mute">{k}</dt>
      <dd className="mono text-bone">{v}</dd>
    </div>
  );
}

function MedianCell({ name, minutes, missing = 'No data' }: { name: string; minutes: number | null; missing?: string }) {
  return (
    <div>
      <dt className="label">{name}</dt>
      <dd className="num mt-1 text-xl leading-none">{minutes === null ? <span className="text-sm font-normal text-mute">{missing}</span> : formatDuration(minutes)}</dd>
    </div>
  );
}

/** Ingestion endpoints for WhatsApp / web form are scaffolded; "receiving" is derived from this month's volume. */
function ChannelNote({ name, endpoint, n }: { name: string; endpoint: string; n: number }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <div className="text-mute">
        <span className="text-bone">{name}</span> endpoint scaffolded (<span className="font-mono">{endpoint}</span>).
      </div>
      <Badge tone={n > 0 ? 'ok' : 'neutral'}>{n > 0 ? `${n} received` : 'Awaiting provider'}</Badge>
    </div>
  );
}
