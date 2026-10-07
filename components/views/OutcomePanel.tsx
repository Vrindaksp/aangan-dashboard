// Outcome and response: record the first response, mark won / lost.

import { markRespondedAction, setOutcomeAction } from '@/app/actions';
import { Badge, Panel, ReturnTo } from '@/components/ui';
import { formatDateTime, formatDuration, formatLakhCr } from '@/lib/format';
import { Field, type InspectorData } from './inspector-kit';

export function OutcomePanel({ d }: { d: InspectorData }) {
  const { ctx, e } = d;
  const closed = e.status === 'won' || e.status === 'lost';
  const answered = e.first_response_at ? (new Date(e.first_response_at).getTime() - new Date(e.received_at).getTime()) / 60_000 : null;

  const outcomeForms = (
    <div className="grid gap-4 sm:grid-cols-2">
      <form action={setOutcomeAction} className="space-y-2 border border-line p-3">
        <input type="hidden" name="enquiry_id" value={e.id} />
        <input type="hidden" name="outcome" value="won" />
        <ReturnTo value={ctx.returnTo} />
        <Field label="Signed project value (₹ lakh)" htmlFor="won-val" hint="Signed project value in ₹ lakh. Example: 18.5 means ₹18.5 L.">
          <input id="won-val" name="value_lakh" type="number" min="0.1" step="0.1" required inputMode="decimal" placeholder="e.g. 18.5" className="field" />
        </Field>
        <button type="submit" className="btn-solid">Mark won</button>
      </form>
      <form action={setOutcomeAction} className="space-y-2 border border-line p-3">
        <input type="hidden" name="enquiry_id" value={e.id} />
        <input type="hidden" name="outcome" value="lost" />
        <ReturnTo value={ctx.returnTo} />
        <Field label="Why was it lost?" htmlFor="lost-reason" hint="e.g. chose another studio, budget, timeline, went silent">
          <input id="lost-reason" name="reason" maxLength={300} className="field" />
        </Field>
        <button type="submit" className="btn-danger">Mark lost</button>
      </form>
    </div>
  );

  return (
    <Panel title="Outcome and response" right={closed ? <Badge tone={e.status === 'won' ? 'ok' : 'crit'}>{e.status === 'won' ? 'Won' : 'Lost'}</Badge> : undefined}>
      <div className="mb-4">
        <div className="label mb-1">First response</div>
        {e.first_response_at ? (
          <p className="text-sm text-bone">
            Recorded <span className="mono">{formatDateTime(e.first_response_at)}</span>
            {answered !== null && <span className="text-mute"> · {formatDuration(answered)} after the enquiry arrived</span>}
          </p>
        ) : (
          <form action={markRespondedAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="enquiry_id" value={e.id} />
            <ReturnTo value={ctx.returnTo} />
            <Field label="Responded at (IST, blank = now)" htmlFor="resp-at" className="sm:w-64">
              <input id="resp-at" type="datetime-local" name="at" className="field" />
            </Field>
            <button type="submit" className="btn-solid">Record first response</button>
          </form>
        )}
        {!e.first_response_at && <p className="mt-1 text-xs text-mute">Use this when you reached the client by a channel the dashboard cannot see. A real client email send records it automatically.</p>}
      </div>

      <div className="border-t border-line pt-3">
        <div className="label mb-2">Outcome</div>
        {closed ? (
          <>
            <p className="text-sm text-bone">
              {e.status === 'won'
                ? <>Won, signed value <span className="mono font-bold">{formatLakhCr(e.final_value_inr)}</span>.</>
                : <>Lost{e.closed_reason ? `: ${e.closed_reason}` : ' (no reason recorded)'}.</>}
            </p>
            <details className="mt-2">
              <summary className="label hover:text-bone">Change the outcome</summary>
              <div className="mt-2">{outcomeForms}</div>
            </details>
          </>
        ) : (
          outcomeForms
        )}
      </div>
    </Panel>
  );
}
