import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  generateNmhManifest,
  getDefaultManifestPath,
  readNativeMessage,
  writeNativeMessage,
} from '../../src/nmh/index.js';

describe('Native Messaging Host (PRD FR-308, TRD §7.8)', () => {
  it('generates NMH manifest with allowed extension origins', () => {
    const manifest = generateNmhManifest('/path/to/tether', ['abcdef']);
    expect(manifest.name).toBe('com.tether.native');
    expect(manifest.allowed_origins).toContain('chrome-extension://abcdef/');
  });

  it('returns default manifest path per platform', () => {
    expect(getDefaultManifestPath('win32')).toContain('nmh-manifest.json');
    expect(getDefaultManifestPath('darwin')).toContain('NativeMessagingHosts');
    expect(getDefaultManifestPath('linux')).toContain('NativeMessagingHosts');
  });

  it('reads length-prefixed native message from stream', async () => {
    const stream = new PassThrough();
    const payload = { action: 'ping', test: 123 };
    const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf-8');

    const header = Buffer.alloc(4);
    header.writeUInt32LE(jsonBuf.length, 0);

    stream.write(header);
    stream.write(jsonBuf);
    stream.end();

    const read = await readNativeMessage(stream);
    expect(read).toEqual(payload);
  });

  it('writes length-prefixed native message to stream', async () => {
    const stream = new PassThrough();
    const payload = { ok: true, status: 'pong' };

    writeNativeMessage(payload, stream);
    stream.end();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const full = Buffer.concat(chunks);

    const length = full.readUInt32LE(0);
    const body = JSON.parse(full.subarray(4, 4 + length).toString('utf-8'));
    expect(body).toEqual(payload);
  });

  it('rejects messages larger than 900 KB (TRD §7.8)', () => {
    const stream = new PassThrough();
    const largeObj = { big: 'x'.repeat(900 * 1024 + 100) };

    expect(() => writeNativeMessage(largeObj, stream)).toThrow(/exceeds 900 KB chunk limit/);
  });
});
