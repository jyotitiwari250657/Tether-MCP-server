// TRD §8.6, PRD FR-304, FR-606: Device Registry and Command Queue in Vercel KV
import { getKv } from './kv.js';

export interface DevicePresence {
  deviceId: string;
  pubKey: string;
  label: string;
  lastSeen: number;
}

export interface QueuedCommand {
  id: string;
  sessionId: string;
  envelope: {
    ciphertext: string;
    nonce: string;
    ephemPubKey: string;
  };
  createdAt: number;
}

const PRESENCE_TTL_SECONDS = 90;

export async function registerDevicePresence(presence: DevicePresence): Promise<void> {
  const kv = getKv();
  const key = `device:${presence.deviceId}:presence`;
  await kv.set(key, presence, { ex: PRESENCE_TTL_SECONDS });
}

export async function getDevicePresence(deviceId: string): Promise<DevicePresence | null> {
  const kv = getKv();
  return await kv.get<DevicePresence>(`device:${deviceId}:presence`);
}

export async function isDeviceOnline(deviceId: string): Promise<boolean> {
  const presence = await getDevicePresence(deviceId);
  if (!presence) return false;
  return Date.now() - presence.lastSeen < PRESENCE_TTL_SECONDS * 1000;
}

export async function enqueueDeviceCommand(
  deviceId: string,
  command: QueuedCommand,
): Promise<void> {
  const kv = getKv();
  const queueKey = `device:${deviceId}:commands`;
  await kv.lpush(queueKey, command);
}

export async function pollDeviceCommand(deviceId: string): Promise<QueuedCommand | null> {
  const kv = getKv();
  const queueKey = `device:${deviceId}:commands`;
  return await kv.rpop<QueuedCommand>(queueKey);
}

export async function storeDeviceResult(commandId: string, result: unknown): Promise<void> {
  const kv = getKv();
  const resultKey = `result:${commandId}`;
  await kv.set(resultKey, result, { ex: 60 });
}

export async function getDeviceResult<T>(commandId: string): Promise<T | null> {
  const kv = getKv();
  const resultKey = `result:${commandId}`;
  return await kv.get<T>(resultKey);
}

export class DeviceRegistry {
  async heartbeat(deviceId: string) {
    await registerDevicePresence({ deviceId, pubKey: '', label: 'Device', lastSeen: Date.now() });
  }
  async isOnline(deviceId: string) {
    return isDeviceOnline(deviceId);
  }
  async getPresence(deviceId: string) {
    return getDevicePresence(deviceId);
  }
  async enqueueCommand(deviceId: string, cmd: QueuedCommand) {
    return enqueueDeviceCommand(deviceId, cmd);
  }
  async popNextCommand(deviceId: string) {
    return pollDeviceCommand(deviceId);
  }
  deliverCommandResult(commandId: string, result: unknown) {
    void storeDeviceResult(commandId, result);
  }
  async waitForCommandResult<T>(commandId: string, timeoutMs = 25000): Promise<T | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await getDeviceResult<T>(commandId);
      if (res !== null) return res;
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  }
}

let defaultRegistry: DeviceRegistry | null = null;
export function getDeviceRegistry(): DeviceRegistry {
  if (!defaultRegistry) defaultRegistry = new DeviceRegistry();
  return defaultRegistry;
}
