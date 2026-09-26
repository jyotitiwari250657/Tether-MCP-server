// TRD §8.6, PRD FR-511: Egress Log Repository (Registrable domains only, no full URLs)
import { getDb, getMemoryTable } from './db.js';

export interface EgressLogRecord {
  id?: number | undefined;
  session_id: string;
  origin_registrable: string;
  method?: string | undefined;
  bytes?: number | undefined;
  decision: string;
  t: number;
}

export async function recordEgress(entry: EgressLogRecord): Promise<void> {
  const mem = getMemoryTable('egress_log');
  const key = `${entry.session_id}:${Date.now()}:${Math.random()}`;
  mem.set(key, { ...entry });

  const db = getDb();
  try {
    await db(
      'INSERT INTO egress_log (session_id, origin_registrable, method, bytes, decision, t) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        entry.session_id,
        entry.origin_registrable,
        entry.method ?? null,
        entry.bytes ?? null,
        entry.decision,
        entry.t,
      ],
    );
  } catch {
    // fallback
  }
}

export async function listEgress(sessionId: string): Promise<EgressLogRecord[]> {
  const mem = getMemoryTable('egress_log');
  const fromMem = Array.from(mem.values()).filter(
    (e) => e.session_id === sessionId,
  ) as unknown as EgressLogRecord[];
  if (fromMem.length > 0) return fromMem;

  const db = getDb();
  try {
    return (await db('SELECT * FROM egress_log WHERE session_id = $1 ORDER BY t ASC', [
      sessionId,
    ])) as EgressLogRecord[];
  } catch {
    return [];
  }
}
