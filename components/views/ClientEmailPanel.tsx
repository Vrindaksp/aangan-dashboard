// Client email channel: live preview of the exact email, preview controls (GET), send form (POST) and history.

import Link from 'next/link';
import { sendClientEmailAction } from '@/app/actions';
import { Badge, Empty, Panel, ReturnTo, type Tone } from '@/components/ui';
import { formatDateTime, titleCase } from '@/lib/format';
import { effectiveQualification } from '@/lib/metrics';
import { getStore } from '@/lib/store';
import type { EmailTemplate } from '@/lib/types';
import { href } from '@/lib/url';
import { prepareClientEmail } from '@/lib/workflow';
import { DesignerSelect, Field, istInput, parseIstInput, type InspectorData } from './inspector-kit';

const TEMPLATES: { key: EmailTemplate; label: string; hint: string }[] = [
  { key: 'confirmation', label: 'Confirmation', hint: 'Names the designer and the callback or booked consultation' },
  { key: 'clarification', label: 'Clarification', hint: 'Asks the ONE question that settles the review' },
  { key: 'decline', label: 'Decline', hint: 'Polite no-fit message' },
];
const STATUS_TONE: Record<string, Tone> = { sent: 'ok', dry_run: 'warn', failed: 'crit' };

export async function ClientEmailPanel({ d }: { d: InspectorData }) {
  const { ctx, e, escs, designers } = d;
  const eff = effectiveQualification(e);
  const defaultTemplate: EmailTemplate = eff === 'unqualified' ? 'decline' : eff === 'review' ? 'clarification' : 'confirmation';
  const template = (TEMPLATES.find((t) => t.key === ctx.sp.email)?.key ?? defaultTemplate) as EmailTemplate;

  const designerId = ctx.sp.ed && designers.some((x) => x.id === ctx.sp.ed) ? ctx.sp.ed : null;
  const callbackAt = parseIstInput(ctx.sp.cb);
  const suggestedQuestion = escs.find((x) => x.suggested_question)?.suggested_question ?? '';
  const question = ctx.sp.eq ?? suggestedQuestion;
  const note = ctx.sp.en ?? '';

  const prep = await prepareClientEmail(getStore(), e.id, template, { designerId, callbackAt, question: template === 'clarification' ? question : null, note: note || null });
  const mode = process.env.CLIENT_EMAIL_MODE === 'live' ? 'live' : 'dry-run';
  const blockers = [...(prep?.composed.blockers ?? []), ...(prep && !prep.to ? ['No valid email address on this enquiry.'] : [])];
  const cbValue = ctx.sp.cb && callbackAt ? ctx.sp.cb : prep?.callbackAt ? istInput(prep.callbackAt) : '';
  const effDesignerId = prep?.designer?.id ?? designerId ?? '';
  const history = ctx.ds.outboundEmails.filter((m) => m.enquiry_id === e.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const name = (id: string | null) => designers.find((x) => x.id === id)?.name ?? '—';
  const tab = (t: EmailTemplate) => `${href(ctx.sp, { email: t })}#email`;

  return (
    <Panel
      title="Client email"
      right={mode === 'live' ? <Badge tone="crit">LIVE: sends really go out</Badge> : <Badge tone="warn">Dry-run: nothing is sent</Badge>}
    >
      <div className={`mb-3 border px-3 py-2 text-sm ${mode === 'live' ? 'border-crit/60 bg-crit/10' : 'border-warn/50 bg-warn/10'}`}>
        <span className={`label mr-2 ${mode === 'live' ? 'text-crit' : 'text-warn'}`}>CLIENT_EMAIL_MODE = {mode === 'live' ? 'live' : 'not live'}</span>
        <span className="text-bone">
          {mode === 'live'
            ? 'This email goes to the real enquirer once you press Send (it also needs RESEND_API_KEY and MAIL_FROM).'
            : 'Sends are recorded as a dry run and NOT delivered. Set CLIENT_EMAIL_MODE=live (with a Resend key) to send for real.'}
        </span>
        <span className="mt-1 block text-xs text-mute">Every body is linted: an email containing a price, rate or "starts at" cannot be sent.</span>
      </div>

      <div role="tablist" aria-label="Email template" className="flex flex-wrap gap-1">
        {TEMPLATES.map((t) => (
          <Link
            key={t.key}
            href={tab(t.key)}
            role="tab"
            aria-selected={t.key === template}
            title={t.hint}
            className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-arch ${t.key === template ? 'border-accent bg-accent text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-mute">{TEMPLATES.find((t) => t.key === template)?.hint}.</p>

      {!prep ? (
        <div className="mt-3"><Empty>Enquiry not found.</Empty></div>
      ) : (
        <>
          {/* ---- preview ---- */}
          <div className="mt-3 border border-line bg-ink">
            <dl className="divide-y divide-line text-sm">
              <div className="grid grid-cols-[5rem_1fr] gap-2 px-3 py-1.5"><dt className="label">To</dt><dd className={`mono break-all ${prep.to ? 'text-bone' : 'text-crit'}`}>{prep.to ?? 'no valid address'}</dd></div>
              <div className="grid grid-cols-[5rem_1fr] gap-2 px-3 py-1.5"><dt className="label">Subject</dt><dd className="text-bone">{prep.composed.subject}</dd></div>
              <div className="grid grid-cols-[5rem_1fr] gap-2 px-3 py-1.5">
                <dt className="label">Designer</dt>
                <dd className="text-bone">{prep.designer ? `${prep.designer.name}${prep.designer.is_sample ? ' (sample)' : ''}` : <span className="text-warn">none assigned</span>}</dd>
              </div>
              <div className="grid grid-cols-[5rem_1fr] gap-2 px-3 py-1.5">
                <dt className="label">Promise</dt>
                <dd className="text-bone">
                  {prep.consultation
                    ? `Booked consultation ${formatDateTime(prep.consultation.starts_at)}`
                    : prep.callbackAt ? `Callback by ${formatDateTime(prep.callbackAt)}` : <span className="text-mute">none</span>}
                </dd>
              </div>
            </dl>
            <pre className="scroll-thin max-h-96 overflow-auto whitespace-pre-wrap break-words border-t border-line p-3 font-mono text-xs leading-relaxed text-bone" tabIndex={0} aria-label="Email body preview">
              {prep.composed.text}
            </pre>
          </div>

          {blockers.length > 0 && (
            <ul className="mt-2 space-y-1" aria-label="Reasons this email cannot be sent">
              {blockers.map((b, i) => (
                <li key={i} className="border border-crit/60 bg-crit/10 px-3 py-1.5 text-sm text-crit"><span className="label mr-2 text-crit">Blocked</span><span className="text-bone">{b}</span></li>
              ))}
            </ul>
          )}

          {/* ---- preview controls (GET: only changes what is shown) ---- */}
          <form action="/" method="get" className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
            {Object.entries(ctx.sp).filter(([k, v]) => v !== undefined && !['msg', 'ok', 'ed', 'cb', 'eq', 'en', 'email'].includes(k)).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <input type="hidden" name="email" value={template} />
            <div className="label sm:col-span-2">Adjust the email (updates the preview only)</div>
            <Field label="Designer" htmlFor="em-designer">
              <DesignerSelect key={effDesignerId} id="em-designer" name="ed" designers={designers} value={effDesignerId} blankLabel="Enquiry's designer" />
            </Field>
            <Field label="Callback by (IST)" htmlFor="em-cb" hint={prep.consultation ? 'Ignored while a consultation is booked.' : undefined}>
              <input key={cbValue} id="em-cb" type="datetime-local" name="cb" defaultValue={cbValue} className="field" />
            </Field>
            {template === 'clarification' && (
              <Field label="The one question (never about budget)" htmlFor="em-q" className="sm:col-span-2">
                <input id="em-q" name="eq" defaultValue={question} maxLength={300} className="field" placeholder="e.g. Is the flat ready for work, or still under construction?" />
              </Field>
            )}
            <Field label="Personal note (optional, linted for prices)" htmlFor="em-note" className="sm:col-span-2">
              <input id="em-note" name="en" defaultValue={note} maxLength={600} className="field" />
            </Field>
            <div className="sm:col-span-2"><button type="submit" className="btn">Update preview</button></div>
          </form>

          {/* ---- send (POST): exactly what the preview shows ---- */}
          <form action={sendClientEmailAction} className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <input type="hidden" name="enquiry_id" value={e.id} />
            <input type="hidden" name="template" value={template} />
            <input type="hidden" name="designer_id" value={effDesignerId} />
            <input type="hidden" name="callback" value={prep.consultation ? '' : cbValue} />
            <input type="hidden" name="question" value={template === 'clarification' ? question : ''} />
            <input type="hidden" name="note" value={note} />
            <ReturnTo value={ctx.returnTo} />
            <button type="submit" className="btn-solid" disabled={blockers.length > 0}>
              {mode === 'live' ? 'Send email to client' : 'Send (dry run, not delivered)'}
            </button>
            <span className="text-xs text-mute">
              {blockers.length > 0 ? 'Fix the blockers above first.' : 'Sends exactly the preview above. The email never contains a price.'}
              {mode === 'live' ? ' A real send also counts as the first response.' : ''}
            </span>
          </form>
        </>
      )}

      <details className="mt-4 border border-line" open={history.length > 0 && history.length <= 3}>
        <summary className="label px-3 py-2 hover:bg-raised hover:text-bone">Email history ({history.length})</summary>
        {history.length === 0 ? (
          <div className="p-3"><Empty>Nothing has been sent or dry-run for this enquiry yet.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th">When</th>
                  <th scope="col" className="th">Template</th>
                  <th scope="col" className="th">Status</th>
                  <th scope="col" className="th">By</th>
                  <th scope="col" className="th">Promised callback</th>
                </tr>
              </thead>
              <tbody>
                {history.map((m) => (
                  <tr key={m.id}>
                    <td className="td mono whitespace-nowrap text-xs">{formatDateTime(m.created_at)}</td>
                    <td className="td">
                      {titleCase(m.template)}
                      <div className="text-xs text-mute">{m.subject}</div>
                      {m.error && <div className="text-xs text-crit">{m.error}</div>}
                    </td>
                    <td className="td"><Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{m.status === 'dry_run' ? 'Dry run' : titleCase(m.status)}</Badge></td>
                    <td className="td text-xs">{m.sent_by ?? '—'}{m.designer_id ? <div className="text-mute">designer: {name(m.designer_id)}</div> : null}</td>
                    <td className="td mono text-xs">{m.callback_at ? formatDateTime(m.callback_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </Panel>
  );
}
