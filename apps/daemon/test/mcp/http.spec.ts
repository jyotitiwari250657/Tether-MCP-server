import type { Res } from '@tether/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolDispatcher } from '../../src/router/dispatch.js';
import { DaemonHttpServer } from '../../src/server/http.js';

describe('Daemon MCP Streamable HTTP Transport (Prompt 09-FIX-04)', () => {
  let server: DaemonHttpServer;
  let mockDispatcher: Partial<ToolDispatcher>;
  const testPort = 19896;

  beforeEach(async () => {
    mockDispatcher = {
      dispatchTool: vi
        .fn()
        .mockImplementation(
          async (
            name: string,
            _args: Record<string, unknown>,
            sessionId?: string,
          ): Promise<Res> => {
            if (name === 'browser_snapshot') {
              return {
                v: 1,
                id: 'res-snap',
                session: sessionId ?? 'mcp-default',
                ts: Date.now(),
                kind: 'res',
                reqId: 'req-snap',
                ok: true,
                result: {
                  trust: 'untrusted',
                  url: 'https://example.com',
                  title: 'Example Page',
                  refs: [
                    { ref: 'ref_1', role: 'button', name: 'Submit' },
                    { ref: 'ref_2', role: 'textbox', name: 'Search' },
                  ],
                },
                ms: 12,
              };
            }
            return {
              v: 1,
              id: 'res-ok',
              session: sessionId ?? 'mcp-default',
              ts: Date.now(),
              kind: 'res',
              reqId: 'req-ok',
              ok: true,
              result: { success: true },
              ms: 8,
            };
          },
        ),
    };

    server = new DaemonHttpServer({
      port: testPort,
      dispatcher: mockDispatcher as ToolDispatcher,
    });
    await server.start();
  });

  afterEach(async () => {
    await server.close();
  });

  function parseSsePayload(text: string): Record<string, unknown> {
    const match = text.match(/data:\s*(.*)/);
    return JSON.parse(match?.[1] ? match[1] : text);
  }

  async function initSession(): Promise<string> {
    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-inspector', version: '0.1' },
        },
      }),
    });
    return res.headers.get('mcp-session-id')!;
  }

  it('OPTIONS /mcp with localhost Origin returns 204 with all CORS headers echoed', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:6274',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:6274');
    expect(res.headers.get('vary')).toBe('Origin');
    const allowMethods = res.headers.get('access-control-allow-methods') ?? '';
    expect(allowMethods).toContain('POST');
    expect(allowMethods).toContain('GET');
    expect(allowMethods).toContain('DELETE');
    expect(allowMethods).toContain('OPTIONS');
    const allowHeaders = res.headers.get('access-control-allow-headers') ?? '';
    expect(allowHeaders).toContain('content-type');
    expect(allowHeaders).toContain('mcp-session-id');
    expect(res.headers.get('access-control-expose-headers')).toBe('mcp-session-id');
  });

  it('OPTIONS /mcp with foreign Origin emits no Access-Control-Allow-Origin', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('POST initialize returns 200 with Mcp-Session-Id and echoes protocolVersion', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-inspector', version: '0.1' },
        },
      }),
    });

    expect(res.status).toBe(200);
    const sessionId = res.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const bodyText = await res.text();
    const data = parseSsePayload(bodyText);
    expect(data.result.protocolVersion).toBe('2025-06-18');
    expect(data.result.serverInfo.name).toBe('tether');
  });

  it('POST tools/list with session returns exactly 40 tools', async () => {
    const sessionId = await initSession();
    const toolsRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(toolsRes.status).toBe(200);
    const bodyText = await toolsRes.text();
    const data = parseSsePayload(bodyText);
    expect(data.result.tools).toHaveLength(40);
  });

  it('POST tools/call browser_snapshot with session returns result with trust field and refs', async () => {
    const sessionId = await initSession();
    const callRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'browser_snapshot',
          arguments: {},
        },
      }),
    });

    expect(callRes.status).toBe(200);
    const bodyText = await callRes.text();
    const data = parseSsePayload(bodyText);
    expect(data.result.content).toBeDefined();
    const content = JSON.parse(data.result.content[0].text);
    expect(content.trust).toBe('untrusted');
    expect(content.refs).toHaveLength(2);
    expect(content.refs[0].ref).toBe('ref_1');
  });

  it('GET /mcp with session and Accept: text/event-stream returns 200 with text/event-stream', async () => {
    const sessionId = await initSession();
    const controller = new AbortController();
    const getRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': '2025-06-18',
      },
    });

    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toContain('text/event-stream');
    controller.abort();
  });

  it('DELETE /mcp terminates session and subsequent requests return 404', async () => {
    const sessionId = await initSession();
    const delRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'DELETE',
      headers: {
        'mcp-session-id': sessionId,
        'mcp-protocol-version': '2025-06-18',
      },
    });
    expect(delRes.status).toBe(200);

    const postRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list',
        params: {},
      }),
    });
    expect(postRes.status).toBe(404);
  });

  it('POST tools/list without session id returns 404', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/list',
        params: {},
      }),
    });
    expect(res.status).toBe(404);
  });
});
