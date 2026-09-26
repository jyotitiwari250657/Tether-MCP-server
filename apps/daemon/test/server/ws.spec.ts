import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { clearDaemonAuditLog, getDaemonAuditLog } from '../../src/server/bootstrap.js';
import { DaemonWsServer } from '../../src/server/ws.js';
import { TEST_TOKEN, makeServerConfig, openWs, readJson, sendHello } from './helpers.js';

// TRD §7.2, PRD FR-301, SEC-07: daemon WebSocket server handshake, routing and
// redaction guarantees. Kill-switch lifecycle specs live in ws-kill-switch.spec.ts.

describe('Daemon WebSocket Server (PRD FR-301, SEC-07, TRD §7.2)', () => {
  let server: DaemonWsServer;
  const testPort = 19875;

  beforeEach(async () => {
    clearDaemonAuditLog();
    server = new DaemonWsServer(makeServerConfig(testPort));
    await server.start();
  });

  afterEach(async () => {
    server.setMockRemoteAddress(null);
    await server.close();
  });

  it('rejects connection without chrome-extension origin', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}`, {
      headers: { Origin: 'http://malicious.site' },
    });
    const closeCode = await new Promise<number>((r) => {
      ws.on('error', () => {});
      ws.on('close', (code) => r(code));
    });
    expect(closeCode).toBe(1006); // HTTP handshake rejected with 403
  });

  it('immediately returns DEVICE_OFFLINE when extension is not connected', async () => {
    expect(server.isExtensionConnected()).toBe(false);
    const req = {
      v: 1,
      id: 'test-req-1',
      session: 'sess-1',
      ts: Date.now(),
      kind: 'req',
      tool: 'browser_click',
      args: { ref: 'ref-1' },
      token: '',
      idem: 'test-req-1',
      budgetMs: 5000,
    } as const;
    const res = await server.sendRequest(req);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DEVICE_OFFLINE');
      expect(res.error.hint).toContain('Tether extension');
    }
  });

  it('authenticates extension via hello handshake and routes requests', async () => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h-1', { token: TEST_TOKEN });
    const ack = await readJson(ws);
    expect(ack.evt).toBe('hello-ack');
    expect(server.isExtensionConnected()).toBe(true);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.kind === 'req') {
        ws.send(
          JSON.stringify({
            v: 1,
            id: msg.id,
            session: msg.session,
            ts: Date.now(),
            kind: 'res',
            reqId: msg.id,
            ok: true,
            result: { clicked: true },
            ms: 10,
          }),
        );
      }
    });

    const res = await server.sendRequest({
      v: 1,
      id: 'test-req-2',
      session: 'sess-2',
      ts: Date.now(),
      kind: 'req',
      tool: 'browser_click',
      args: { ref: 'ref-btn' },
      token: '',
      idem: 'test-req-2',
      budgetMs: 5000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result).toEqual({ clicked: true });
    ws.close();
  });

  it('handles extension incoming request (e.g. vault request)', async () => {
    const ws = await openWs(testPort, {
      Origin: 'chrome-extension://abcdefghijklmnop',
      Authorization: `Bearer ${TEST_TOKEN}`,
    });
    ws.send(
      JSON.stringify({
        v: 1,
        id: 'ext-req-1',
        session: 'vault',
        ts: Date.now(),
        kind: 'req',
        tool: 'vault.list',
        args: {},
        token: '',
        idem: 'ext-req-1',
        budgetMs: 5000,
      }),
    );
    const res = (await readJson(ws)) as { ok: boolean; result?: { echo: string } };
    expect(res.ok).toBe(true);
    expect(res.result).toEqual({ echo: 'vault.list' });
    ws.close();
  });

  it('hello token: null + eligible -> ack WITH token', async () => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h-null', { token: null });
    const ack = await readJson(ws);
    expect(ack.evt).toBe('hello-ack');
    const payload = ack.payload as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.token).toBe(TEST_TOKEN);
    expect(server.isExtensionConnected()).toBe(true);
    const audit = getDaemonAuditLog().find((e) => e.tool === 'daemon.bootstrap');
    expect(audit).toBeDefined();
    expect(audit?.verdict).toBe('allow');
    expect(audit?.detail).toBe('loopback token issued');
    expect(JSON.stringify(getDaemonAuditLog())).not.toContain(TEST_TOKEN);
    ws.close();
  });

  it('hello field omitted + eligible -> ack WITH token', async () => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h-omitted', {});
    const ack = await readJson(ws);
    expect(ack.evt).toBe('hello-ack');
    const payload = ack.payload as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.token).toBe(TEST_TOKEN);
    expect(server.isExtensionConnected()).toBe(true);
    const audit = getDaemonAuditLog().find((e) => e.tool === 'daemon.bootstrap');
    expect(audit?.verdict).toBe('allow');
    expect(audit?.detail).toBe('loopback token issued');
    ws.close();
  });

  it('hello with STALE token + eligible -> ack WITH NEW token; old token rejected afterwards', async () => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    const staleToken = 'stale-token-12345678901234567890123456789012';
    sendHello(ws, 'h-stale', { token: staleToken });
    const ack = await readJson(ws);
    expect(ack.evt).toBe('hello-ack');
    const payload = ack.payload as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(typeof payload.token).toBe('string');
    expect(payload.token).not.toBe(staleToken);
    expect(payload.token).not.toBe(TEST_TOKEN);
    const newToken = payload.token as string;
    expect(server.getToken()).toBe(newToken);
    expect(server.verifyToken(staleToken)).toBe(false);
    expect(server.verifyToken(TEST_TOKEN)).toBe(false);
    expect(server.verifyToken(newToken)).toBe(true);

    const audit = getDaemonAuditLog().find(
      (e) => e.tool === 'daemon.bootstrap' && e.detail === 'stale token rotated',
    );
    expect(audit).toBeDefined();
    expect(audit?.verdict).toBe('allow');
    ws.close();
  });

  it('hello with STALE token + non-loopback peer -> reject, reason invalid-token-non-eligible', async () => {
    server.setMockRemoteAddress('192.168.1.100');
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h-stale-remote', { token: 'stale-token-xyz' });
    const code = await new Promise<number>((r) => ws.on('close', (c) => r(c)));
    expect(code).toBe(4001);
    const audit = getDaemonAuditLog().find((e) => e.tool === 'daemon.handshake');
    expect(audit?.verdict).toBe('deny');
    expect(audit?.detail).toBe('invalid-token-non-eligible');
  });

  it('hello with STALE token + wrong origin -> reject, reason origin-mismatch', async () => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://wrong-extension-id' });
    sendHello(ws, 'h-stale-origin', { token: 'stale-token-xyz' });
    const code = await new Promise<number>((r) => ws.on('close', (c) => r(c)));
    expect(code).toBe(4001);
    const audit = getDaemonAuditLog().find((e) => e.tool === 'daemon.handshake');
    expect(audit?.verdict).toBe('deny');
    expect(audit?.detail).toBe('origin-mismatch');
  });

  it('reject log line contains origin= and tokenPresent= and does NOT contain the token string', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const secretToken = 'secret-do-not-leak-9876543210';
    server.setMockRemoteAddress('192.168.1.50');
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h-spy', { token: secretToken });
    await new Promise<number>((r) => ws.on('close', (c) => r(c)));

    const logged = warnSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    warnSpy.mockRestore();

    expect(logged).toContain('origin=chrome-extension://abcdefghijklmnop');
    expect(logged).toContain('peer=192.168.1.50');
    expect(logged).toContain('tokenPresent=true');
    expect(logged).toContain('handshake rejected: invalid-token-non-eligible');
    expect(logged).not.toContain(secretToken);
  });

  it('hello with valid stored token -> ack without re-issuing', async () => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h4', { token: TEST_TOKEN });
    const ack = await readJson(ws);
    expect(ack.evt).toBe('hello-ack');
    const payload = ack.payload as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.token).toBeUndefined();
    ws.close();
  });
});
