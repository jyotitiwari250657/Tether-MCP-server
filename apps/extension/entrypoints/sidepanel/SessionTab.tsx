// FR-701..FR-708, Prompt 09-FIX-03, Prompt 16: Session tab with live transport status line, tier pills, refs, and approval cards
import { useEffect, useState } from 'react';
import { useTransportStatus } from '../../lib/transport/index.js';

export interface StepFeedItem {
  id: string;
  tool: string;
  ok: boolean;
  ms: number;
  ts: number;
  ocrDegraded?: boolean;
  ocrHits?: number;
  ref?: string;
  tier?: number;
  verdict?: 'allow' | 'deny' | 'ask';
  diff?: Array<{ label: string; value: string; tone?: string }>;
  denied?: boolean;
}

/** Prompt 14 §3: verdict pills use semantic triads (allow teal, deny red, ask amber). */
const VERDICT_OK = 'bg-teal-tint text-teal-fg border-teal-stroke';
const VERDICT_DENIED = 'bg-red-tint text-red-fg border-red-stroke';
const VERDICT_ASK = 'bg-amber-tint text-amber-fg border-amber-stroke';

export function SessionTab() {
  const { status } = useTransportStatus();
  const [steps, setSteps] = useState<StepFeedItem[]>([]);

  useEffect(() => {
    // Rehydrate any stored steps from background
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      chrome.storage.session
        .get('recent_steps')
        .then((data) => {
          if (Array.isArray(data?.recent_steps) && data.recent_steps.length > 0) {
            setSteps((prev) => (prev.length === 0 ? (data.recent_steps as StepFeedItem[]) : prev));
          }
        })
        .catch(() => {});
    }

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

  const handleDeny = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, denied: true, ok: false, verdict: 'deny' } : s)),
    );
  };

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
          onClick={() => {
            setSteps([]);
            if (typeof chrome !== 'undefined' && chrome.storage?.session) {
              chrome.storage.session.remove('recent_steps').catch(() => {});
            }
          }}
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
          {steps.map((s) => {
            const isAsk = s.verdict === 'ask' && !s.denied;
            const borderAccent =
              isAsk || s.tier === 2
                ? 'border-l-amber-fg'
                : s.tier === 1
                  ? 'border-l-brand-blue'
                  : 'border-l-teal-fg';
            const tierBadge = s.tier === 2 ? 'T2' : s.tier === 1 ? 'T1' : 'T0';
            const tierPillClass =
              s.tier === 2
                ? 'bg-amber-tint text-amber-fg border-amber-stroke'
                : s.tier === 1
                  ? 'bg-blue-tint text-blue-fg border-blue-stroke'
                  : 'bg-teal-tint text-teal-fg border-teal-stroke';

            return (
              <div
                key={s.id}
                className={`p-2.5 rounded-[12px] border border-line bg-surface shadow-card text-xs border-l-[3px] ${borderAccent}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded-pill border ${tierPillClass}`}
                    >
                      {tierBadge}
                    </span>
                    <span className="font-semibold text-text-900">{s.tool}</span>
                    {s.ref && (
                      <span className="px-1.5 py-0.5 rounded-[6px] bg-sunken text-text-700 font-mono text-[10px] border border-line">
                        {s.ref}
                      </span>
                    )}
                    <span className="text-[10px] text-text-500 font-mono">{s.ms}ms</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-pill border ${
                      isAsk ? VERDICT_ASK : s.ok ? VERDICT_OK : VERDICT_DENIED
                    }`}
                  >
                    {isAsk ? 'ASK' : s.ok ? 'ALLOW' : 'DENIED'}
                  </span>
                </div>

                {/* FR-704 / PRD HR-8: Tier 2 Approval Card with Diff Rows */}
                {isAsk && (
                  <div
                    id="approval-card"
                    className="mt-2.5 p-2.5 rounded-[10px] border border-amber-stroke bg-amber-tint/40 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-text-900">
                      <span>Approval Required (Tier 2)</span>
                      <span className="text-[10px] text-amber-fg font-medium">
                        NEEDS_CONFIRMATION
                      </span>
                    </div>
                    <div className="rounded-[8px] border border-line bg-surface overflow-hidden">
                      <table className="w-full text-[11px]">
                        <tbody>
                          {(s.diff && s.diff.length > 0
                            ? s.diff
                            : [
                                { label: 'Action', value: s.tool },
                                { label: 'Target', value: s.ref || 'form_submit' },
                                { label: 'Tier', value: 'T2 (High Risk)' },
                              ]
                          ).map((row) => (
                            <tr key={row.label} className="border-b border-line last:border-b-0">
                              <td className="px-2 py-1 font-medium text-text-500 bg-sunken w-20 text-[10px]">
                                {row.label}
                              </td>
                              <td className="px-2 py-1 font-mono text-text-900 font-semibold text-[10px]">
                                {row.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <button
                        type="button"
                        className="flex-1 py-1 rounded-button bg-brand-blue text-white text-[11px] font-semibold shadow-card hover:brightness-95 cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-button bg-surface border border-line-strong text-text-700 text-[11px] font-semibold hover:bg-sunken cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        id="deny-button"
                        onClick={() => handleDeny(s.id)}
                        className="px-2.5 py-1 rounded-button bg-red-tint border border-red-stroke text-red-fg text-[11px] font-semibold hover:brightness-95 cursor-pointer"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                )}

                {/* AC-P11-08: amber badge when OCR redaction was unavailable */}
                {s.tool === 'browser_screenshot' && s.ocrDegraded && (
                  <div className="mt-1.5 px-1.5 py-0.5 text-[10px] rounded-[8px] bg-amber-tint text-amber-fg border border-amber-stroke">
                    OCR unavailable — image unredacted
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
