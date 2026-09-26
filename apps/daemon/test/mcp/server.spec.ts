import type { Res } from '@tether/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TetherMcpServer } from '../../src/mcp/server.js';
import { getMcpTools } from '../../src/mcp/tools.js';
import type { ToolDispatcher } from '../../src/router/dispatch.js';

describe('Daemon MCP Server (PRD FR-301, TRD §7.3, HR-9, HR-11)', () => {
  let mockDispatcher: Partial<ToolDispatcher>;
  let mcpServer: TetherMcpServer;

  beforeEach(() => {
    mockDispatcher = {
      dispatchTool: vi.fn().mockResolvedValue({
        v: 1,
        id: 'r-1',
        session: 's-1',
        ts: Date.now(),
        kind: 'res',
        reqId: 'req-1',
        ok: true,
        result: { elementCount: 5 },
        ms: 10,
      } as Res),
    };

    mcpServer = new TetherMcpServer({
      dispatcher: mockDispatcher as ToolDispatcher,
    });
  });

  it('generates MCP tool definitions for all tools', () => {
    const tools = getMcpTools();
    expect(tools.length).toBeGreaterThanOrEqual(40);
    const clickTool = tools.find((t) => t.name === 'browser_click');
    expect(clickTool).toBeDefined();
    expect(clickTool?.inputSchema).toBeDefined();
  });

  it('filters MCP tools by profile', () => {
    const readonlyTools = getMcpTools('browser-readonly');
    expect(readonlyTools.length).toBeGreaterThan(0);
    expect(readonlyTools.some((t) => t.name === 'browser_click')).toBe(false);
    expect(readonlyTools.some((t) => t.name === 'browser_snapshot')).toBe(true);
  });

  it('initializes Server instance with tools capability', () => {
    expect(mcpServer.server).toBeDefined();
  });
});
