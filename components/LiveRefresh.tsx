'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Re-fetches server data every `seconds` so the dashboard stays live without a manual reload. Pauses when the tab is hidden. */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [last, setLast] = useState<string>('');
  useEffect(() => {
    const stamp = () => setLast(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }));
    stamp();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') { router.refresh(); stamp(); }
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-arch text-mute" aria-live="off">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" aria-hidden />
      Live{last ? ` · ${last} IST` : ''}
    </span>
  );
}
