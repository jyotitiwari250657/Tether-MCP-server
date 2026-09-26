/**
 * Session Lifecycle & Service Worker State (PRD FR-108, FR-109, TRD §6.1, §6.3).
 * Manages active session lifecycle, attached clients count, and state rehydration across SW restarts.
 */

import { append } from '../audit/index.js';
import type { Session, SessionClient, SwState } from './types.js';

const STORAGE_KEY_STATE = 'sw:state';
const STORAGE_KEY_ACTIVE_SESSION = 'sw:session';

let activeSession: Session | null = null;
let attachedClientsCount = 0;
let powerModeEnabled = false;

export async function rehydrate(): Promise<SwState> {
  const defaultState: SwState = {
    v: 1,
    attachedClients: 0,
    powerMode: false,
    policyVersion: '1.0.0',
  };

  if (typeof chrome === 'undefined' || !chrome.storage?.session) {
    return defaultState;
  }

  try {
    const data = await chrome.storage.session.get([STORAGE_KEY_STATE, STORAGE_KEY_ACTIVE_SESSION]);
    const storedState = data[STORAGE_KEY_STATE] as SwState | undefined;

    if (storedState && storedState.v === 1) {
      powerModeEnabled = !!storedState.powerMode;
      attachedClientsCount = storedState.attachedClients || 0;
      activeSession = (data[STORAGE_KEY_ACTIVE_SESSION] as Session | undefined) ?? null;
      return storedState;
    }
  } catch {
    // Return default on error
  }

  await chrome.storage.session.set({ [STORAGE_KEY_STATE]: defaultState });
  return defaultState;
}

export async function startSession(
  client: SessionClient,
  mode: Session['mode'] = 'local',
): Promise<Session> {
  const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `sess-${Date.now()}`;
  const now = Date.now();

  const session: Session = {
    id,
    client,
    mode,
    startedAt: now,
    steps: 0,
    tokensUsed: 0,
    pendingSteps: 0,
  };

  activeSession = session;
  attachedClientsCount++;

  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    await chrome.storage.session.set({
      [STORAGE_KEY_ACTIVE_SESSION]: session,
      [STORAGE_KEY_STATE]: {
        v: 1,
        activeSessionId: id,
        attachedClients: attachedClientsCount,
        powerMode: powerModeEnabled,
        policyVersion: '1.0.0',
      },
    });
  }

  // PRD FR-504: Record session start in audit chain
  await append({
    t: new Date(now).toISOString(),
    session: id,
    client: client.id,
    mode,
    tool: 'session.start',
    tier: 3,
    argsDigest: '0'.repeat(64),
    verdict: 'allow',
  });

  return session;
}

export async function endSession(reason = 'user_close'): Promise<void> {
  const sess = activeSession;
  activeSession = null;
  attachedClientsCount = Math.max(0, attachedClientsCount - 1);

  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    await chrome.storage.session.remove(STORAGE_KEY_ACTIVE_SESSION);
    await chrome.storage.session.set({
      [STORAGE_KEY_STATE]: {
        v: 1,
        attachedClients: attachedClientsCount,
        powerMode: powerModeEnabled,
        policyVersion: '1.0.0',
      },
    });
  }

  if (sess) {
    await append({
      t: new Date().toISOString(),
      session: sess.id,
      client: sess.client.id,
      mode: sess.mode,
      tool: 'session.end',
      tier: 3,
      argsDigest: '0'.repeat(64),
      verdict: 'complete',
    });
  }
}

export function getActiveSession(): Session | null {
  return activeSession;
}

export function getAttachedClients(): number {
  return attachedClientsCount;
}

export function setAttachedClients(count: number): void {
  attachedClientsCount = Math.max(0, count);
}

export function isPowerMode(): boolean {
  return powerModeEnabled;
}

export function setPowerMode(enabled: boolean): void {
  powerModeEnabled = enabled;
}
