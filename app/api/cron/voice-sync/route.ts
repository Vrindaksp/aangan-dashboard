import { checkBearer } from '@/lib/auth';
import { processEnquiry } from '@/lib/pipeline';
import { vaani } from '@/lib/voice/vaani';
import { fetchRecording } from '@/lib/voice/fetch-recording';
import type { VoiceProvider } from '@/lib/voice/provider';

export const runtime = 'nodejs';
export const maxDuration = 300;

const PROVIDERS: VoiceProvider[] = [vaani];

/**
 * Pull job: asks each configured voice provider for calls that finished since the last run and sends each through
 * the intake pipeline. Safe to run repeatedly — enquiries are de-duplicated on `${provider}:${callId}`.
 * `?since=2026-10-07T09:00:00Z` overrides the default look-back (6 hours).
 */
export async function GET(req: Request) {
  if (!checkBearer(req, process.env.CRON_SECRET ?? process.env.INGEST_API_KEY)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const configured = PROVIDERS.filter((p) => p.isConfigured());
  if (configured.length === 0) {
    return Response.json({ error: 'No voice provider configured', hint: 'Vaani Labs API integration is pending — see lib/voice/vaani.ts' }, { status: 501 });
  }

  const sinceParam = new URL(req.url).searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 6 * 3_600_000);
  const summary: Record<string, { pulled: number; created: number; duplicates: number; errors: string[] }> = {};

  for (const provider of configured) {
    const s: { pulled: number; created: number; duplicates: number; errors: string[] } = (summary[provider.name] = { pulled: 0, created: 0, duplicates: 0, errors: [] as string[] });
    let calls;
    try {
      calls = await provider.listCalls(since);
    } catch (err) {
      s.errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }
    s.pulled = calls.length;
    for (const c of calls) {
      try {
        let audio;
        if (!c.transcript && c.recordingUrl && c.outcome === 'completed') audio = await fetchRecording(c.recordingUrl);
        const r = await processEnquiry({
          channel: 'phone', sourceRef: `${provider.name}:${c.callId}`, receivedAt: c.startedAt, callerPhone: c.callerNumber,
          text: c.transcript ?? undefined, audio, audioUrl: c.recordingUrl, durationSec: c.durationSec, language: c.language,
          sttConfidence: c.sttConfidence, callOutcome: c.outcome === 'completed' ? 'answered' : c.outcome === 'missed' ? 'missed' : 'dropped',
          firstResponseAt: c.outcome === 'completed' ? c.startedAt : null,
        });
        if (r.duplicate) s.duplicates++; else s.created++;
      } catch (err) {
        s.errors.push(`${c.callId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return Response.json({ since: since.toISOString(), summary });
}
