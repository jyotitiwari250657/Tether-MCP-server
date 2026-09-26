/**
 * Policy Store Persistence (PRD FR-501..FR-505, HR-2).
 * Manages domain capability rules in chrome.storage.local (persistent) and chrome.storage.session.
 */

import type { PolicyRule } from '@tether/protocol';
import type { PolicyStore } from './types.js';

const STORAGE_KEY_PERSISTENT = 'policy:store';
const STORAGE_KEY_SESSION = 'policy:session_rules';

export async function load(): Promise<PolicyStore> {
  let persistentRules: PolicyRule[] = [];
  let sessionRules: PolicyRule[] = [];

  if (typeof chrome !== 'undefined' && chrome.storage) {
    if (chrome.storage.local) {
      const data = await chrome.storage.local.get(STORAGE_KEY_PERSISTENT);
      const store = data[STORAGE_KEY_PERSISTENT] as PolicyStore | undefined;
      if (store?.rules && Array.isArray(store.rules)) {
        persistentRules = store.rules;
      }
    }
    if (chrome.storage.session) {
      const sessData = await chrome.storage.session.get(STORAGE_KEY_SESSION);
      const rules = sessData[STORAGE_KEY_SESSION] as PolicyRule[] | undefined;
      if (Array.isArray(rules)) {
        sessionRules = rules;
      }
    }
  }

  return {
    rules: [...persistentRules, ...sessionRules],
    version: '1.0.0',
  };
}

export async function save(store: PolicyStore): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;

  const persistentRules = store.rules.filter((r) => r.scope === 'persistent');
  const sessionRules = store.rules.filter((r) => r.scope === 'session');

  if (chrome.storage.local) {
    await chrome.storage.local.set({
      [STORAGE_KEY_PERSISTENT]: { rules: persistentRules, version: store.version },
    });
  }

  if (chrome.storage.session) {
    await chrome.storage.session.set({
      [STORAGE_KEY_SESSION]: sessionRules,
    });
  }
}

export async function grant(rule: PolicyRule): Promise<void> {
  const store = await load();
  // Filter out existing rule for same domain pattern if present
  const updatedRules = store.rules.filter((r) => r.match.value !== rule.match.value);
  updatedRules.push(rule);
  await save({ ...store, rules: updatedRules });
}

export async function revoke(domainPattern: string): Promise<void> {
  const store = await load();
  const updatedRules = store.rules.filter(
    (r) => r.match.value.toLowerCase() !== domainPattern.toLowerCase(),
  );
  await save({ ...store, rules: updatedRules });
}

export async function listRules(): Promise<PolicyRule[]> {
  const store = await load();
  return store.rules;
}
