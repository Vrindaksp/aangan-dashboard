// Consultation (calendar) panel: this enquiry's bookings, quick-pick slots, booking form.

import Link from 'next/link';
import { bookConsultationAction, cancelConsultationAction, consultationStatusAction } from '@/app/actions';
import { Badge, Empty, Panel, ReturnTo, type Tone } from '@/components/ui';
import { CONSULT_MINUTES, outsideStudioHours, suggestSlots } from '@/lib/calendar';
import { formatDateTime, titleCase } from '@/lib/format';
import { href } from '@/lib/url';
import type { ConsultationStatus } from '@/lib/types';
import { DesignerSelect, Field, istInput, parseIso, type InspectorData } from './inspector-kit';

const STATUS_TONE: Record<ConsultationStatus, Tone> = { scheduled: 'info', completed: 'ok', cancelled: 'neutral', no_show: 'crit' };
const MODE_LABEL = { site_visit: 'Site visit', studio: 'At studio', call: 'Phone / video call' } as const;

export function ConsultationPanel({ d }: { d: InspectorData }) {
  const { ctx, e, designers } = d;
  const mine = ctx.ds.consultations.filter((c) => c.enquiry_id === e.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const name = (id: string | null) => designers.find((x) => x.id === id)?.name ?? 'No designer';

  const designerId = (ctx.sp.sd && designers.some((x) => x.id === ctx.sp.sd) ? ctx.sp.sd : null) ?? e.designer_id ?? null;
  const slots = suggestSlots(designerId, ctx.now, ctx.ds.consultations, 6);
  const picked = parseIso(ctx.sp.slot);
  const slotLink = (patch: Record<string, string | null>) => `${href(ctx.sp, patch)}#consult`;
  const hasScheduled = mine.some((c) => c.status === 'scheduled');

  return (
    <Panel title="Consultation" right={hasScheduled ? <Badge tone="info">Booked</Badge> : <Badge>None scheduled</Badge>}>
      {mine.length === 0 ? (
        <Empty>No consultation booked yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {mine.map((c) => (
            <li key={c.id} className="border border-line bg-ink p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-sm text-bone">{formatDateTime(c.starts_at)}</span>
                <Badge tone={STATUS_TONE[c.status]}>{titleCase(c.status)}</Badge>
                <Badge>{MODE_LABEL[c.mode]}</Badge>
                {outsideStudioHours(new Date(c.starts_at)) && <Badge tone="warn">Outside studio hours</Badge>}
                {c.google_event_id && <Badge tone="ok" title="Event exists on the studio Google Calendar">On Google Calendar</Badge>}
              </div>
              <div className="mt-1 text-xs text-mute">
                {name(c.designer_id)}{c.location ? ` · ${c.location}` : ''}{c.notes ? ` · ${c.notes}` : ''}
              </div>
              {c.status === 'scheduled' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={consultationStatusAction} className="flex gap-2">
                    <input type="hidden" name="consultation_id" value={c.id} />
                    <ReturnTo value={ctx.returnTo} />
                    <button type="submit" name="status" value="completed" className="btn">Mark held</button>
                    <button type="submit" name="status" value="no_show" className="btn-ghost">Mark no-show</button>
                  </form>
                  <form action={cancelConsultationAction}>
                    <input type="hidden" name="consultation_id" value={c.id} />
                    <ReturnTo value={ctx.returnTo} />
                    <button type="submit" className="btn-danger">Cancel</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="label mb-1.5">Suggested slots{designerId ? ` for ${name(designerId)}` : ' (pick a designer to check clashes)'}</div>
        {designers.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-mute">For:</span>
            {designers.map((x) => (
              <Link
                key={x.id}
                href={slotLink({ sd: x.id, slot: null })}
                aria-current={x.id === designerId ? 'true' : undefined}
                className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${x.id === designerId ? 'border-accent text-accent' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
              >
                {x.name}{x.is_sample ? ' (sample)' : ''}
              </Link>
            ))}
          </div>
        )}
        {slots.length === 0 ? (
          <p className="text-xs text-mute">No open slots in the next three weeks.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {slots.map((s) => {
              const iso = s.toISOString();
              const on = picked?.getTime() === s.getTime();
              return (
                <li key={iso}>
                  <Link
                    href={slotLink({ slot: iso, sd: designerId })}
                    aria-current={on ? 'true' : undefined}
                    className={`inline-block border px-2.5 py-1 font-mono text-xs ${on ? 'border-accent bg-accent text-ink' : 'border-line text-bone hover:border-bone'}`}
                  >
                    {formatDateTime(s)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-mute">Click a slot to fill the form below. Slots are Mon to Sat, 4 a day, and skip anything the designer already has.</p>
      </div>

      <form action={bookConsultationAction} className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
        <input type="hidden" name="enquiry_id" value={e.id} />
        <ReturnTo value={ctx.returnTo} />
        <Field label="Designer" htmlFor="book-designer">
          <DesignerSelect key={designerId ?? "none"} id="book-designer" name="designer_id" designers={designers} value={designerId} blankLabel="No designer yet" />
        </Field>
        <Field label="Start (IST)" htmlFor="book-start">
          <input key={picked ? picked.toISOString() : "none"} id="book-start" type="datetime-local" name="start" required defaultValue={picked ? istInput(picked) : ''} className="field" />
        </Field>
        <Field label="Minutes" htmlFor="book-min">
          <input id="book-min" type="number" name="minutes" min={15} max={240} step={15} defaultValue={CONSULT_MINUTES} className="field" />
        </Field>
        <Field label="Mode" htmlFor="book-mode">
          <select id="book-mode" name="mode" defaultValue="site_visit" className="field">
            <option value="site_visit">Site visit</option>
            <option value="studio">At studio</option>
            <option value="call">Phone / video call</option>
          </select>
        </Field>
        <Field label="Location" htmlFor="book-loc" className="sm:col-span-2">
          <input id="book-loc" name="location" defaultValue={e.location ?? ''} placeholder="Site address or studio" className="field" />
        </Field>
        <Field label="Notes" htmlFor="book-notes" className="sm:col-span-2">
          <input id="book-notes" name="notes" maxLength={300} placeholder="Anything the designer should know" className="field" />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-solid">Book consultation</button>
          <p className="mt-2 text-xs text-mute">
            Double-booking the same designer is blocked. Times outside studio hours are allowed but flagged. When Google Calendar is configured the booking also syncs to the studio calendar,
            and the client gets the .ics file with the confirmation email.
          </p>
        </div>
      </form>
    </Panel>
  );
}
