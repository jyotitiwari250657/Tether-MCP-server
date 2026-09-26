import { describe, expect, it } from 'vitest';
import { signAccessToken } from '../../src/crypto/jwt.js';
import { app } from '../../src/index.js';
import { loadRelayConfig } from '../../src/lib/config.js';
import { getDeviceRegistry } from '../../src/state/device-registry.js';
import { createDevice } from '../../src/store/devices.js';

// PRD FR-601, FR-607, FR-611: MCP Protocol Surface
describe('Relay MCP Protocol Surface (/api/mcp)', () => {
  const config = loadRelayConfig();

  it('rejects unauthenticated requests with 401 and WWW-Authenticate', async () => {
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBeDefined();
    expect(res.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
  });

  it('handles MCP tools/list returning tool schemas', async () => {
    const token = await signAccessToken(
      {
        sub: 'user-mcp-1',
        client_id: 'client-mcp-1',
        device_id: 'dev-mcp-1',
        scope: 'tether:readonly tether:act',
      },
      config.relayUrl,
      `${config.relayUrl}/mcp`,
    );

    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/list',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jsonrpc: string;
      id: number;
      result: { tools: Array<{ name: string; description: string; inputSchema: unknown }> };
    };

    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(101);
    expect(Array.isArray(body.result.tools)).toBe(true);
    expect(body.result.tools.length).toBeGreaterThan(0);

    const snapshotTool = body.result.tools.find((t) => t.name === 'browser_snapshot');
    expect(snapshotTool).toBeDefined();
    expect(snapshotTool?.description).toBeDefined();
  });

  it('handles MCP tools/call by dispatching to device and returning result', async () => {
    const deviceId = 'dev-mcp-active-2';
    await createDevice({
      id: deviceId,
      user_id: 'user-mcp-2',
      label: 'Chrome Extension',
      profile: 'browser-act',
      pub_key: 'test_pub_key_xyz',
      last_seen: Date.now(),
    });

    const registry = getDeviceRegistry();
    await registry.heartbeat(deviceId);

    const token = await signAccessToken(
      {
        sub: 'user-mcp-2',
        client_id: 'client-mcp-2',
        device_id: deviceId,
        scope: 'tether:act',
      },
      config.relayUrl,
      `${config.relayUrl}/mcp`,
    );

    // Concurrently simulate the device receiving the command and posting ingest result
    const pollAndIngestPromise = (async () => {
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 40));
        const cmd = await registry.popNextCommand(deviceId);
        if (cmd) {
          registry.deliverCommandResult(cmd.id, {
            content: [{ type: 'text', text: 'Action completed successfully' }],
          });
          break;
        }
      }
    })();

    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'browser_click',
          arguments: { ref: 'btn-1' },
        },
      }),
    });

    await pollAndIngestPromise;

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jsonrpc: string;
      id: number;
      result: { content: Array<{ type: string; text: string }> };
    };

    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(102);
    expect(body.result.content[0]?.text).toContain('Action completed');
  });

  it('connects to GET /api/mcp SSE stream with valid token', async () => {
    const token = await signAccessToken(
      {
        sub: 'user-mcp-3',
        client_id: 'client-mcp-3',
        device_id: 'dev-mcp-3',
        scope: 'tether:readonly',
      },
      config.relayUrl,
      `${config.relayUrl}/mcp`,
    );

    const res = await app.request('/api/mcp', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });
});
