// TRD §8.6, PRD FR-601: MCP Session Lifecycle and Progress Tokens in Vercel KV
import { getKv } from './kv.js';

export interface McpSessionState {
  id: string;
  clientId: string;
  deviceId: string;
  driverId?: string | undefined;
  createdAt: number;
  lastActivity: number;
}

const SESSION_TTL_SECONDS = 3600; // 1 hour

export async function createMcpSession(
  sessionId: string,
  clientId: string,
  deviceId: string,
): Promise<McpSessionState> {
  const kv = getKv();
  const state: McpSessionState = {
    id: sessionId,
    clientId,
    deviceId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  await kv.set(`mcp:session:${sessionId}`, state, { ex: SESSION_TTL_SECONDS });
  return state;
}

export async function getMcpSession(sessionId: string): Promise<McpSessionState | null> {
  const kv = getKv();
  return await kv.get<McpSessionState>(`mcp:session:${sessionId}`);
}

export async function touchMcpSession(sessionId: string): Promise<void> {
  const session = await getMcpSession(sessionId);
  if (session) {
    session.lastActivity = Date.now();
    const kv = getKv();
    await kv.set(`mcp:session:${sessionId}`, session, { ex: SESSION_TTL_SECONDS });
  }
}

export async function lockSessionDriver(
  sessionId: string,
  driverId: string,
): Promise<{ ok: boolean; currentDriver?: string | undefined }> {
  const session = await getMcpSession(sessionId);
  if (!session) return { ok: false };

  if (session.driverId && session.driverId !== driverId) {
    return { ok: false, currentDriver: session.driverId };
  }

  session.driverId = driverId;
  session.lastActivity = Date.now();
  const kv = getKv();
  await kv.set(`mcp:session:${sessionId}`, session, { ex: SESSION_TTL_SECONDS });
  return { ok: true };
}

export async function storeProgressToken(token: string, sessionId: string): Promise<void> {
  const kv = getKv();
  await kv.set(`progress:${token}`, { sessionId, createdAt: Date.now() }, { ex: 300 });
}

export async function verifyProgressToken(token: string): Promise<string | null> {
  const kv = getKv();
  const data = await kv.get<{ sessionId: string }>(`progress:${token}`);
  return data?.sessionId ?? null;
}
