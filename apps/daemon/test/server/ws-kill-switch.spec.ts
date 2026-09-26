import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDaemonAuditLog, getDaemonAuditLog } from '../../src/server/bootstrap.js';
import { DaemonWsServer } from '../../src/server/ws.js';
import { TEST_TOKEN, openWs, readJson, sendHello, sendKillEvt } from './helpers.js';

// Prompt 12 AC-P12-01 (PRD HR-10): the kill switch is absolute — it survives
// extension reconnects and clears only on an explicit user-gesture reset.
// The daemon must NEVER re-arm on an authenticated hello handshake.

describe('Daemon Kill Switch lifecycle (AC-P12-01, PRD HR-10)', () => {
  let server: DaemonWsServer;
  const testPort = 19877;

  /** Engages the kill switch the way the extension does (kill evt + close 4002). */
  const engageKillSwitch = async (): Promise<void> => {
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'kill-hello', { token: TEST_TOKEN });
    await readJson(ws); // hello-ack
    sendKillEvt(ws);
    ws.close(4002, 'user_kill_switch');
    await new Promise((r) => setTimeout(r, 50));
  };

  beforeEach(async () => {
    clearDaemonAuditLog();
    server = new DaemonWsServer({
      port: testPort,
      token: TEST_TOKEN,
      pinnedExtensionId: 'abcdefghijklmnop',
      onRequest: async (req) => ({
        v: 1,
        id: req.id,
        session: req.session,
        ts: Date.now(),
        kind: 'res',
        reqId: req.id,
        ok: true,
        result: { echo: req.tool },
        ms: 1,
      }),
    });
    await server.start();
  });

  afterEach(async () => {
    server.setMockRemoteAddress(null);
    await server.close();
  });

  it('AC-P12-01: authenticated hello reconnect does NOT clear killSwitchEngaged (HR-10)', async () => {
    await engageKillSwitch();
    expect(server.isKillSwitchEngaged()).toBe(true);

    // A fresh extension reconnect (the exact race from the P11 report)
    const ws2 = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws2, 'h-reconnect', { token: TEST_TOKEN });
    const ack = await readJson(ws2);
    expect(ack.evt).toBe('hello-ack');

    expect(server.isKillSwitchEngaged()).toBe(true); // still engaged
    ws2.close();
  });

  it('AC-P12-01: reset_kill_switch message clears the flag and emits an audit entry (HR-10)', async () => {
    await engageKillSwitch();
    expect(server.isKillSwitchEngaged()).toBe(true);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    sendHello(ws, 'h-reset', { token: TEST_TOKEN });
    await readJson(ws); // hello-ack; flag STILL engaged
    expect(server.isKillSwitchEngaged()).toBe(true);

    ws.send(JSON.stringify({ type: 'reset_kill_switch' }));
    await new Promise((r) => setTimeout(r, 50));

    expect(server.isKillSwitchEngaged()).toBe(false);
    const audit = getDaemonAuditLog().find((e) => e.tool === 'daemon.reset_kill_switch');
    expect(audit).toBeDefined();
    expect(audit?.verdict).toBe('allow');
    expect(logSpy.mock.calls.map((c) => c.join(' ')).join('\n')).toContain(
      '[Tether] kill switch reset by user',
    );
    logSpy.mockRestore();
    ws.close();
  });

  it('AC-P12-01: unauthenticated socket cannot reset the kill switch (HR-10/HR-12)', async () => {
    await engageKillSwitch();
    const ws = await openWs(testPort, { Origin: 'chrome-extension://abcdefghijklmnop' });
    // No hello — this socket is not authenticated and is not the active socket.
    ws.send(JSON.stringify({ type: 'reset_kill_switch' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(server.isKillSwitchEngaged()).toBe(true);
    expect(getDaemonAuditLog().some((e) => e.tool === 'daemon.reset_kill_switch')).toBe(false);
    ws.close();
  });
});
