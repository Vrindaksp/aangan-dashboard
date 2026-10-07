// Vaani Labs voice agent — API integration.
//
// STATUS: placeholder. This integration uses Vaani Labs' REST API (pull), NOT webhooks. The API reference has not
// been supplied yet, so nothing here guesses endpoints, auth headers or response shapes. When the reference
// arrives, implement `listCalls` below (one HTTP call + one mapping to `ProviderCall`) — everything downstream
// (transcription fallback, extraction, guardrails, escalations, HubSpot, calendar) already works.
//
// Env (names provisional): VAANI_API_KEY, VAANI_BASE_URL

import type { ProviderCall, VoiceProvider } from './provider';

export const vaani: VoiceProvider = {
  name: 'vaani',

  isConfigured() {
    return Boolean(process.env.VAANI_API_KEY && process.env.VAANI_BASE_URL);
  },

  async listCalls(_since: Date): Promise<ProviderCall[]> {
    // TODO(vaani-api): call the "list calls" endpoint with `Authorization: Bearer ${VAANI_API_KEY}`, filter by
    // end time > _since, and map each call to ProviderCall:
    //   callId, callerNumber, startedAt, endedAt, durationSec, outcome, transcript | recordingUrl, language.
    // Use formatTranscript() from ./provider if transcripts come back as turn arrays.
    throw new Error('Vaani Labs API not implemented yet — waiting for the API reference.');
  },
};
