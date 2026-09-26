// TRD §8.6, PRD FR-606: Devices Repository
import { getDb, getMemoryTable } from './db.js';

export interface DeviceRecord {
  id: string;
  user_id: string;
  label: string;
  profile: string;
  pub_key: string;
  last_seen?: number | undefined;
  revoked_at?: number | undefined;
}

export async function createDevice(device: DeviceRecord): Promise<void> {
  const mem = getMemoryTable('devices');
  mem.set(device.id, { ...device });

  const db = getDb();
  try {
    await db(
      'INSERT INTO devices (id, user_id, label, profile, pub_key, last_seen, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        device.id,
        device.user_id,
        device.label,
        device.profile,
        device.pub_key,
        device.last_seen ?? null,
        device.revoked_at ?? null,
      ],
    );
  } catch {
    // fallback
  }
}

export async function getDevice(id: string): Promise<DeviceRecord | null> {
  const mem = getMemoryTable('devices');
  const cached = mem.get(id);
  if (cached) return cached as unknown as DeviceRecord;

  const db = getDb();
  try {
    const rows = (await db('SELECT * FROM devices WHERE id = $1', [id])) as DeviceRecord[];
    if (rows[0]) {
      mem.set(id, { ...rows[0] });
      return rows[0];
    }
  } catch {
    // fallback
  }
  return null;
}

export async function listDevices(userId: string): Promise<DeviceRecord[]> {
  const mem = getMemoryTable('devices');
  const fromMem = Array.from(mem.values()).filter(
    (d) => d.user_id === userId,
  ) as unknown as DeviceRecord[];
  if (fromMem.length > 0) return fromMem;

  const db = getDb();
  try {
    return (await db('SELECT * FROM devices WHERE user_id = $1', [userId])) as DeviceRecord[];
  } catch {
    return [];
  }
}

export async function revokeDevice(id: string): Promise<void> {
  const mem = getMemoryTable('devices');
  const d = mem.get(id);
  if (d) d.revoked_at = Date.now();

  const db = getDb();
  try {
    await db('UPDATE devices SET revoked_at = $1 WHERE id = $2', [Date.now(), id]);
  } catch {
    // fallback
  }
}

export async function updateLastSeen(id: string, t = Date.now()): Promise<void> {
  const mem = getMemoryTable('devices');
  const d = mem.get(id);
  if (d) d.last_seen = t;

  const db = getDb();
  try {
    await db('UPDATE devices SET last_seen = $1 WHERE id = $2', [t, id]);
  } catch {
    // fallback
  }
}
