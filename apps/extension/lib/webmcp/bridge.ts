// PRD FR-621, SEC-10, TRD §6.15: Main-World WebMCP Bridge
// Interacts with document.modelContext or window.modelContext to discover and invoke site tools.

export interface WebMcpToolDecl {
  name: string;
  description?: string | undefined;
  inputSchema?: Record<string, unknown> | undefined;
}

export interface WebMcpBridgeMessage {
  __tether_webmcp: 1;
  id: string;
  type: 'list_tools' | 'call_tool' | 'tools_result' | 'tool_call_result';
  tools?: WebMcpToolDecl[] | undefined;
  toolName?: string | undefined;
  args?: unknown | undefined;
  result?: unknown | undefined;
  error?: string | undefined;
}

export function initWebMcpBridge(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('message', async (event: MessageEvent) => {
    if (event.source !== window || !event.data || event.data.__tether_webmcp !== 1) {
      return;
    }

    const msg = event.data as WebMcpBridgeMessage;

    // Discover tools declared on window/document.modelContext
    if (msg.type === 'list_tools') {
      const ctx =
        (window as unknown as { modelContext?: { tools?: WebMcpToolDecl[] } }).modelContext ||
        (document as unknown as { modelContext?: { tools?: WebMcpToolDecl[] } }).modelContext;
      const tools: WebMcpToolDecl[] = Array.isArray(ctx?.tools) ? ctx.tools : [];

      window.postMessage(
        {
          __tether_webmcp: 1,
          id: msg.id,
          type: 'tools_result',
          tools,
        } as WebMcpBridgeMessage,
        '*',
      );
      return;
    }

    // Call tool declared on modelContext
    if (msg.type === 'call_tool' && msg.toolName) {
      const ctx = (
        window as unknown as {
          modelContext?: {
            tools?: WebMcpToolDecl[];
            execute?: (name: string, args: unknown) => Promise<unknown>;
          };
        }
      ).modelContext;

      try {
        if (!ctx || typeof ctx.execute !== 'function') {
          throw new Error('WebMCP execute method not found on modelContext');
        }
        const result = await ctx.execute(msg.toolName, msg.args);
        window.postMessage(
          {
            __tether_webmcp: 1,
            id: msg.id,
            type: 'tool_call_result',
            result,
          } as WebMcpBridgeMessage,
          '*',
        );
      } catch (err) {
        window.postMessage(
          {
            __tether_webmcp: 1,
            id: msg.id,
            type: 'tool_call_result',
            error: (err as Error).message || String(err),
          } as WebMcpBridgeMessage,
          '*',
        );
      }
    }
  });
}
