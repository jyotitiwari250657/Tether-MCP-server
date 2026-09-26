// FR-701..FR-708, Prompt 09-FIX-03: Session tab with live transport status line and action feed
import { useEffect, useState } from 'react';
import { useTransportStatus } from '../../lib/transport/index.js';

export interface StepFeedItem {
  id: string;
  tool: string;
  ok: boolean;
  ms: number;
  ts: number;
  /** Prompt 11 §4: OCR redaction unavailable → screenshot returned unredacted. */
  ocrDegraded?: boolean;
  ocrHits?: number;
}

/** Prompt 14 §3: verdict pills use semantic triads (allow teal, deny red). */
const VERDICT_OK = 'bg-teal-tint text-teal-fg border-teal-stroke';
const VERDICT_DENIED = 'bg-red-tint text-red-fg border-red-stroke';

export function SessionTab() {
  const { status } = useTransportStatus();
  const [steps, setSteps] = useState<StepFeedItem[]>([]);

  useEffect(() => {
    const listener = (msg: unknown) => {
      const m = msg as { evt?: string; payload?: StepFeedItem } | null;
      if (m && m.evt === 'step' && m.payload) {
        setSteps((prev) => [m.payload as StepFeedItem, ...prev].slice(0, 50));
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
    return undefined;
  }, []);

  return (
    <div className="space-y-3">
      {/* Live Transport Status Line (Prompt 09-FIX-03, AC-FIX3-04) */}
      <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-[10px] border border-line bg-surface shadow-card">
        <span className="text-text-500">Status:</span>
        <span className={`${status.colorClass} font-medium flex items-center gap-1.5`}>
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${status.dotClass}`} />
          {status.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-text-500">
        <span>Action Feed ({steps.length})</span>
        <button
          type="button"
          onClick={() => setSteps([])}
          className="hover:text-text-900 cursor-pointer"
        >
          Clear
        </button>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-text-500 py-8 text-center">
          No actions recorded in current session.
        </p>
      ) : (
        <div className="space-y-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className="p-2.5 rounded-[12px] border border-line bg-surface shadow-card text-xs border-l-[3px] border-l-teal-fg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text-900">{s.tool}</span>
                  <span className="text-[10px] text-text-500 ml-2 font-mono">{s.ms}ms</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-pill border ${s.ok ? VERDICT_OK : VERDICT_DENIED}`}
                >
                  {s.ok ? 'ALLOW' : 'DENIED'}
                </span>
              </div>
              {/* AC-P11-08: amber badge when OCR redaction was unavailable */}
              {s.tool === 'browser_screenshot' && s.ocrDegraded && (
                <div className="mt-1.5 px-1.5 py-0.5 text-[10px] rounded-[8px] bg-amber-tint text-amber-fg border border-amber-stroke">
                  OCR unavailable — image unredacted
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
