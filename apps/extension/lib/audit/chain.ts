/**
 * Tamper-Evident Hash-Chained Audit Log (TRD §6.9, PRD FR-512, FR-513).
 * Append-only cryptographic ledger persisted in IndexedDB with tail hash in chrome.storage.local.
 */

import { type AuditEntry, hashEntry, verifyChain } from '@tether/protocol';
import { type IDBPDatabase, openDB } from 'idb';
import { HTML_EXPORT } from './tokens.js';

const DB_NAME = 'tether-audit';
const DB_VERSION = 1;
const STORE_NAME = 'entries';
const STORAGE_KEY_TAIL = 'audit:chain:tail';
const GENESIS_HASH = '0'.repeat(64);

interface ChainTail {
  lastSeq: number;
  lastHash: string;
}

// In-memory fallback if IndexedDB is unavailable in test environment
const memoryEntries: Map<number, AuditEntry> = new Map();
let testDb: IDBPDatabase | null = null;

export function setTestDb(db: IDBPDatabase | null): void {
  testDb = db;
}

async function getDb(): Promise<IDBPDatabase | null> {
  if (testDb) return testDb;
  if (typeof globalThis.indexedDB === 'undefined') {
    return null;
  }
  try {
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'seq' });
        }
      },
    });
  } catch {
    return null;
  }
}

let memoryTail: ChainTail = { lastSeq: 0, lastHash: GENESIS_HASH };

async function getTail(): Promise<ChainTail> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const data = await chrome.storage.local.get(STORAGE_KEY_TAIL);
    const tail = data[STORAGE_KEY_TAIL] as ChainTail | undefined;
    if (tail && typeof tail.lastSeq === 'number' && typeof tail.lastHash === 'string') {
      return tail;
    }
  }
  return memoryTail;
}

async function setTail(tail: ChainTail): Promise<void> {
  memoryTail = tail;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY_TAIL]: tail });
  }
}

export async function append(
  entryData: Omit<AuditEntry, 'seq' | 'hash' | 'prevHash'>,
): Promise<AuditEntry> {
  const tail = await getTail();
  const seq = tail.lastSeq + 1;
  const prevHash = tail.lastHash;

  const entryWithoutHash = {
    ...entryData,
    seq,
    prevHash,
  };

  const hash = await hashEntry(entryWithoutHash, prevHash);
  const entry: AuditEntry = {
    ...entryWithoutHash,
    hash,
  };

  const db = await getDb();
  if (db) {
    await db.put(STORE_NAME, entry);
  } else {
    memoryEntries.set(seq, entry);
  }

  await setTail({ lastSeq: seq, lastHash: hash });
  return entry;
}

export async function list(range?: { from?: number; to?: number }): Promise<AuditEntry[]> {
  let entries: AuditEntry[];
  const db = await getDb();

  if (db) {
    entries = (await db.getAll(STORE_NAME)) as AuditEntry[];
  } else {
    entries = Array.from(memoryEntries.values());
  }

  entries.sort((a, b) => a.seq - b.seq);

  if (range) {
    const { from = 1, to = Number.MAX_SAFE_INTEGER } = range;
    entries = entries.filter((e) => e.seq >= from && e.seq <= to);
  }

  return entries;
}

export async function verify(): Promise<{ ok: boolean; brokenAt?: number; count: number }> {
  const entries = await list();
  if (entries.length === 0) {
    return { ok: true, count: 0 };
  }

  const result = await verifyChain(entries);
  if (!result.ok && result.brokenAt !== undefined) {
    const brokenSeq = entries[result.brokenAt]?.seq ?? result.brokenAt;
    return {
      ok: false,
      brokenAt: brokenSeq,
      count: entries.length,
    };
  }
  return {
    ok: true,
    count: entries.length,
  };
}

export async function exportJSON(range?: { from?: number; to?: number }): Promise<string> {
  const entries = await list(range);
  return JSON.stringify(entries, null, 2);
}

export async function exportHTML(range?: { from?: number; to?: number }): Promise<string> {
  const entries = await list(range);
  const rows = entries
    .map(
      (e) => `
    <tr>
      <td>${e.seq}</td>
      <td>${e.t}</td>
      <td>${e.tool}</td>
      <td>T${e.tier}</td>
      <td><strong>${e.verdict}</strong></td>
      <td><code>${e.argsDigest.slice(0, 12)}...</code></td>
      <td><code>${e.hash.slice(0, 12)}...</code></td>
    </tr>`,
    )
    .join('\n');

  const K = HTML_EXPORT;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tether Audit Chain Report</title>
  <style>
    body { font-family: monospace; background: ${K.bg}; color: ${K.text}; padding: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; background: ${K.surface}; border: 1px solid ${K.line}; }
    th, td { border: 1px solid ${K.line}; padding: 8px 12px; text-align: left; color: ${K.textSoft}; }
    th { background: ${K.sunken}; color: ${K.text}; }
    code { color: ${K.blueFg}; }
  </style>
</head>
<body>
  <h1>Tether Audit Chain Export</h1>
  <p>Total Entries: ${entries.length}</p>
  <table>
    <thead>
      <tr><th>Seq</th><th>Timestamp</th><th>Tool</th><th>Tier</th><th>Verdict</th><th>Args Digest</th><th>Hash</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

export async function clearAuditChain(): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.clear(STORE_NAME);
  }
  memoryEntries.clear();
  memoryTail = { lastSeq: 0, lastHash: GENESIS_HASH };
  await setTail(memoryTail);
}
