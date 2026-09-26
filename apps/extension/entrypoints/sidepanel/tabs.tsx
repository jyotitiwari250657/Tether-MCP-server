// FR-701..FR-708: Sidepanel tabs: Session, Policy, Audit, Vault (Light Ribbon theme)
import type { AuditEntry, GrantLevel, PolicyRule } from '@tether/protocol';
import { useEffect, useState } from 'react';
import {
  exportHTML,
  exportJSON,
  list as listAudit,
  verify as verifyAudit,
} from '../../lib/audit/index.js';
import { grant, listRules, revoke } from '../../lib/policy/index.js';

export { SessionTab, type StepFeedItem } from './SessionTab.js';

/** Prompt 14 §3: grant-level pills use semantic triads (DENY red, READ teal, WRITE blue, SENSITIVE violet). */
function grantPillClass(level: GrantLevel): string {
  switch (level) {
    case 'DENY':
      return 'bg-red-tint border-red-stroke text-red-fg';
    case 'WRITE':
      return 'bg-blue-tint border-blue-stroke text-blue-fg';
    case 'SENSITIVE':
      return 'bg-violet-tint border-violet-stroke text-violet-fg';
    default:
      return 'bg-teal-tint border-teal-stroke text-teal-fg';
  }
}

export function PolicyTab() {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newLevel, setNewLevel] = useState<GrantLevel>('READ');

  const refresh = async () => {
    const list = await listRules();
    setRules(list);
  };

  useEffect(() => {
    void listRules().then(setRules);
  }, []);

  const handleRevoke = async (domain: string) => {
    await revoke(domain);
    await refresh();
  };

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    await grant({
      id: `rule-${Date.now()}`,
      match: { kind: newDomain.includes('*') ? 'wildcard' : 'exact', value: newDomain.trim() },
      level: newLevel,
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });
    setNewDomain('');
    setShowModal(false);
    await refresh();
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-text-900 uppercase tracking-wider">Domain Grants</span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-2.5 py-1 rounded-button bg-teal-tint border-[1.5px] border-teal-stroke text-teal-fg font-semibold hover:brightness-[0.96] cursor-pointer"
        >
          + Grant
        </button>
      </div>

      {showModal && (
        <div className="p-3 rounded-card border border-line bg-surface shadow-card space-y-2">
          <input
            type="text"
            placeholder="example.com or *.example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="w-full px-2 py-1.5 rounded-input bg-surface border border-line-strong text-text-900 text-xs outline-none focus:border-brand-blue"
          />
          <div className="flex gap-2">
            {(['READ', 'WRITE', 'DENY', 'SENSITIVE'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setNewLevel(lvl)}
                className={`flex-1 py-1 rounded-[8px] text-[10px] font-bold border transition ${
                  newLevel === lvl
                    ? grantPillClass(lvl)
                    : 'bg-sunken border-transparent text-text-700'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-2 py-1 text-text-500 hover:text-text-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-1 rounded-button bg-brand-blue text-white font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-text-500 py-4 text-center">No explicit policy rules configured.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className="p-2 rounded-button border border-line bg-surface shadow-card flex items-center justify-between"
            >
              <div>
                <span className="font-mono text-text-900 font-semibold">{r.match.value}</span>
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded-pill border text-[10px] font-bold ${grantPillClass(r.level)}`}
                >
                  {r.level}
                </span>
                <span className="text-[10px] text-text-500 ml-2">({r.scope})</span>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(r.match.value)}
                className="px-2 py-0.5 rounded-[8px] bg-red-tint border border-red-stroke text-red-fg hover:brightness-[0.96] text-[10px]"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  useEffect(() => {
    void listAudit().then(setEntries);
  }, []);

  const handleVerify = async () => {
    const res = await verifyAudit();
    if (res.ok) {
      setVerifyStatus(`✓ Verified (${res.count} entries intact)`);
    } else {
      setVerifyStatus(`✗ Tampered at seq ${res.brokenAt}`);
    }
  };

  const downloadFile = (content: string, type: string, ext: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tether-audit-${Date.now()}.${ext}`;
    a.click();
  };

  const handleExportJSON = async () => downloadFile(await exportJSON(), 'application/json', 'json');
  const handleExportHTML = async () => downloadFile(await exportHTML(), 'text/html', 'html');

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-text-900 uppercase tracking-wider">
          Audit Chain ({entries.length})
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleVerify}
            className="px-2 py-1 rounded-button bg-blue-tint border-[1.5px] border-blue-stroke text-blue-fg font-semibold hover:brightness-[0.96]"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-2 py-1 rounded-button bg-sunken text-text-700 hover:bg-line"
          >
            JSON
          </button>
          <button
            type="button"
            onClick={handleExportHTML}
            className="px-2 py-1 rounded-button bg-sunken text-text-700 hover:bg-line"
          >
            HTML
          </button>
        </div>
      </div>

      {verifyStatus && (
        <div
          className={`p-2 rounded-button text-xs font-semibold border ${
            verifyStatus.startsWith('✓')
              ? 'bg-teal-tint border-teal-stroke text-teal-fg'
              : 'bg-red-tint border-red-stroke text-red-fg'
          }`}
        >
          {verifyStatus}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-text-500 py-4 text-center">Audit chain is empty.</p>
      ) : (
        <div className="space-y-2">
          {entries
            .slice(-20)
            .reverse()
            .map((e) => (
              <div
                key={e.seq}
                className="p-2 rounded-[10px] border border-line bg-surface shadow-card text-xs font-mono"
              >
                <div className="flex justify-between items-center text-text-900">
                  <span className="font-semibold">
                    #{e.seq} {e.tool}
                  </span>
                  <span className="text-[10px] text-text-500">{e.verdict}</span>
                </div>
                <div className="text-[10px] text-text-500 truncate mt-1">
                  Hash: {e.hash.slice(0, 16)}...
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export { VaultTab } from './VaultTab.js';
