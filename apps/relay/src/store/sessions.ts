// TRD §8.6, PRD FR-601: MCP Sessions Repository
import { getDb, getMemoryTable } from './db.js';

export interface SessionRecord {
  id: string;
  client_id: string;
  device_id: string;
  started_at: number;
  ended_at?: number | undefined;
  steps: number;
  tokens_used: number;
  aborted_reason?: string | undefined;
}

export async function createSession(session: SessionRecord): Promise<void> {
  const mem = getMemoryTable('sessions');
  mem.set(session.id, { ...session });

  const db = getDb();
  try {
    await db(
      'INSERT INTO sessions (id, client_id, device_id, started_at, ended_at, steps, tokens_used, aborted_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        session.id,
        session.client_id,
        session.device_id,
        session.started_at,
        session.ended_at ?? null,
        session.steps,
        session.tokens_used,
        session.aborted_reason ?? null,
      ],
    );
  } catch {
    // fallback
  }
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const mem = getMemoryTable('sessions');
  const cached = mem.get(id);
  if (cached) return cached as unknown as SessionRecord;

  const db = getDb();
  try {
    const rows = (await db('SELECT * FROM sessions WHERE id = $1', [id])) as SessionRecord[];
    if (rows[0]) {
      mem.set(id, { ...rows[0] });
      return rows[0];
    }
  } catch {
    // fallback
  }
  return null;
}

export async function updateSessionProgress(
  id: string,
  stepsDelta: number,
  tokensDelta: number,
): Promise<void> {
  const mem = getMemoryTable('sessions');
  const s = mem.get(id);
  if (s) {
    s.steps = ((s.steps as number) || 0) + stepsDelta;
    s.tokens_used = ((s.tokens_used as number) || 0) + tokensDelta;
  }

  const db = getDb();
  try {
    await db(
      'UPDATE sessions SET steps = steps + $1, tokens_used = tokens_used + $2 WHERE id = $3',
      [stepsDelta, tokensDelta, id],
    );
  } catch {
    // fallback
  }
}

export async function endSession(id: string, reason?: string): Promise<void> {
  const mem = getMemoryTable('sessions');
  const s = mem.get(id);
  if (s) {
    s.ended_at = Date.now();
    if (reason) s.aborted_reason = reason;
  }

  const db = getDb();
  try {
    await db('UPDATE sessions SET ended_at = $1, aborted_reason = $2 WHERE id = $3', [
      Date.now(),
      reason ?? null,
      id,
    ]);
  } catch {
    // fallback
  }
}
