// FR-101, FR-701..FR-708: React side panel with Session feed, Policy grants, Audit chain, and Vault
import { useState } from 'react';
import { IconPower } from '../../components/icons.js';
import { AuditTab, PolicyTab, SessionTab, VaultTab } from './tabs.js';

export type Tab = 'session' | 'policy' | 'audit' | 'vault';

export function App() {
  const [tab, setTab] = useState<Tab>('session');

  return (
    <div className="flex flex-col h-screen bg-bg text-text-900 select-none">
      <header className="bg-surface border-b border-line px-4 py-3 flex items-center justify-between shadow-card">
        {/* Raster-derived lockup (AC-F14-01) */}
        <img src="/brand-lockup.png" alt="Tether" className="h-9 w-auto" />
        <span className="text-[14px] px-3 py-1.5 rounded-input bg-sunken text-text-700 font-medium">
          v0.1.0
        </span>
      </header>
      {/* Segmented control: sunken track, surface active segment (Prompt 14 §3) */}
      <nav className="bg-bg px-3 py-2">
        <div className="flex rounded-button bg-sunken p-1 gap-1">
          {(['session', 'policy', 'audit', 'vault'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[8px] transition ${
                tab === t
                  ? 'bg-surface text-text-900 shadow-card'
                  : 'text-text-700 hover:text-text-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'session' && <SessionTab />}
        {tab === 'policy' && <PolicyTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'vault' && <VaultTab />}
      </main>
      {/* Kill switch footer: red triad, full width (Prompt 14 §3) */}
      <footer className="bg-surface border-t border-line p-3">
        <button
          type="button"
          className="w-full h-[44px] rounded-button border-[1.5px] border-red-stroke bg-red-tint text-red-fg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer hover:brightness-[0.96] active:translate-y-px"
        >
          <IconPower size={18} />
          Kill Switch (HR-10)
        </button>
      </footer>
    </div>
  );
}
