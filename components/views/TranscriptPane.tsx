// Transcript inspector: raw vs processed text side by side, speaker labels, uncertainty markers, AI cost, extracted entities.

import { Badge, Empty, Panel } from '@/components/ui';
import { pct, titleCase } from '@/lib/format';
import { findAgentPriceDisclosures } from '@/lib/pricing';
import { KV, type InspectorData } from './inspector-kit';

// "Front Desk: …", "Caller: …", "4 Sept, 11:47am — Front Desk: …", form rows like "How did you find us: …".
const LINE = /^((?:\d{1,2}\s+\w+,?\s+[\d:]+\s*[apAP][mM]\s*[—-]\s*)?)([A-Z][^:\n—]{0,31}):\s?(.*)$/;
const STUDIO_LABEL = /^(front desk|agent|assistant|ai agent|vaani|vani|aangan|aangan studio|studio)\b/i;
const MARKER = /(\[inaudible\]|\[uncertain[^\]]*\])/gi;

interface ParsedLine { stamp: string; label: string | null; body: string; studio: boolean }

function parseLine(line: string): ParsedLine {
  const m = LINE.exec(line);
  if (!m || /^https?/i.test(m[2].trim())) return { stamp: '', label: null, body: line, studio: false };
  const label = m[2].trim();
  return { stamp: m[1].trim(), label, body: m[3], studio: STUDIO_LABEL.test(label) };
}

function Marked({ text }: { text: string }) {
  const parts = text.split(MARKER);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="border-b border-warn bg-warn/20 px-0.5 font-mono text-warn" title="Low-confidence span">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Pane({ title, sub, text, offenders }: { title: string; sub: string; text: string; offenders: Set<string> }) {
  const lines = text.split(/\r?\n/);
  const markers = (text.match(MARKER) ?? []).length;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h4 className="label text-bone">{title}</h4>
        <span className="mono text-[11px] text-mute">{sub}{markers ? ` · ${markers} uncertain` : ''}</span>
      </div>
      <div className="scroll-thin max-h-[420px] overflow-y-auto border border-line bg-ink p-3 text-sm leading-relaxed" tabIndex={0} role="region" aria-label={`${title} transcript`}>
        {lines.map((raw, i) => {
          if (!raw.trim()) return <div key={i} className="h-2" />;
          const p = parseLine(raw);
          const quoted = p.studio && offenders.has(raw.trim().slice(0, 240));
          return (
            <div
              key={i}
              className={`mb-1 border-l-2 pl-2 ${quoted ? 'border-crit bg-crit/10' : p.studio ? 'border-accent/70' : p.label ? 'border-info/50' : 'border-transparent'}`}
            >
              {p.stamp && <span className="mono mr-1.5 text-[11px] text-mute">{p.stamp}</span>}
              {p.label && <strong className={`mr-1.5 font-mono text-xs uppercase tracking-wide ${p.studio ? 'text-accent' : 'text-info'}`}>{p.label}:</strong>}
              <span className={p.studio ? 'text-bone' : 'text-bone/90'}><Marked text={p.body} /></span>
              {quoted && <span className="ml-2 inline-block align-middle"><Badge tone="crit">Quoted a price</Badge></span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function scalar(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const SKIP_ENTITY_KEYS = new Set(['field_confidence', 'criteria', 'criteria_notes']);

export function TranscriptPanel({ d }: { d: InspectorData }) {
  const { e, tr, escs } = d;
  const hasText = Boolean(tr && tr.raw_text.trim());

  if (!tr || !hasText) {
    const missed = e.call_outcome === 'missed' || e.call_outcome === 'dropped';
    return (
      <Panel title="Transcript inspector">
        <Empty>
          <strong className="text-bone">No conversation.</strong>{' '}
          {missed
            ? `This was a ${e.call_outcome} call, so there is no audio, no transcript and nothing for the AI to extract. Call the number back and record the first response.`
            : 'No transcript is stored for this enquiry, so there is no raw or processed text to compare.'}
        </Empty>
      </Panel>
    );
  }

  const breach = escs.some((x) => x.trigger === 'agent_policy_breach');
  const offenders = new Set(breach ? [...findAgentPriceDisclosures(tr.raw_text), ...findAgentPriceDisclosures(tr.processed_text ?? '')] : []);
  const hasProcessed = Boolean(tr.processed_text && tr.processed_text.trim());
  const dur = tr.duration_seconds ?? e.call_duration_seconds;
  const entities = tr.extraction ? Object.entries(tr.extraction).filter(([k]) => !SKIP_ENTITY_KEYS.has(k)) : [];
  const conf = tr.field_confidence && Object.keys(tr.field_confidence).length ? tr.field_confidence : tr.extraction?.field_confidence ?? {};

  return (
    <Panel
      title="Transcript inspector"
      right={<Badge tone="neutral">{tr.source === 'audio' ? 'Audio transcription' : tr.source === 'form' ? 'Web form text' : 'Chat text'}</Badge>}
    >
      {breach && (
        <div className="mb-3 border border-crit/60 bg-crit/10 px-3 py-2 text-sm">
          <span className="label mr-2 text-crit">Policy breach</span>
          <span className="text-bone">
            The studio side may have quoted a price. {offenders.size > 0
              ? `${offenders.size} line${offenders.size === 1 ? ' is' : 's are'} highlighted below.`
              : 'No single line matched the price pattern; read the studio lines below.'}
          </span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
        <span><span className="label mr-1">Studio</span><span className="mono text-accent">Front Desk:</span></span>
        <span><span className="label mr-1">Prospect</span><span className="mono text-info">Caller:</span></span>
        <span><mark className="border-b border-warn bg-warn/20 px-0.5 font-mono text-warn">[inaudible]</mark> low-confidence span</span>
      </div>

      <div className={`grid gap-4 ${hasProcessed ? 'xl:grid-cols-2' : ''}`}>
        <Pane title="Raw (verbatim)" sub={`${tr.raw_text.length.toLocaleString('en-IN')} chars`} text={tr.raw_text} offenders={offenders} />
        {hasProcessed && <Pane title="Processed (cleaned)" sub="normalised for extraction" text={tr.processed_text as string} offenders={offenders} />}
      </div>
      {!hasProcessed && <p className="mt-2 text-xs text-mute">No separate processed version: the source text was already clean, so extraction ran on the raw text.</p>}

      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <KV k="Language">{tr.language ?? '—'}</KV>
        <KV k="Duration">{dur ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')} min` : '—'}</KV>
        <KV k="Model">{tr.model ?? '—'}</KV>
        <KV k="Tokens in / out">{tr.input_tokens !== null || tr.output_tokens !== null ? `${tr.input_tokens ?? 0} / ${tr.output_tokens ?? 0}` : '—'}</KV>
        <KV k="AI cost">{`₹${tr.ai_cost_inr.toFixed(2)}`}</KV>
        <KV k="Stored">{tr.audio_url ? 'audio on file' : 'text only'}</KV>
      </dl>

      {entities.length > 0 && (
        <details className="mt-4 border border-line">
          <summary className="label flex items-center justify-between px-3 py-2 hover:bg-raised hover:text-bone">
            <span>Extracted entities ({entities.length})</span>
            <span className="text-dim">expand</span>
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th">Field</th>
                  <th scope="col" className="th">Extracted value</th>
                  <th scope="col" className="th text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(([k, v]) => {
                  const c = conf[k];
                  return (
                    <tr key={k}>
                      <th scope="row" className="td whitespace-nowrap text-left font-mono text-xs font-normal text-mute">{titleCase(k)}</th>
                      <td className="td break-words text-bone">{scalar(v)}</td>
                      <td className={`td mono text-right text-xs ${c === undefined ? 'text-dim' : c < 0.85 ? 'text-crit' : 'text-ok'}`}>{c === undefined ? '—' : pct(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Panel>
  );
}
