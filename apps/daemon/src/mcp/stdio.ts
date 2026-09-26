/**
 * Daemon MCP Stdio Server Transport (PRD FR-301, TRD §7.3).
 * Runs MCP server over standard input/output for CLI harnesses.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { TetherMcpServer } from './server.js';

export async function runMcpStdio(mcpServer: TetherMcpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await mcpServer.server.connect(transport);
}
