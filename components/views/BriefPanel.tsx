// Designer brief (handoff card + release/assign/handoff-state controls) and the internal pricing panel.

import { assignDesignerAction, handoffStateAction, releaseHandoffAction } from '@/app/actions';
import { Badge, Empty, Panel, ReturnTo } from '@/components/ui';
import { buildDesignerBrief } from '@/lib/brief';
import { formatInr, formatLakhCr, formatRange, titleCase } from '@/lib/format';
import { effectiveQualification } from '@/lib/metrics';
import type { BudgetFlag } from '@/lib/types';
import { blockingEscalations, DesignerSelect, Field, KV, type InspectorData } from './inspector-kit';

export function BriefPanel({ d }: { d: InspectorData }) {
  const { ctx, e, escs, pricing, designers } = d;
  const brief = buildDesignerBrief(e, pricing);
  const eff = effectiveQualification(e);
  const blockers = blockingEscalations(escs, e);
  const notQualified = eff !== 'qualified';
  const cannotRelease = notQualified || blockers.length > 0;
  const handedOff = e.handoff_status !== 'not_sent';

  return (
    <Panel
      title="Designer brief"
      right={<Badge tone={handedOff ? 'info' : 'neutral'}>Handoff: {titleCase(e.handoff_status)}</Badge>}
    >
      <p className="mb-2 text-xs text-mute">
        This is the card the designer receives on Telegram and email: verified scope, not a blind forward of the raw message.
      </p>
      <pre className="scroll-thin max-h-80 overflow-auto whitespace-pre-wrap break-words border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-bone" tabIndex={0} aria-label="Designer brief card">
        {brief.text}
      </pre>

      <form className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input type="hidden" name="enquiry_id" value={e.id} />
        <ReturnTo value={ctx.returnTo} />
        <Field label="Designer" htmlFor="brief-designer" hint={designers.length === 0 ? 'No designers in the directory yet.' : 'Release without choosing and the least-loaded designer is picked (seniors for large or founder-connected leads).'}>
          <DesignerSelect id="brief-designer" name="designer_id" designers={designers} value={e.designer_id} blankLabel="Auto: least-loaded designer" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="submit" formAction={releaseHandoffAction} className="btn-solid" disabled={cannotRelease}>Release brief to designer</button>
          <button type="submit" formAction={assignDesignerAction} className="btn" disabled={designers.length === 0} title="Needs a designer chosen. Does not send the brief.">Assign only</button>
        </div>
      </form>
      {cannotRelease && (
        <p className="mt-2 border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn">
          Release is disabled:{' '}
          {notQualified ? `the decision that counts is "${eff === 'review' ? 'needs review' : eff === 'unqualified' ? 'declined' : 'not a lead'}". Qualify it first.` : ''}
          {blockers.length > 0 ? ` Held by ${blockers.length} open escalation${blockers.length === 1 ? '' : 's'} (${blockers.map((b) => titleCase(b.trigger)).join(', ')}). Resolve ${blockers.length === 1 ? 'it' : 'them'} above.` : ''}
        </p>
      )}

      <form action={handoffStateAction} className="mt-4 border-t border-line pt-3">
        <input type="hidden" name="enquiry_id" value={e.id} />
        <ReturnTo value={ctx.returnTo} />
        <div className="label mb-2">Designer's response to the brief</div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="action" value="accept" className="btn" disabled={e.handoff_status !== 'sent'}>Designer accepted</button>
          <button type="submit" name="action" value="decline" className="btn-danger" disabled={e.handoff_status !== 'sent'}>Designer declined</button>
          <button type="submit" name="action" value="reasked" className="btn-ghost" disabled={!handedOff || e.designer_reasked} title="Tracks how often briefs are too thin and the designer has to re-ask the basics">
            {e.designer_reasked ? 'Re-asked basics (logged)' : 'Designer had to re-ask basics'}
          </button>
        </div>
        {!handedOff && <p className="mt-2 text-xs text-mute">Available once the brief has been released.</p>}
      </form>
    </Panel>
  );
}

const FLAG_TEXT: Record<BudgetFlag, { label: string; tone: 'ok' | 'warn' | 'crit' | 'neutral' }> = {
  not_stated: { label: 'Not volunteered', tone: 'neutral' },
  within_range: { label: 'Within range', tone: 'ok' },
  below_range: { label: 'Below range', tone: 'warn' },
  below_minimum: { label: 'Below minimum', tone: 'crit' },
  above_range: { label: 'Above range', tone: 'ok' },
};

export function PricingPanel({ d }: { d: InspectorData }) {
  const { e, pricing, escs } = d;
  const pricingEsc = escs.filter((x) => x.kind === 'pricing' && x.status !== 'resolved');
  return (
    <Panel title="Pricing (internal)" right={<Badge tone="crit">Internal. Never quote.</Badge>}>
      <p className="mb-3 border border-crit/50 bg-crit/10 px-3 py-2 text-sm font-semibold text-crit">
        INTERNAL ONLY. These numbers calibrate you, they are never quoted to the client, not on a call, not in a message, not in an email.
      </p>
      {!pricing ? (
        <Empty>No pricing evaluation was logged for this enquiry (no area or scope to price).</Empty>
      ) : (
        <>
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <KV k="Segment">{titleCase(pricing.segment)}</KV>
            <KV k="Area">{pricing.area_sqft ? `${pricing.area_sqft.toLocaleString('en-IN')} sq ft` : '—'}</KV>
            <KV k="Rate card">{pricing.rate_low_per_sqft && pricing.rate_high_per_sqft ? `${formatInr(pricing.rate_low_per_sqft)} – ${formatInr(pricing.rate_high_per_sqft)} / sq ft` : '—'}</KV>
            <KV k="Indicative range">{formatRange(pricing.indicative_low_inr, pricing.indicative_high_inr)}</KV>
            <KV k="Pipeline estimate">{formatLakhCr(pricing.pipeline_estimate_inr)}</KV>
            <KV k="Volunteered budget">{pricing.budget_low_inr ? formatRange(pricing.budget_low_inr, pricing.budget_high_inr) : 'not volunteered'}</KV>
            <KV k="Budget flag"><Badge tone={FLAG_TEXT[pricing.budget_flag].tone}>{FLAG_TEXT[pricing.budget_flag].label}</Badge></KV>
            <KV k="Anchor risk">{pricing.anchor_risk ? <Badge tone="warn">Yes: do not let their number anchor</Badge> : 'No'}</KV>
            <KV k="Needs pricing review">{pricing.requires_review ? <Badge tone="warn">Yes</Badge> : 'No'}</KV>
            <KV k="Custom-work flags">{pricing.custom_work_flags.length ? pricing.custom_work_flags.map(titleCase).join(', ') : 'none'}</KV>
            {pricing.formal_estimate_inr && <KV k="Formal estimate">{formatLakhCr(pricing.formal_estimate_inr)}</KV>}
            {e.estimated_value_inr && <KV k="Pipeline value used">{formatLakhCr(e.estimated_value_inr)}</KV>}
          </dl>
          {pricingEsc.length > 0 && (
            <ul className="mt-3 space-y-1">
              {pricingEsc.map((x) => (
                <li key={x.id} className="text-sm text-warn"><span className="label mr-2 text-warn">Review reason · {titleCase(x.trigger)}</span><span className="text-bone">{x.reason}</span></li>
              ))}
            </ul>
          )}
          <div className="mt-4 border border-ok/40 bg-ok/5 p-3">
            <div className="label mb-1 text-ok">The only thing a client is ever told about price</div>
            <p className="text-sm italic text-bone">{pricing.client_facing_response}</p>
          </div>
        </>
      )}
    </Panel>
  );
}
