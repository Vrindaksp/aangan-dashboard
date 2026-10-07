// Qualification rubric (Nikhil's five criteria) with override controls, and the compact escalation resolver.

import { overrideQualificationAction, resolveEscalationAction, acknowledgeEscalationAction } from '@/app/actions';
import { Badge, Empty, Panel, ReturnTo, severityTone } from '@/components/ui';
import { formatDateTime, titleCase } from '@/lib/format';
import { effectiveQualification } from '@/lib/metrics';
import type { Criteria, Verdict } from '@/lib/types';
import { isOpenEsc, type InspectorData } from './inspector-kit';

const CRITERIA: { key: keyof Criteria; label: string; hint: string }[] = [
  { key: 'real_project', label: '1 · Real project', hint: 'Wants design and execution, not just advice' },
  { key: 'service_area', label: '2 · Service area', hint: 'Pune city or PCMC' },
  { key: 'timeline', label: '3 · Timeline', hint: 'Site ready for execution within about 8 to 10 weeks' },
  { key: 'budget', label: '4 · Budget', hint: 'Judged only if volunteered. Never asked.' },
  { key: 'decision_maker', label: '5 · Decision-maker', hint: 'Caller decides, or is authorised to' },
];

const VERDICT: Record<Verdict, { label: string; tone: 'ok' | 'warn' | 'crit' }> = {
  pass: { label: 'Pass', tone: 'ok' }, unclear: { label: 'Unclear', tone: 'warn' }, fail: { label: 'Fail', tone: 'crit' },
};

export function RubricPanel({ d }: { d: InspectorData }) {
  const { ctx, e, tr, escs } = d;
  const notes = tr?.extraction?.criteria_notes ?? {};
  const eff = effectiveQualification(e);
  const suggested =
    escs.find((x) => isOpenEsc(x) && x.suggested_question)?.suggested_question ??
    escs.find((x) => x.suggested_question)?.suggested_question ??
    tr?.extraction?.clarifying_question ?? null;
  const canAct = eff !== 'not_applicable';

  return (
    <Panel title="Qualification rubric" right={e.final_decided_by ? <span className="mono text-xs text-mute">decided by {e.final_decided_by}</span> : undefined}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className="th">Criterion</th>
              <th scope="col" className="th">Verdict</th>
              <th scope="col" className="th">Evidence from the conversation</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map(({ key, label, hint }) => {
              const v = e.criteria[key];
              const note = notes[key];
              return (
                <tr key={key}>
                  <th scope="row" className="td text-left font-normal">
                    <div className="text-bone">{label}</div>
                    <div className="text-xs text-mute">{hint}</div>
                  </th>
                  <td className="td">{v ? <Badge tone={VERDICT[v].tone}>{VERDICT[v].label}</Badge> : <Badge>Not assessed</Badge>}</td>
                  <td className="td text-sm text-bone/90">{note ?? <span className="text-mute">{tr ? 'No evidence note stored.' : 'No conversation to quote.'}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {e.qualification_reasons.length > 0 && (
        <div className="mt-4">
          <div className="label mb-1">Why the AI decided this</div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-bone">
            {e.qualification_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {suggested && (
        <div className="mt-4 border border-info/50 bg-info/10 px-3 py-2">
          <div className="label mb-1 text-info">Suggested clarifying question (the one to ask)</div>
          <p className="text-sm text-bone">{suggested}</p>
          <p className="mt-1 text-xs text-mute">It never probes budget. Send it from the Client email panel below (Clarification).</p>
        </div>
      )}

      {e.open_questions.length > 0 && (
        <div className="mt-4">
          <div className="label mb-1">Designer notes / open questions</div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-bone">
            {e.open_questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {e.override_note && <p className="mt-3 text-xs text-mute">Last override note: <span className="text-bone">{e.override_note}</span></p>}

      {canAct ? (
        <form action={overrideQualificationAction} className="mt-4 border-t border-line pt-3">
          <input type="hidden" name="enquiry_id" value={e.id} />
          <ReturnTo value={ctx.returnTo} />
          <label htmlFor="ovr-note" className="label mb-1 block">Override the decision (optional note)</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="ovr-note" name="note" maxLength={500} placeholder="Why? e.g. owner confirmed budget on a call" className="field" />
            <div className="flex shrink-0 gap-2">
              {(eff === 'qualified' || eff === 'review') && (
                <button type="submit" name="to" value="unqualified" className="btn-danger">
                  {eff === 'qualified' ? 'Flag as bad lead (false positive)' : 'Decline this lead'}
                </button>
              )}
              {(eff === 'unqualified' || eff === 'review') && (
                <button type="submit" name="to" value="qualified" className="btn-solid">
                  {eff === 'unqualified' ? 'Rescue as good lead (false negative)' : 'Qualify this lead'}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-mute">
            These clicks are how the studio measures the AI: bad-lead flags feed the false-positive rate, rescues feed the false-negative rate.
            Flagging a lead as bad closes it; rescuing reopens it.
          </p>
        </form>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-xs text-mute">Not a lead (spam, vendor, wrong number…), so there is nothing to override.</p>
      )}
    </Panel>
  );
}

export function EscalationsPanel({ d }: { d: InspectorData }) {
  const { ctx, e, escs } = d;
  const open = escs.filter(isOpenEsc);
  const done = escs.filter((x) => !isOpenEsc(x));
  const aiCall = e.ai_qualification === 'qualified' || e.ai_qualification === 'unqualified';

  return (
    <Panel title={`Open escalations (${open.length})`} hot={open.length > 0}>
      {open.length === 0 ? (
        <Empty>Nothing is holding this enquiry. {escs.length === 0 ? 'It never triggered an escalation.' : 'All escalations are resolved.'}</Empty>
      ) : (
        <ul className="space-y-4">
          {open.map((x) => (
            <li key={x.id} className="border border-line bg-ink p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={severityTone(x.severity)}>{x.severity}</Badge>
                <span className="font-display text-sm font-bold uppercase tracking-wide">{titleCase(x.trigger)}</span>
                <Badge>{titleCase(x.kind)}</Badge>
                <Badge tone={x.status === 'acknowledged' ? 'info' : 'warn'}>{x.status}</Badge>
                <span className="mono ml-auto text-[11px] text-mute">to {titleCase(x.assigned_to)} · {formatDateTime(x.created_at)}</span>
              </div>
              {x.reason && <p className="mt-2 text-sm text-bone">{x.reason}</p>}
              {x.suggested_question && <p className="mt-1 text-xs text-info">Suggested question: {x.suggested_question}</p>}

              <form action={resolveEscalationAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="escalation_id" value={x.id} />
                <ReturnTo value={ctx.returnTo} />
                <label htmlFor={`esc-note-${x.id}`} className="sr-only">Resolution note</label>
                <input id={`esc-note-${x.id}`} name="note" maxLength={500} placeholder="Resolution note (optional)" className="field" />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" name="decision" value="qualify" className="btn-solid">Qualify &amp; release</button>
                  <button type="submit" name="decision" value="reject" className="btn-danger">Reject</button>
                  {aiCall && <button type="submit" name="decision" value="approve_ai" className="btn" title="Accept the AI's own call as the final decision">Approve AI call</button>}
                  <button type="submit" name="decision" value="dismiss" className="btn-ghost" title="Resolve without changing the qualification">Dismiss</button>
                </div>
              </form>
              {x.status === 'open' && (
                <form action={acknowledgeEscalationAction} className="mt-2">
                  <input type="hidden" name="escalation_id" value={x.id} />
                  <ReturnTo value={ctx.returnTo} />
                  <button type="submit" className="btn-ghost">Acknowledge (I am on it)</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && !aiCall && (
        <p className="mt-2 text-xs text-mute">The AI made no qualify or decline call here, so "Approve AI call" is not offered. Choose Qualify or Reject.</p>
      )}

      {done.length > 0 && (
        <details className="mt-4 border border-line">
          <summary className="label px-3 py-2 hover:bg-raised hover:text-bone">Resolved ({done.length})</summary>
          <ul className="divide-y divide-line px-3 pb-2">
            {done.map((x) => (
              <li key={x.id} className="py-2 text-sm">
                <span className="font-mono text-xs uppercase tracking-wide text-mute">{titleCase(x.trigger)}</span>
                <span className="text-bone"> → {x.resolution ? titleCase(x.resolution) : 'resolved'}</span>
                <span className="mono text-xs text-mute"> · {x.resolved_by ?? 'unknown'} · {formatDateTime(x.resolved_at)}</span>
                {x.resolution_note && <div className="text-xs text-mute">{x.resolution_note}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
