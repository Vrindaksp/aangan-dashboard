// The enquiry inspector: loads everything for one enquiry once, then lays out the panels.
// Designer-only. Per-person data lives here, so it refuses to render for any other role.

import { Empty } from '@/components/ui';
import type { ViewCtx } from '@/components/types';
import { getStore } from '@/lib/store';
import type { EnquiryRow } from '@/lib/types';
import { BriefPanel, PricingPanel } from './BriefPanel';
import { ClientEmailPanel } from './ClientEmailPanel';
import { ConsultationPanel } from './ConsultationPanel';
import { GatePanel, InspectorBar, OverviewPanel } from './InspectorHeader';
import { Anchor, type InspectorData } from './inspector-kit';
import { OutcomePanel } from './OutcomePanel';
import { EscalationsPanel, RubricPanel } from './RubricPanel';
import { TranscriptPanel } from './TranscriptPane';

export async function Inspector({ ctx, e }: { ctx: ViewCtx; e: EnquiryRow }) {
  if (ctx.role !== 'designer') return <Empty>Enquiry detail is for designers only.</Empty>;
  const store = getStore();
  const [tr, escs, pricing, designers] = await Promise.all([
    store.transcriptFor(e.id), store.escalationsFor(e.id), store.getPricing(e.id), store.listDesigners(),
  ]);
  const d: InspectorData = { ctx, e, tr, escs, pricing, designers };

  return (
    <div className="space-y-4">
      <InspectorBar d={d} />
      <OverviewPanel d={d} />
      <Anchor id="gate"><GatePanel d={d} /></Anchor>
      <Anchor id="transcript"><TranscriptPanel d={d} /></Anchor>
      <Anchor id="rubric"><RubricPanel d={d} /></Anchor>
      <Anchor id="escalations"><EscalationsPanel d={d} /></Anchor>
      <Anchor id="brief"><BriefPanel d={d} /></Anchor>
      <Anchor id="pricing"><PricingPanel d={d} /></Anchor>
      <Anchor id="consult"><ConsultationPanel d={d} /></Anchor>
      <Anchor id="email"><ClientEmailPanel d={d} /></Anchor>
      <Anchor id="outcome"><OutcomePanel d={d} /></Anchor>
    </div>
  );
}
