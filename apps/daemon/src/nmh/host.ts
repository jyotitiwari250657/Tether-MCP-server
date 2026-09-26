/**
 * Native Messaging Host Protocol Runner (PRD FR-308, TRD §7.8).
 * 32-bit uint32 LE length prefix, chunks ≤900 KB.
 */

import type { Readable, Writable } from 'node:stream';

export const MAX_NMH_CHUNK_BYTES = 900 * 1024; // 900 KB (TRD §7.8)

export async function readNativeMessage(
  input: Readable = process.stdin,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve, reject) => {
    let lengthBuffer = Buffer.alloc(0);
    let messageLength: number | null = null;
    let messageBuffer = Buffer.alloc(0);

    const onData = (chunk: Buffer) => {
      let offset = 0;

      if (messageLength === null) {
        const needed = 4 - lengthBuffer.length;
        const available = chunk.length;
        const toCopy = Math.min(needed, available);

        lengthBuffer = Buffer.concat([lengthBuffer, chunk.subarray(0, toCopy)]);
        offset += toCopy;

        if (lengthBuffer.length === 4) {
          messageLength = lengthBuffer.readUInt32LE(0);
        }
      }

      if (messageLength !== null && offset < chunk.length) {
        const remainingMessage = messageLength - messageBuffer.length;
        const availableInChunk = chunk.length - offset;
        const toTake = Math.min(remainingMessage, availableInChunk);

        messageBuffer = Buffer.concat([messageBuffer, chunk.subarray(offset, offset + toTake)]);

        if (messageBuffer.length === messageLength) {
          cleanup();
          try {
            const parsed = JSON.parse(messageBuffer.toString('utf-8'));
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse NMH message: ${String(err)}`));
          }
        }
      }
    };

    const onEnd = () => {
      cleanup();
      resolve(null);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
    };

    input.on('data', onData);
    input.on('end', onEnd);
    input.on('error', onError);
  });
}

export function writeNativeMessage(
  msg: Record<string, unknown>,
  output: Writable = process.stdout,
): void {
  const jsonStr = JSON.stringify(msg);
  const msgBuf = Buffer.from(jsonStr, 'utf-8');

  if (msgBuf.length > MAX_NMH_CHUNK_BYTES) {
    throw new Error(`NMH message length ${msgBuf.length} exceeds 900 KB chunk limit (TRD §7.8)`);
  }

  const header = Buffer.alloc(4);
  header.writeUInt32LE(msgBuf.length, 0);

  output.write(header);
  output.write(msgBuf);
}
