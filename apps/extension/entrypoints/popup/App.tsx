// FR-701..FR-708, Prompt 14 §3: Light Ribbon popup matching brand/popup-mock.png.
// THEME-ONLY: visible labels and status message strings are byte-identical to the
// previous build (AC-P14-09); e2e selectors (tests/e2e/helpers/ui.ts) keep working.
import { useEffect, useState } from 'react';
import { IconLink, IconPower, IconRotate, IconShield, IconUsers } from '../../components/icons.js';
import { endSession, getAttachedClients } from '../../lib/session/index.js';
import { isForbiddenUrl } from '../../lib/session/target.js';
import { useTransportStatus } from '../../lib/transport/index.js';

const BTN =
  'w-full h-[52px] rounded-button border-[1.5px] flex items-center justify-center gap-2.5 ' +
  'text-base font-semibold transition cursor-pointer hover:brightness-[0.96] active:translate-y-px';

export function App() {
  const { status, setState } = useTransportStatus();
  const [clients, setClients] = useState<number>(0);
  const [killMessage, setKillMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [injectStatus, setInjectStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setClients(getAttachedClients());
  }, []);

  const handleKillSwitch = async () => {
    const t0 = performance.now();
    try {
      await endSession('user_kill_switch');
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'kill_switch' }).catch(() => {});
      }
      setState('closed');
      const latency = Math.round(performance.now() - t0);
      setKillMessage(`⏻ Killed in ${latency}ms`);
    } catch {
      setKillMessage('⏻ Kill failed');
    }
  };

  /** Prompt 12 AC-P12-01 (HR-10): explicit user gesture to re-arm the daemon. */
  const handleResetKillSwitch = async () => {
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'reset_kill_switch' })) as
        | { ok?: boolean }
        | undefined;
      setResetMessage(res?.ok ? '⟳ Kill switch reset' : '⟳ Daemon unreachable');
    } catch {
      setResetMessage('⟳ Daemon unreachable');
    }
    setTimeout(() => setResetMessage(null), 4000);
  };

  const handleEnableSiteAccess = async () => {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        setInjectStatus({ ok: false, message: 'Chrome API unavailable' });
        return;
      }
      const allTabs = await chrome.tabs.query({});
      let tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      if (!tab || (tab.url && isForbiddenUrl(tab.url))) {
        tab = allTabs.find((t) => t.id && (!t.url || !isForbiddenUrl(t.url))) || tab;
      }
      if (!tab?.id) {
        setInjectStatus({ ok: false, message: 'No active tab found' });
        return;
      }

      let tabUrl = tab.url || '';
      if (!tabUrl && chrome.scripting?.executeScript) {
        try {
          const [res] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.location.href,
          });
          if (typeof res?.result === 'string') tabUrl = res.result;
        } catch {}
      }

      if (tabUrl && isForbiddenUrl(tabUrl)) {
        setInjectStatus({ ok: false, message: 'Unsupported page: cannot automate this page type' });
        return;
      }
      let host = tabUrl || 'site';
      try {
        if (tabUrl) host = new URL(tabUrl).host;
      } catch {}

      if (chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: 'enable_site_access', url: tabUrl });
      }

      if (tab.id && chrome.scripting?.executeScript) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-scripts/content.js'],
          });
        } catch {}
      }

      setInjectStatus({ ok: true, message: `Injected into ${host}` });
      setTimeout(() => setInjectStatus(null), 4000);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (
        msg.includes('permission') ||
        msg.includes('access') ||
        msg.includes('denied') ||
        msg.includes('host')
      ) {
        setInjectStatus({ ok: false, message: 'Permission denied: cannot access this site' });
      } else {
        setInjectStatus({
          ok: false,
          message: `Injection failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  };

  return (
    <div className="w-[360px] bg-surface text-text-900 select-none p-5 rounded-card shadow-card">
      {/* Header: raster ribbon lockup (40px) + mode pill (AC-F14-01) */}
      <div className="flex items-center justify-between mb-3">
        <img src="/brand-lockup.png" alt="Tether" className="h-10 w-auto" />
        <span className="text-[14px] px-3 py-1.5 rounded-input bg-sunken text-text-700 font-medium">
          Local
        </span>
      </div>
      <div className="border-t border-line mb-3" />

      {/* Two info rows: 36px icon wells + right-aligned values */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-input bg-sunken flex items-center justify-center text-teal-fg">
              <IconLink />
            </span>
            <span className="text-[15px] text-text-700">Status:</span>
          </div>
          <span
            className={`${status.colorClass} text-[17px] font-semibold flex items-center gap-1.5`}
          >
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${status.dotClass}`} />
            {status.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Mockup: solid brand-blue well with white icon */}
            <span className="w-9 h-9 rounded-input bg-brand-blue flex items-center justify-center text-white">
              <IconUsers />
            </span>
            <span className="text-[15px] text-text-700">Clients:</span>
          </div>
          <span className="text-brand-blue text-[17px] font-semibold font-mono">
            {clients} attached
          </span>
        </div>
      </div>

      {killMessage && (
        <div className="mb-2 px-2 py-1.5 text-center text-xs font-bold rounded-button bg-red-tint border-[1.5px] border-red-stroke text-red-fg">
          {killMessage}
        </div>
      )}

      {resetMessage && (
        <div className="mb-2 px-2 py-1.5 text-center text-xs font-bold rounded-button bg-teal-tint border-[1.5px] border-teal-stroke text-teal-fg">
          {resetMessage}
        </div>
      )}

      <div className="space-y-2.5">
        <button
          type="button"
          className={`${BTN} bg-red-tint border-red-stroke text-red-fg`}
          onClick={handleKillSwitch}
        >
          <IconPower size={20} />
          Kill Switch (HR-10)
        </button>

        <button
          type="button"
          className={`${BTN} bg-teal-tint border-teal-stroke text-teal-fg`}
          onClick={handleResetKillSwitch}
        >
          <IconRotate size={20} />
          Reset Kill Switch
        </button>

        <button
          type="button"
          className={`${BTN} bg-blue-tint border-blue-stroke text-blue-fg`}
          onClick={handleEnableSiteAccess}
        >
          <IconShield size={20} />
          Enable Site Access &amp; Inject
        </button>
      </div>

      {injectStatus && (
        <div
          className={`mt-3 px-2 py-1.5 text-center text-xs font-medium rounded-button border-[1.5px] ${
            injectStatus.ok
              ? 'bg-teal-tint border-teal-stroke text-teal-fg'
              : 'bg-red-tint border-red-stroke text-red-fg'
          }`}
        >
          {injectStatus.message}
        </div>
      )}
    </div>
  );
}
