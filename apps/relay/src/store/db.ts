// TRD §8.6: Database connection abstraction (Neon Postgres with test fallback)
import { neon } from '@neondatabase/serverless';

export interface QueryResult<T = unknown> {
  rows: T[];
}

export type DbClient = (query: string, params?: unknown[]) => Promise<unknown[]>;

let activeClient: DbClient | null = null;
const memoryStore = new Map<string, Map<string, Record<string, unknown>>>();

export function getMemoryTable(table: string) {
  let t = memoryStore.get(table);
  if (!t) {
    t = new Map();
    memoryStore.set(table, t);
  }
  return t;
}

export function resetMemoryDb() {
  memoryStore.clear();
}

export function getDb(databaseUrl?: string): DbClient {
  if (activeClient) return activeClient;

  if (databaseUrl?.startsWith('postgres')) {
    const sql = neon(databaseUrl);
    activeClient = async (query: string, params: unknown[] = []) => {
      return (await sql(query, params as never[])) as unknown[];
    };
    return activeClient;
  }

  // Fallback in-memory driver for development/unit-testing
  activeClient = async (query: string, _params: unknown[] = []) => {
    // Basic driver for raw query execution
    return [];
  };
  return activeClient;
}

export function setDbClient(client: DbClient | null) {
  activeClient = client;
}
