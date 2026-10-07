// Inspector top: sticky identity bar + jump links, the overview panel (summary / response timeline / CRM sync)
// and the confidence-gate panel.

import { Badge, Bar, ConfidenceMeter, Panel, Empty, channelLabel, qualLabel, qualTone, statusTone } from '@/components/ui';
import { GUARDRAILS } from '@/lib/config';
import { formatDateTime, formatDuration, pct, titleCase } from '@/lib/format';
import { classifyOverride, type OverrideClass } from '@/lib/guardrails';
import type { EnquiryRow } from '@/lib/types';
import { isOpenEsc, KV, type InspectorData } from './inspector-kit';

const JUMPS: [string, string][] = [
  ['gate', 'Confidence'], ['transcript', 'Transcript'], ['rubric', 'Rubric'], ['escalations', 'Escalations'], ['brief', 'Brief'],
  ['pricing', 'Pricing'], ['consult', 'Consultation'], ['email', 'Email'], ['outcome', 'Outcome'],
];

const OVERRIDE_TEXT: Record<OverrideClass, { label: string; tone: 'ok' | 'warn' | 'crit' | 'info' }> = {
  confirmed: { label: 'Human confirmed the AI', tone: 'ok' },
  false_positive: { label: 'False positive (AI said yes, human said no)', tone: 'crit' },
  false_negative: { label: 'False negative (AI said no, human said yes)', tone: 'crit' },
  gray_to_qualified: { label: 'Review case, human qualified', tone: 'info' },
  gray_to_unqualified: { label: 'Review case, human declined', tone: 'info' },
};

const FLAG_LABEL: Record<string, string> = {
  founder_connection: 'Founder connection', referral: 'Referral', large_project: 'Large project', asked_pricing: 'Asked for pricing',
  competitive: 'Comparing studios', frustrated: 'Frustrated', after_hours: 'After hours',
};

export function InspectorBar({ d }: { d: InspectorData }) {
  const { e, escs } = d;
  const open = escs.filter(isOpenEsc).length;
  const eff = e.final_qualification ?? e.ai_qualification;
  return (
    <header className="sticky top-0 z-10 border border-line border-t-2 border-t-accent bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">{e.client_name ?? 'Unnamed enquirer'}</h2>
          <div className="mono mt-0.5 text-xs text-mute">
            {e.source_ref ?? e.id.slice(0, 8)} · {channelLabel(e.channel)} · {formatDateTime(e.received_at)}
            {e.location ? ` · ${e.location}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(e.status)}>{titleCase(e.status)}</Badge>
          <Badge tone={qualTone(eff)} title="The decision that counts (human call if made, else AI)">{qualLabel(eff)}</Badge>
          {open > 0 && <Badge tone="crit">{open} open escalation{open === 1 ? '' : 's'}</Badge>}
          {e.is_synthetic && <Badge tone="info" title="Simulated row, not a real enquiry">Synthetic</Badge>}
        </div>
      </div>
      <nav aria-label="Jump to section" className="scroll-thin mt-2 flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5">
        {JUMPS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-mute hover:bg-raised hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Step({ label, at, sub, done }: { label: string; at: string | null; sub?: string; done?: boolean }) {
  return (
    <li className={`border-l-2 pl-3 ${at ? 'border-bone' : 'border-line'}`}>
      <div className="label">{label}</div>
      <div className={`mono text-sm ${at ? 'text-bone' : 'text-mute'}`}>{at ? formatDateTime(at) : done === false ? 'not yet' : 'not recorded'}</div>
      {sub && <div className="mono text-xs text-mute">{sub}</div>}
    </li>
  );
}

function hubspotLine(e: EnquiryRow): { tone: 'ok' | 'crit' | 'neutral'; text: string } {
  if (e.hubspot_error) return { tone: 'crit', text: `Sync failed: ${e.hubspot_error}` };
  if (e.hubspot_synced_at) return { tone: 'ok', text: `Synced to HubSpot ${formatDateTime(e.hubspot_synced_at)}${e.hubspot_deal_id ? ` · deal ${e.hubspot_deal_id}` : ''}` };
  return { tone: 'neutral', text: 'Not synced to HubSpot (CRM sync runs when HubSpot is configured).' };
}

export function OverviewPanel({ d }: { d: InspectorData }) {
  const { e } = d;
  const answered = e.first_response_at ? (new Date(e.first_response_at).getTime() - new Date(e.received_at).getTime()) / 60_000 : null;
  const hs = hubspotLine(e);
  const cls = classifyOverride(e);
  const flags = e.priority_flags.filter((f) => f !== 'after_hours');
  return (
    <Panel title="Overview">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={qualTone(e.ai_qualification)} title="What the AI concluded">AI: {qualLabel(e.ai_qualification)}</Badge>
        {e.final_qualification ? (
          <Badge tone={qualTone(e.final_qualification)} title={e.final_decided_by ? `Decided by ${e.final_decided_by}` : undefined}>
            Human: {qualLabel(e.final_qualification)}
          </Badge>
        ) : (
          <Badge tone="neutral">No human decision yet</Badge>
        )}
        {cls && <Badge tone={OVERRIDE_TEXT[cls].tone}>{OVERRIDE_TEXT[cls].label}</Badge>}
        {e.after_hours && <Badge tone="warn">After hours</Badge>}
        {flags.map((f) => (
          <Badge key={f} tone="accent">{['founder_connection', 'referral', 'large_project'].includes(f) ? '★ ' : ''}{FLAG_LABEL[f] ?? titleCase(f)}</Badge>
        ))}
      </div>

      <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
        <KV k="Phone">{e.client_phone ?? '—'}</KV>
        <KV k="Email">{e.client_email ?? '—'}</KV>
        <KV k="Location">{e.location ?? '—'}</KV>
        <KV k="Area">{e.area_sqft ? `${e.area_sqft.toLocaleString('en-IN')} sq ft` : '—'}</KV>
        <KV k="Designer">{e.designer_name ?? 'unassigned'}</KV>
        <KV k="Handoff">{titleCase(e.handoff_status)}{e.designer_reasked ? ' · re-asked basics' : ''}</KV>
      </dl>

      <div className="mt-3">
        <div className="label mb-1">AI-synthesised brief</div>
        <p className="text-sm leading-relaxed text-bone">{e.summary ?? 'No summary was generated for this enquiry.'}</p>
      </div>

      <div className="mt-4">
        <div className="label mb-2">Response timeline</div>
        <ol className="grid gap-3 sm:grid-cols-4">
          <Step label="Received" at={e.received_at} />
          <Step
            label="First response"
            at={e.first_response_at}
            sub={answered !== null ? `after ${formatDuration(answered)}` : undefined}
            done={e.channel === 'web_form' ? undefined : false}
          />
          <Step label="Brief released" at={e.handoff_sent_at} done={false} />
          <Step label="Designer accepted" at={e.handoff_accepted_at} done={false} />
        </ol>
        {!e.first_response_at && e.channel === 'web_form' && (
          <p className="mt-2 text-xs text-mute">Web-form response times were never logged. Use "Record first response" below going forward.</p>
        )}
      </div>

      <p className={`mono mt-4 border-t border-line pt-2 text-xs ${hs.tone === 'crit' ? 'text-crit' : hs.tone === 'ok' ? 'text-ok' : 'text-mute'}`}>
        CRM · {hs.text}
      </p>
    </Panel>
  );
}

export function GatePanel({ d }: { d: InspectorData }) {
  const { e, tr, escs } = d;
  const thr = GUARDRAILS.confidenceMin;
  const ext = tr?.extraction ?? null;
  const fieldConf = Object.entries(tr?.field_confidence && Object.keys(tr.field_confidence).length ? tr.field_confidence : ext?.field_confidence ?? {}).sort((a, b) => a[1] - b[1]);
  const flags = [...new Set([...(tr?.ambiguity_flags ?? []), ...(ext?.ambiguity_flags ?? [])])];
  const trEsc = escs.filter((x) => x.kind === 'transcription');
  const held = (e.composite_confidence !== null && e.composite_confidence < thr) || trEsc.length > 0;
  const noData = e.composite_confidence === null && e.transcription_confidence === null;

  return (
    <Panel
      title="Confidence and gate"
      right={noData ? <Badge>No conversation scored</Badge> : held ? <Badge tone="crit">Held by the {pct(thr)} gate</Badge> : <Badge tone="ok">Passed the gate</Badge>}
    >
      {noData ? (
        <Empty>No confidence scores: nothing was transcribed (for example a missed call or a form without parsed text).</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="label mb-1">Composite confidence</div>
              <ConfidenceMeter value={e.composite_confidence} threshold={thr} />
              <p className="mt-1 text-xs text-mute">Blend of speech-to-text confidence, [inaudible] penalties and how clearly scope and location came through.</p>
            </div>
            <div>
              <div className="label mb-1">Raw transcription confidence</div>
              <ConfidenceMeter value={e.transcription_confidence ?? tr?.transcription_confidence ?? null} threshold={thr} />
              <p className="mt-1 text-xs text-mute">
                {ext ? `${ext.inaudible_count} inaudible/uncertain spot${ext.inaudible_count === 1 ? '' : 's'} (each costs ${pct(GUARDRAILS.inaudiblePenalty)}, capped at ${pct(GUARDRAILS.inaudiblePenaltyCap)}).` : 'No extraction stored.'}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-mute">
            Gate: anything below <span className="mono text-bone">{pct(thr)}</span> is held for a human instead of going to a designer.
            {held ? ' This enquiry is held.' : ' This enquiry cleared it.'}
          </p>
        </>
      )}

      {trEsc.map((x) => (
        <div key={x.id} className="mt-3 border border-crit/50 bg-crit/10 px-3 py-2 text-sm">
          <span className="label mr-2 text-crit">Transcription escalation · {x.status}</span>
          <span className="text-bone">{x.reason || titleCase(x.trigger)}</span>
        </div>
      ))}

      {flags.length > 0 && (
        <div className="mt-4">
          <div className="label mb-1.5">Ambiguity flags</div>
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => <Badge key={f} tone="warn">{f}</Badge>)}
          </div>
        </div>
      )}

      {fieldConf.length > 0 && (
        <details className="mt-4" open={fieldConf.some(([, v]) => v < thr)}>
          <summary className="label hover:text-bone">Per-field confidence ({fieldConf.length}) · lowest first</summary>
          <ul className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {fieldConf.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2">
                <span className="truncate font-mono text-xs text-mute" title={k}>{k}</span>
                <Bar value={v} max={1} tone={v >= thr ? 'ok' : 'crit'} label={`${k} confidence ${pct(v)}`} />
                <span className={`mono text-right text-xs ${v >= thr ? 'text-ok' : 'text-crit'}`}>{pct(v)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
