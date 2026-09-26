// TRD §8.6: Ephemeral State Storage (Vercel KV / In-memory fallback)
import { kv } from '@vercel/kv';

export interface KvClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<number>;
  lpush(key: string, ...values: unknown[]): Promise<number>;
  rpop<T>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
  zadd(key: string, score: { score: number; member: string }): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
}

const memoryStore = new Map<string, unknown>();
const memoryLists = new Map<string, unknown[]>();
const memoryZsets = new Map<string, { score: number; member: string }[]>();

export function resetMemoryKv() {
  memoryStore.clear();
  memoryLists.clear();
  memoryZsets.clear();
}

export class MemoryKv implements KvClient {
  async get<T>(key: string): Promise<T | null> {
    const val = memoryStore.get(key);
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<void> {
    memoryStore.set(key, value);
    if (opts?.ex) {
      setTimeout(() => memoryStore.delete(key), opts.ex * 1000);
    }
  }

  async del(key: string): Promise<number> {
    const had = memoryStore.delete(key);
    memoryLists.delete(key);
    memoryZsets.delete(key);
    return had ? 1 : 0;
  }

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    let list = memoryLists.get(key);
    if (!list) {
      list = [];
      memoryLists.set(key, list);
    }
    list.unshift(...values);
    return list.length;
  }

  async rpop<T>(key: string): Promise<T | null> {
    const list = memoryLists.get(key);
    if (!list || list.length === 0) return null;
    return (list.pop() as T) ?? null;
  }

  async llen(key: string): Promise<number> {
    const list = memoryLists.get(key);
    return list ? list.length : 0;
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const list = memoryLists.get(key);
    if (!list) return [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end) as T[];
  }

  async zadd(key: string, score: { score: number; member: string }): Promise<number> {
    let zset = memoryZsets.get(key);
    if (!zset) {
      zset = [];
      memoryZsets.set(key, zset);
    }
    zset.push(score);
    return 1;
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const zset = memoryZsets.get(key);
    if (!zset) return 0;
    const initial = zset.length;
    const filtered = zset.filter((item) => item.score < min || item.score > max);
    memoryZsets.set(key, filtered);
    return initial - filtered.length;
  }

  async zcard(key: string): Promise<number> {
    const zset = memoryZsets.get(key);
    return zset ? zset.length : 0;
  }
}

export const MemoryKV = MemoryKv;
const memoryClient = new MemoryKv();
let configuredClient: KvClient | null = null;

export function getKv(url?: string, token?: string): KvClient {
  if (configuredClient) return configuredClient;

  if (url && token) {
    try {
      // Use real @vercel/kv when configured
      configuredClient = kv as unknown as KvClient;
      return configuredClient;
    } catch {
      // Fallback
    }
  }

  return memoryClient;
}

export function setKvClient(client: KvClient | null) {
  configuredClient = client;
}
