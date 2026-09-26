// TRD §8.6, PRD PRV-03, FR-513: Audit Metadata Repository (Hashes and verdicts ONLY)
import { getDb, getMemoryTable } from './db.js';

export interface AuditMetaRecord {
  id?: number | undefined;
  session_id: string;
  seq: number;
  tool: string;
  tier: number;
  verdict: string;
  hash: string;
  prev_hash: string;
  t: number;
}

export async function recordAuditMeta(entry: AuditMetaRecord): Promise<void> {
  const mem = getMemoryTable('audit_meta');
  const key = `${entry.session_id}:${entry.seq}`;
  mem.set(key, { ...entry });

  const db = getDb();
  try {
    await db(
      'INSERT INTO audit_meta (session_id, seq, tool, tier, verdict, hash, prev_hash, t) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (session_id, seq) DO NOTHING',
      [
        entry.session_id,
        entry.seq,
        entry.tool,
        entry.tier,
        entry.verdict,
        entry.hash,
        entry.prev_hash,
        entry.t,
      ],
    );
  } catch {
    // fallback
  }
}

export async function listAuditMeta(sessionId: string): Promise<AuditMetaRecord[]> {
  const mem = getMemoryTable('audit_meta');
  const fromMem = Array.from(mem.values()).filter(
    (e) => e.session_id === sessionId,
  ) as unknown as AuditMetaRecord[];
  if (fromMem.length > 0) {
    return fromMem.sort((a, b) => a.seq - b.seq);
  }

  const db = getDb();
  try {
    return (await db('SELECT * FROM audit_meta WHERE session_id = $1 ORDER BY seq ASC', [
      sessionId,
    ])) as AuditMetaRecord[];
  } catch {
    return [];
  }
}
