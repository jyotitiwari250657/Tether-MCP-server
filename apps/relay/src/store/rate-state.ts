// TRD §8.6: Rate State Repository (Database fallback if KV is unavailable)
import { getDb, getMemoryTable } from './db.js';

export interface RateStateRecord {
  client_id: string;
  window_start: number;
  calls: number;
  tokens: number;
}

export async function getRateState(clientId: string): Promise<RateStateRecord | null> {
  const mem = getMemoryTable('rate_state');
  const cached = mem.get(clientId);
  if (cached) return cached as unknown as RateStateRecord;

  const db = getDb();
  try {
    const rows = (await db('SELECT * FROM rate_state WHERE client_id = $1', [
      clientId,
    ])) as RateStateRecord[];
    if (rows[0]) {
      mem.set(clientId, { ...rows[0] });
      return rows[0];
    }
  } catch {
    // fallback
  }
  return null;
}

export async function updateRateState(record: RateStateRecord): Promise<void> {
  const mem = getMemoryTable('rate_state');
  mem.set(record.client_id, { ...record });

  const db = getDb();
  try {
    await db(
      'INSERT INTO rate_state (client_id, window_start, calls, tokens) VALUES ($1, $2, $3, $4) ON CONFLICT (client_id) DO UPDATE SET window_start = $2, calls = $3, tokens = $4',
      [record.client_id, record.window_start, record.calls, record.tokens],
    );
  } catch {
    // fallback
  }
}
