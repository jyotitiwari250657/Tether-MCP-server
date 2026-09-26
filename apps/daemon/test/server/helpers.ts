// TRD §7.2 / TRD §4.3: shared helpers for the daemon WS server specs.
// Extracted in Prompt 12 so each spec file stays under the 300-line cap.
import type { Req, Res } from '@tether/protocol';
import WebSocket from 'ws';

export const TEST_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export const makeServerConfig = (port: number) => ({
  port,
  token: TEST_TOKEN,
  pinnedExtensionId: 'abcdefghijklmnop',
  onRequest: async (req: Req): Promise<Res> => ({
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

export const openWs = async (port: number, headers: Record<string, string>): Promise<WebSocket> => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers });
  await new Promise<void>((resolve) => ws.on('open', () => resolve()));
  return ws;
};

export const sendHello = (ws: WebSocket, id: string, payload: Record<string, unknown>): void => {
  ws.send(
    JSON.stringify({
      v: 1,
      id,
      session: id,
      ts: Date.now(),
      kind: 'evt',
      evt: 'hello',
      payload,
    }),
  );
};

export const readJson = async (ws: WebSocket): Promise<Record<string, unknown>> => {
  const raw = await new Promise<string>((r) => ws.once('message', (d) => r(d.toString())));
  return JSON.parse(raw);
};

/** Sends the kill event exactly the way the extension does (HR-10). */
export const sendKillEvt = (ws: WebSocket): void => {
  ws.send(
    JSON.stringify({
      v: 1,
      id: 'kill-1',
      session: 'kill',
      ts: Date.now(),
      kind: 'evt',
      evt: 'kill',
      payload: { reason: 'user_kill_switch' },
    }),
  );
};
