// Builds the full seed dataset from the 40 real September-2026 enquiries (through the SAME guardrail engine
// production uses), plus the designer directory, a calendar entry the source mentions, and monthly tool costs.
// Used by scripts/seed.ts (writes to Supabase) and by demo mode (held in memory).

import { randomUUID } from 'node:crypto';
import { buildRecords } from '../lib/records';
import type {
  ConsultationRow, DesignerRow, EnquiryRow, EscalationRow, OutboundEmailRow, PricingLogRow, ToolCostRow, TranscriptRow,
} from '../lib/types';
import { SEPT_2026, toExtraction } from './sept-2026-enquiries';
import { buildSynthetic } from './synthetic';

export interface SeedDataset {
  designers: DesignerRow[];
  enquiries: EnquiryRow[];
  transcripts: TranscriptRow[];
  pricingLogs: PricingLogRow[];
  escalations: EscalationRow[];
  consultations: ConsultationRow[];
  outboundEmails: OutboundEmailRow[];
  toolCosts: ToolCostRow[];
}

const ist = (s: string) => new Date(s.replace(' ', 'T') + ':00+05:30');

/**
 * Designer directory. "Aryan" is named in the source (T09); the rest are PLACEHOLDERS (is_sample) with reserved
 * .example emails / fake numbers so nothing can ever be sent to them. Replace with the real 14 designers.
 */
export function sampleDesigners(now: Date): DesignerRow[] {
  const mk = (name: string, role: DesignerRow['role'], i: number, sample: boolean): DesignerRow => ({
    id: randomUUID(), name, role, active: true, is_sample: sample, created_at: now.toISOString(),
    email: sample ? `designer${i}@aangan.example` : null,
    phone: sample ? `+91 90000 000${String(i).padStart(2, '0')}` : null,
  });
  return [
    mk('Aryan', 'senior_designer', 0, false),
    mk('Sample Designer A', 'designer', 1, true),
    mk('Sample Designer B', 'designer', 2, true),
    mk('Sample Designer C', 'designer', 3, true),
    mk('Sample Designer D', 'senior_designer', 4, true),
    mk('Sample Principal', 'principal', 5, true),
  ];
}

/** Fixed monthly costs of running the system (₹). ESTIMATES — replace with real invoices. */
export function sampleToolCosts(month: string, now: Date): ToolCostRow[] {
  const mk = (category: string, vendor: string, amount: number, note: string): ToolCostRow => ({
    id: randomUUID(), month, category, vendor, amount_inr: amount, note, created_at: now.toISOString(),
  });
  return [
    mk('Hosting', 'Vercel Pro', 1760, 'Estimate: US$20/mo × ₹88'),
    mk('Database', 'Supabase Pro', 2200, 'Estimate: US$25/mo × ₹88'),
    mk('Voice agent', 'Vaani Labs', 0, 'Enter the real Vaani Labs invoice (minutes + platform fee)'),
    mk('CRM', 'HubSpot', 0, 'Enter the real HubSpot seat cost, if it is attributable to this system'),
  ];
}

export function buildRealDataset(now: Date = new Date()): SeedDataset {
  const designers = sampleDesigners(now);
  const enquiries: EnquiryRow[] = [];
  const transcripts: TranscriptRow[] = [];
  const pricingLogs: PricingLogRow[] = [];
  const escalations: EscalationRow[] = [];
  const consultations: ConsultationRow[] = [];

  for (const r of SEPT_2026) {
    const b = buildRecords({
      sourceRef: r.ref,
      channel: r.channel,
      receivedAt: ist(r.at),
      callOutcome: r.callOutcome ?? null,
      durationSec: r.durationSec ?? null,
      firstResponseAt: r.respondedAt ? ist(r.respondedAt) : null,
      responseNote: r.responseNote ?? null,
      rawText: r.raw,
      processedText: r.processed ?? null,
      language: r.language ?? 'en',
      extraction: toExtraction(r),
      sourceStatus: r.sourceStatus ?? null,
      now,
    });
    enquiries.push(b.enquiry);
    if (b.transcript) transcripts.push(b.transcript);
    if (b.pricing) pricingLogs.push(b.pricing);
    escalations.push(...b.escalations);

    // W03: the thread itself confirms a site-visit consultation (Saturday 4 October, 10:30am). The other
    // visits mentioned (T05, T12, W06) are only pencilled in, so they are NOT seeded as bookings.
    if (r.ref === 'W03') {
      const start = ist('2026-10-04 10:30');
      consultations.push({
        id: randomUUID(), enquiry_id: b.enquiry.id, designer_id: null, starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 3_600_000).toISOString(), mode: 'site_visit', location: 'Pimple Nilakh, PCMC',
        status: 'scheduled', notes: 'Confirmed by the prospect on WhatsApp (12 Sept). Designer not yet assigned.',
        google_event_id: null, ics_uid: randomUUID(), created_by: 'seed', created_at: ist('2026-09-12 11:42').toISOString(),
      });
    }
  }

  const toolCosts = sampleToolCosts('2026-09-01', now);
  return { designers, enquiries, transcripts, pricingLogs, escalations, consultations, outboundEmails: [], toolCosts };
}

/**
 * Real dataset, optionally padded with `synthetic` simulated September enquiries (flagged is_synthetic) so a month
 * reaches ~200 and every metric has data. Demo mode reads DEMO_SYNTHETIC; the seed script reads --synthetic.
 */
export function buildDataset(now: Date = new Date(), synthetic = 0, month = '2026-09'): SeedDataset {
  const d = buildRealDataset(now);
  if (synthetic > 0) {
    const s = buildSynthetic(synthetic, month, now, d.designers);
    d.enquiries.push(...s.enquiries);
    d.transcripts.push(...s.transcripts);
    d.pricingLogs.push(...s.pricingLogs);
    d.escalations.push(...s.escalations);
    d.consultations.push(...s.consultations);
  }
  return d;
}
