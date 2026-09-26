// TRD §8.6, PRD FR-601: Client-to-Device Command Routing via Vercel KV Queue
import {
  type QueuedCommand,
  enqueueDeviceCommand,
  getDeviceResult,
  isDeviceOnline,
} from '../state/device-registry.js';

export interface DispatchResult<T = unknown> {
  ok: boolean;
  result?: T | undefined;
  error?: string | undefined;
}

export async function dispatchCommandToDevice<T = unknown>(
  deviceId: string,
  sessionId: string,
  envelope: QueuedCommand['envelope'],
  timeoutMs = 25000,
): Promise<DispatchResult<T>> {
  const online = await isDeviceOnline(deviceId);
  if (!online) {
    return { ok: false, error: 'DEVICE_OFFLINE' };
  }

  const commandId = globalThis.crypto.randomUUID();
  const command: QueuedCommand = {
    id: commandId,
    sessionId,
    envelope,
    createdAt: Date.now(),
  };

  await enqueueDeviceCommand(deviceId, command);

  // Poll for result
  const startTime = Date.now();
  const pollIntervalMs = 50;

  while (Date.now() - startTime < timeoutMs) {
    const res = await getDeviceResult<T>(commandId);
    if (res !== null) {
      return { ok: true, result: res };
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return { ok: false, error: 'TIMEOUT' };
}
