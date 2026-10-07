// Consultation calendar — designer-only. Week grid (Mon–Sun, IST), designer load, awaiting-outcome list, booking form.
// Server component: navigation is links (?week=, ?des=, ?slot=), mutations are server-action forms.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { bookConsultationAction, cancelConsultationAction, consultationStatusAction } from '@/app/actions';
import { BUSINESS_HOURS } from '@/lib/config';
import { isGoogleCalendarConfigured, outsideStudioHours, suggestSlots } from '@/lib/calendar';
import { formatDateTime, formatTime } from '@/lib/format';
import { isHubSpotConfigured } from '@/lib/hubspot';
import { dayKey, effectiveQualification } from '@/lib/metrics';
import type { ConsultationMode, ConsultationRow, DesignerRow, EnquiryRow } from '@/lib/types';
import { href } from '@/lib/url';
import { Badge, Bar, Empty, Kpi, Panel, ReturnTo, SectionHead, type Tone } from '../ui';
import type { ViewCtx } from '../types';

// ---------------------------------------------------------------------------------------------- vocab + date helpers

const TZ = BUSINESS_HOURS.tz;
const MODE_LABEL: Record<ConsultationMode, string> = { site_visit: 'Site visit', studio: 'Studio', call: 'Phone / video' };
const STATUS_LABEL: Record<ConsultationRow['status'], { label: string; tone: Tone }> = {
  scheduled: { label: 'Scheduled', tone: 'accent' },
  completed: { label: 'Held', tone: 'ok' },
  no_show: { label: 'No-show', tone: 'crit' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
const STATUS_RULE: Record<ConsultationRow['status'], string> = {
  scheduled: 'border-l-accent', completed: 'border-l-ok', no_show: 'border-l-crit', cancelled: 'border-l-line',
};
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// Calendar dates (no time zone of their own) are formatted from a noon-UTC anchor so they never slip a day.
const dayLabelFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const rangeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

const anchor = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const addDays = (ymd: string, n: number) => { const d = anchor(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekdayOf = (ymd: string) => anchor(ymd).getUTCDay();
const weekStartOf = (ymd: string) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));
/** 'YYYY-MM-DDTHH:mm' in IST, the value format of <input type="datetime-local">. */
const toLocalInput = (d: Date) => `${ymdFmt.format(d)}T${hmFmt.format(d)}`;
const isOpenDay = (ymd: string) => (BUSINESS_HOURS.openDays as readonly number[]).includes(weekdayOf(ymd));
const range = (c: ConsultationRow) => `${formatTime(new Date(c.starts_at))} – ${formatTime(new Date(c.ends_at))}`;
const enqName = (e: EnquiryRow | undefined, c: ConsultationRow) => e?.client_name ?? e?.source_ref ?? `Enquiry ${c.enquiry_id.slice(0, 6)}`;
const designerLabel = (d: DesignerRow) => `${d.name}${d.is_sample ? ' (sample)' : ''}`;
const byStart = (a: ConsultationRow, b: ConsultationRow) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();

// ---------------------------------------------------------------------------------------------- view

export function Calendar({ ctx }: { ctx: ViewCtx }) {
  const { ds, m, sp, now } = ctx;
  const visible = new Map(ds.enquiries.filter((e) => ctx.includeSynthetic || !e.is_synthetic).map((e) => [e.id, e]));
  const designers = new Map(ds.designers.map((d) => [d.id, d]));
  const consults = ds.consultations.filter((c) => visible.has(c.enquiry_id));

  // Week selection
  const parsed = Number.parseInt(sp.week ?? '0', 10);
  const offset = Number.isFinite(parsed) ? Math.max(-104, Math.min(104, parsed)) : 0;
  const today = ymdFmt.format(now);
  const monday = addDays(weekStartOf(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekLabel = `${dayLabelFmt.format(anchor(days[0]))} – ${rangeFmt.format(anchor(days[6]))}`;
  const weekHref = (o: number) => href(sp, { week: o === 0 ? null : String(o), slot: null });

  // Designer filter (des=<id> | none)
  const desParam = sp.des;
  const desActive = desParam === 'none' || (desParam !== undefined && designers.has(desParam)) ? desParam : null;
  const matchDes = (c: ConsultationRow) => !desActive || (desActive === 'none' ? !c.designer_id : c.designer_id === desActive);

  const inWeek = consults.filter((c) => days.includes(dayKey(c.starts_at)));
  const weekRows = inWeek.filter(matchDes).sort(byStart);
  const activeWeek = inWeek.filter((c) => c.status !== 'cancelled');
  const loadFor = (id: string | null) => activeWeek.filter((c) => c.designer_id === id).length;
  const activeDesigners = ds.designers.filter((d) => d.active);
  // Designers to chart: every active one plus anyone with a booking this week.
  const loadDesigners = ds.designers.filter((d) => d.active || loadFor(d.id) > 0);
  const maxLoad = Math.max(1, ...loadDesigners.map((d) => loadFor(d.id)), loadFor(null));

  // Panels that are not week-scoped
  const awaiting = consults.filter((c) => c.status === 'scheduled' && new Date(c.ends_at) < now).sort(byStart);
  const upcoming = consults
    .filter((c) => c.status === 'scheduled' && new Date(c.starts_at) >= now && new Date(c.starts_at).getTime() <= now.getTime() + 7 * 24 * 3_600_000)
    .sort(byStart);

  // Where the bookings are, for an intentional empty week.
  const nearest = weekRows.length === 0 && consults.length > 0
    ? [...consults].sort((a, b) => Math.abs(new Date(a.starts_at).getTime() - now.getTime()) - Math.abs(new Date(b.starts_at).getTime() - now.getTime()))[0]
    : null;
  const nearestOffset = nearest ? Math.round((anchor(weekStartOf(dayKey(nearest.starts_at))).getTime() - anchor(weekStartOf(today)).getTime()) / (7 * 86_400_000)) : null;

  const cal = m.calendar;
  const ctxLink = { ctx, visible, designers };

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ header + week nav */}
      <section>
        <SectionHead
          index="01"
          title="Consultation calendar"
          note={`Front desk hours ${BUSINESS_HOURS.openHour}am–${BUSINESS_HOURS.closeHour - 12}pm, Monday to Saturday (IST). Held and no-show marks feed the conversion numbers on the Results view.`}
          right={
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={weekHref(offset - 1)} className="btn-ghost" aria-label="Previous week">← Prev</Link>
              <Link href={weekHref(0)} className={offset === 0 ? 'btn-solid' : 'btn'} aria-current={offset === 0 ? 'date' : undefined}>This week</Link>
              <Link href={weekHref(offset + 1)} className="btn-ghost" aria-label="Next week">Next →</Link>
            </div>
          }
        />

        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="num text-2xl md:text-3xl">{weekLabel}</h3>
          <span className="label">
            {offset === 0 ? 'Current week' : offset > 0 ? `${offset} week${offset === 1 ? '' : 's'} ahead` : `${-offset} week${offset === -1 ? '' : 's'} back`}
            {' · '}{weekRows.filter((c) => c.status !== 'cancelled').length} consultation{weekRows.filter((c) => c.status !== 'cancelled').length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Designer filter + load strip */}
        <div className="panel mb-3 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="label mr-1">Designer</span>
            <Chip to={href(sp, { des: null })} active={!desActive}>All</Chip>
            {loadDesigners.map((d) => (
              <Chip key={d.id} to={href(sp, { des: d.id })} active={desActive === d.id}>{designerLabel(d)} <span className="tabular-nums opacity-80">({loadFor(d.id)})</span></Chip>
            ))}
            <Chip to={href(sp, { des: 'none' })} active={desActive === 'none'}>Unassigned <span className="tabular-nums opacity-80">({loadFor(null)})</span></Chip>
          </div>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Consultations per designer this week">
            {[...loadDesigners.map((d) => ({ key: d.id, name: designerLabel(d), n: loadFor(d.id), warn: false })), { key: 'none', name: 'Unassigned', n: loadFor(null), warn: true }]
              .filter((r) => r.key !== 'none' || r.n > 0)
              .map((r) => (
                <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_1.5rem] items-center gap-2 text-xs">
                  <span className={`truncate ${r.warn ? 'text-warn' : 'text-mute'}`}>{r.name}</span>
                  <Bar value={r.n} max={maxLoad} tone={r.warn ? 'warn' : 'accent'} label={`${r.name}: ${r.n} this week`} />
                  <span className="mono text-right">{r.n}</span>
                </li>
              ))}
          </ul>
          {loadDesigners.length === 0 && <p className="text-xs text-mute">No designers on file yet.</p>}
        </div>

        {/* Week grid: seven columns on wide screens, a day-by-day agenda below that */}
        <div className="grid grid-cols-1 gap-px border border-line bg-line xl:grid-cols-7" role="list" aria-label={`Week of ${weekLabel}`}>
          {days.map((ymd) => (
            <DayColumn key={ymd} ymd={ymd} isToday={ymd === today} rows={weekRows.filter((c) => dayKey(c.starts_at) === ymd)} {...ctxLink} />
          ))}
        </div>

        {weekRows.length === 0 && (
          <div className="mt-3 border border-dashed border-line px-4 py-5 text-sm">
            <p className="font-medium">{desActive ? 'No consultations for this designer in this week.' : 'No consultations booked this week.'}</p>
            <p className="mt-1 text-xs text-mute">
              Qualified leads are released to a designer from the Escalations and Enquiries views; book their consultation in the panel below and it lands here.
              {awaiting.length > 0 && ' Earlier consultations still need an outcome — see “Awaiting outcome”.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {desActive && <Link href={href(sp, { des: null })} className="btn-ghost">Show all designers</Link>}
              {nearest && nearestOffset !== null && nearestOffset !== offset && (
                <Link href={weekHref(nearestOffset)} className="btn">Jump to the week of {formatDateTime(nearest.starts_at).split(',')[0]}</Link>
              )}
              <a href="#book" className="btn-solid">Book a consultation</a>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ awaiting outcome */}
      <section aria-labelledby="awaiting-head">
        <SectionHead
          index="02"
          title="Awaiting outcome"
          note="The consultation time has passed but nobody has said whether it happened. This is how held and no-show numbers get filled in."
          right={<span id="awaiting-head" className={`label ${awaiting.length > 0 ? 'text-warn' : ''}`}>{awaiting.length} to mark</span>}
        />
        {awaiting.length === 0 ? (
          <Empty>All caught up — every past consultation has an outcome.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {awaiting.map((c) => (
              <li key={c.id} className="panel border-l-2 border-l-warn p-4">
                <div className="mono text-xs text-warn">{formatDateTime(c.starts_at)} · ended {formatTime(new Date(c.ends_at))}</div>
                <EnquiryLine c={c} enquiry={visible.get(c.enquiry_id)} ctx={ctx} />
                <div className="mt-1 text-xs text-mute">{designerOf(c, designers)} · {MODE_LABEL[c.mode]}</div>
                <StatusForms c={c} returnTo={ctx.returnTo} full />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ upcoming + tally */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHead index="03" title="Upcoming · next 7 days" right={<span className="label">{upcoming.length} scheduled</span>} />
          {upcoming.length === 0 ? (
            <Empty>Nothing scheduled in the next seven days. {cal.bookingRate !== null && <>So far {Math.round(cal.bookingRate * 100)}% of qualified leads this month have a consultation.</>}</Empty>
          ) : (
            <ul className="panel divide-y divide-line">
              {upcoming.map((c) => (
                <li key={c.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-4">
                  <div className="mono text-xs">{formatDateTime(c.starts_at)}</div>
                  <div className="min-w-0">
                    <EnquiryLine c={c} enquiry={visible.get(c.enquiry_id)} ctx={ctx} inline />
                    <div className="text-xs text-mute">{designerOf(c, designers)} · {MODE_LABEL[c.mode]}{c.location ? ` · ${c.location}` : ''}</div>
                  </div>
                  <Badge tone="accent">{range(c)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHead index="04" title={`Tally · ${m.monthLabel}`} note="Consultations starting in the selected month." />
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Scheduled" value={cal.scheduled} sub={`${cal.upcoming7d} in next 7 days`} />
            <Kpi label="Held" value={cal.completed} tone={cal.completed > 0 ? 'ok' : 'neutral'} />
            <Kpi label="No-show" value={cal.noShow} tone={cal.noShow > 0 ? 'crit' : 'neutral'} />
            <Kpi label="Cancelled" value={cal.cancelled} />
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ booking + integrations */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section id="book" className="scroll-mt-4">
          <SectionHead index="05" title="Book a consultation" note="Double-booking a designer is blocked. Bookings outside studio hours are allowed but flagged." />
          <BookingForm ctx={ctx} enquiries={bookable(ds.enquiries, consults, ctx.includeSynthetic)} designers={activeDesigners} desActive={desActive} />
        </section>

        <section className="space-y-6">
          <div>
            <SectionHead index="06" title="Next free slots" />
            <Slots ctx={ctx} designers={activeDesigners} desActive={desActive} consults={ds.consultations} />
          </div>
          <div>
            <SectionHead index="07" title="Integrations" />
            <Integrations />
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- week grid

const designerOf = (c: ConsultationRow, designers: Map<string, DesignerRow>): ReactNode => {
  const d = c.designer_id ? designers.get(c.designer_id) : undefined;
  return d ? <span>{d.name}</span> : <span className="text-warn">Unassigned</span>;
};

function Chip({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${active ? 'border-bone bg-bone text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
    >
      {children}
    </Link>
  );
}

function DayColumn({ ymd, isToday, rows, ctx, visible, designers }: {
  ymd: string; isToday: boolean; rows: ConsultationRow[]; ctx: ViewCtx; visible: Map<string, EnquiryRow>; designers: Map<string, DesignerRow>;
}) {
  const closed = !isOpenDay(ymd);
  const live = rows.filter((c) => c.status !== 'cancelled').length;
  return (
    <div
      role="listitem"
      className={`flex flex-col md:flex-row xl:flex-col ${closed ? 'bg-ink' : 'bg-panel'} ${isToday ? 'outline outline-1 -outline-offset-1 outline-accent' : ''}`}
      aria-label={`${WEEKDAY_LONG[weekdayOf(ymd)]} ${dayLabelFmt.format(anchor(ymd))}`}
    >
      <header className={`flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2 md:w-40 md:flex-col md:items-start md:border-b-0 md:border-r xl:w-auto xl:flex-row xl:items-center xl:border-b xl:border-r-0 ${isToday ? 'bg-accent/10' : ''}`}>
        <div>
          <div className={`label ${isToday ? 'text-accent' : ''}`}>{WEEKDAY_LONG[weekdayOf(ymd)].slice(0, 3)}</div>
          <div className="num text-2xl leading-none">{dayLabelFmt.format(anchor(ymd))}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {isToday && <Badge tone="accent">Today</Badge>}
          {closed && <Badge title="Front desk closed">Closed</Badge>}
          {live > 0 && <span className="mono text-[11px] text-mute">{live}</span>}
        </div>
      </header>
      <div className="min-h-[3.5rem] flex-1 space-y-2 p-2 xl:min-h-[11rem]">
        {rows.length === 0 ? (
          <p className="px-1 py-1 text-xs text-dim xl:py-3">{closed ? 'Closed — no bookings' : 'Free'}</p>
        ) : (
          rows.map((c) => <ConsultCard key={c.id} c={c} enquiry={visible.get(c.enquiry_id)} designers={designers} ctx={ctx} />)
        )}
      </div>
    </div>
  );
}

function ConsultCard({ c, enquiry, designers, ctx }: { c: ConsultationRow; enquiry: EnquiryRow | undefined; designers: Map<string, DesignerRow>; ctx: ViewCtx }) {
  const cancelled = c.status === 'cancelled';
  const status = STATUS_LABEL[c.status];
  const afterHours = outsideStudioHours(new Date(c.starts_at));
  return (
    <article className={`border border-line border-l-2 bg-raised/60 p-2.5 ${STATUS_RULE[c.status]} ${cancelled ? 'opacity-60' : ''}`}>
      <div className={`mono text-xs font-medium ${cancelled ? 'line-through' : ''}`}>{range(c)}</div>
      <div className={`mt-0.5 ${cancelled ? 'line-through' : ''}`}>
        <EnquiryLine c={c} enquiry={enquiry} ctx={ctx} inline />
      </div>
      {c.location && <div className="truncate text-xs text-mute" title={c.location}>{c.location}</div>}
      <div className="mt-1 text-xs">{designerOf(c, designers)}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge tone="info">{MODE_LABEL[c.mode]}</Badge>
        {c.status !== 'scheduled' && <Badge tone={status.tone}>{status.label}</Badge>}
        {afterHours && !cancelled && <Badge tone="warn" title="Outside front-desk hours (10am–7pm, Mon–Sat)">Off-hours</Badge>}
      </div>
      {c.status === 'scheduled' && <StatusForms c={c} returnTo={ctx.returnTo} />}
    </article>
  );
}

function EnquiryLine({ c, enquiry, ctx, inline }: { c: ConsultationRow; enquiry: EnquiryRow | undefined; ctx: ViewCtx; inline?: boolean }) {
  return (
    <div className={inline ? '' : 'mt-1'}>
      <Link href={href(ctx.sp, { view: 'queue', enquiry: c.enquiry_id })} className="text-sm font-medium underline decoration-line underline-offset-2 hover:text-accent">
        {enqName(enquiry, c)}
      </Link>
      {!inline && (enquiry?.location ?? c.location) && <span className="ml-2 text-xs text-mute">{enquiry?.location ?? c.location}</span>}
    </div>
  );
}

/** Mark held / No-show / Cancel. Only rendered for scheduled consultations. */
function StatusForms({ c, returnTo, full }: { c: ConsultationRow; returnTo: string; full?: boolean }) {
  const btn = full ? 'btn' : 'btn !px-2 !py-1 !text-[10px]';
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <form action={consultationStatusAction}>
        <ReturnTo value={returnTo} />
        <input type="hidden" name="consultation_id" value={c.id} />
        <button type="submit" name="status" value="completed" className={full ? 'btn-solid' : `${btn} border-ok/70 text-ok hover:!bg-ok hover:!text-ink`} title="Mark held">{full ? 'Mark held' : 'Held'}</button>
      </form>
      <form action={consultationStatusAction}>
        <ReturnTo value={returnTo} />
        <input type="hidden" name="consultation_id" value={c.id} />
        <button type="submit" name="status" value="no_show" className={btn} title="Mark no-show">No-show</button>
      </form>
      <form action={cancelConsultationAction}>
        <ReturnTo value={returnTo} />
        <input type="hidden" name="consultation_id" value={c.id} />
        <button type="submit" className={full ? 'btn-danger' : 'btn-danger !px-2 !py-1 !text-[10px]'} title="Cancel this consultation (removes the Google Calendar event if synced)">Cancel</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- booking

/** Qualified, still-live enquiries that have no scheduled or held consultation yet. */
function bookable(enquiries: EnquiryRow[], consults: ConsultationRow[], includeSynthetic: boolean): EnquiryRow[] {
  const taken = new Set(consults.filter((c) => c.status === 'scheduled' || c.status === 'completed').map((c) => c.enquiry_id));
  return enquiries
    .filter((e) => (includeSynthetic || !e.is_synthetic) && effectiveQualification(e) === 'qualified' && !['won', 'lost', 'closed'].includes(e.status) && !taken.has(e.id))
    .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
    .slice(0, 200);
}

function BookingForm({ ctx, enquiries, designers, desActive }: { ctx: ViewCtx; enquiries: EnquiryRow[]; designers: DesignerRow[]; desActive: string | null }) {
  const { sp, now } = ctx;
  if (enquiries.length === 0) {
    return (
      <Empty>
        No qualified enquiry is waiting for a consultation. Qualify a lead in the{' '}
        <Link className="text-accent underline" href={href(sp, { view: 'escalations' })}>Escalations</Link> or{' '}
        <Link className="text-accent underline" href={href(sp, { view: 'queue' })}>Enquiries</Link> view and it will show up here.
      </Empty>
    );
  }
  const slot = sp.slot && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(sp.slot) ? sp.slot : undefined;
  const preselect = sp.book && enquiries.some((e) => e.id === sp.book) ? sp.book : undefined;
  const defaultDesigner = desActive && desActive !== 'none' && designers.some((d) => d.id === desActive) ? desActive : '';
  const f = 'flex flex-col gap-1';
  return (
    <form action={bookConsultationAction} className="panel space-y-4 p-4">
      <ReturnTo value={ctx.returnTo} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${f} sm:col-span-2`}>
          <span className="label">Enquiry (qualified, not yet booked)</span>
          <select name="enquiry_id" required defaultValue={preselect ?? ''} className="field">
            <option value="" disabled>Choose an enquiry…</option>
            {enquiries.map((e) => (
              <option key={e.id} value={e.id}>{e.client_name ?? e.source_ref ?? e.id.slice(0, 6)} — {e.location ?? 'location not stated'}</option>
            ))}
          </select>
        </label>
        <label className={f}>
          <span className="label">Designer</span>
          <select name="designer_id" defaultValue={defaultDesigner} className="field">
            <option value="">Unassigned (assign later)</option>
            {designers.map((d) => <option key={d.id} value={d.id}>{designerLabel(d)}</option>)}
          </select>
        </label>
        <label className={f}>
          <span className="label">Mode</span>
          <select name="mode" defaultValue="site_visit" className="field">
            <option value="site_visit">Site visit</option>
            <option value="studio">Studio</option>
            <option value="call">Phone / video call</option>
          </select>
        </label>
        <label className={f}>
          <span className="label">Start (IST)</span>
          <input type="datetime-local" name="start" required defaultValue={slot} min={toLocalInput(now)} className="field" />
        </label>
        <label className={f}>
          <span className="label">Length (minutes)</span>
          <input type="number" name="minutes" defaultValue={60} min={15} max={240} step={15} className="field" />
        </label>
        <label className={`${f} sm:col-span-2`}>
          <span className="label">Location (defaults to the enquiry&rsquo;s)</span>
          <input type="text" name="location" className="field" placeholder="Site address, studio, or video link" />
        </label>
        <label className={`${f} sm:col-span-2`}>
          <span className="label">Notes for the designer</span>
          <textarea name="notes" rows={2} className="field" placeholder="Access details, who will be at site, anything the brief missed" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="max-w-md text-xs text-mute">The booking is added to Google Calendar when it is connected, and the client&rsquo;s confirmation email carries an .ics calendar file.</p>
        <button type="submit" className="btn-solid">Book consultation</button>
      </div>
    </form>
  );
}

function Slots({ ctx, designers, desActive, consults }: { ctx: ViewCtx; designers: DesignerRow[]; desActive: string | null; consults: ConsultationRow[] }) {
  const designer = designers.find((d) => d.id === desActive) ?? designers[0];
  if (!designer) return <Empty>Add an active designer to see suggested slots.</Empty>;
  const slots = suggestSlots(designer.id, ctx.now, consults, 6);
  return (
    <Panel title={<>For {designerLabel(designer)}</>} right={<span className="label">Pick one to prefill the form</span>}>
      {slots.length === 0 ? (
        <p className="text-sm text-mute">No free slots in the next three weeks.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <li key={s.toISOString()}>
              <Link href={`${href(ctx.sp, { des: designer.id, slot: toLocalInput(s) })}#book`} className="btn">{formatDateTime(s)}</Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-mute">Suggestions are for orientation: four slots a day, Mon–Sat, skipping this designer&rsquo;s existing bookings. Filter the calendar by another designer to see theirs.</p>
    </Panel>
  );
}

function Integrations() {
  const google = isGoogleCalendarConfigured();
  const hubspot = isHubSpotConfigured();
  const Row = ({ name, ok, onText, offText, offTone = 'warn' }: { name: string; ok: boolean; onText: string; offText: string; offTone?: Tone }) => (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-mute">{ok ? onText : offText}</div>
      </div>
      <Badge tone={ok ? 'ok' : offTone}>{ok ? 'Connected' : 'Not configured'}</Badge>
    </li>
  );
  return (
    <ul className="panel divide-y divide-line">
      <Row name="Google Calendar" ok={google} onText="New bookings are created on the studio calendar; cancelling removes the event." offText="Bookings are saved here only. Add the Google credentials to sync." />
      <li className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <div className="text-sm font-medium">Client .ics invite</div>
          <div className="text-xs text-mute">Attached to every confirmation email, so it lands in whatever calendar the client uses.</div>
        </div>
        <Badge tone="ok">Always on</Badge>
      </li>
      <Row name="HubSpot deal stage" ok={hubspot} onText="Deal stage follows booking, held and cancelled." offText="CRM sync is off; nothing is written to HubSpot." offTone="neutral" />
    </ul>
  );
}
