/**
 * Daemon MCP Server (PRD FR-301, TRD §7.3, HR-9, HR-11).
 * Exposes Tether tool surface over Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ToolProfile } from '@tether/protocol';
import type { ToolDispatcher } from '../router/dispatch.js';
import { getMcpTools } from './tools.js';

export interface McpServerOptions {
  dispatcher: ToolDispatcher;
  profile?: ToolProfile | undefined;
  serverInfo?:
    | {
        name: string;
        version: string;
      }
    | undefined;
  sessionId?: string | undefined;
}

export class TetherMcpServer {
  readonly server: Server;
  private dispatcher: ToolDispatcher;
  private profile?: ToolProfile | undefined;
  readonly sessionId: string;

  constructor(opts: McpServerOptions) {
    this.dispatcher = opts.dispatcher;
    this.profile = opts.profile;
    this.sessionId = opts.sessionId ?? 'mcp-default';

    this.server = new Server(
      opts.serverInfo ?? {
        name: 'tether',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = getMcpTools(this.profile);
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    // Call Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: toolArgs } = request.params;
      const args = (toolArgs as Record<string, unknown>) ?? {};

      const res = await this.dispatcher.dispatchTool(name, args, this.sessionId);

      if (!res.ok) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res.error, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: typeof res.result === 'string' ? res.result : JSON.stringify(res.result, null, 2),
          },
        ],
      };
    });
  }
}
