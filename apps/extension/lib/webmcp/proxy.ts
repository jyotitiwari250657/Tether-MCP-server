// PRD FR-621, SEC-10, TRD §6.15: WebMCP Proxy (Mode C)
// Enforces origin-based namespacing to prevent tool-name spoofing across origins.
import type { WebMcpBridgeMessage, WebMcpToolDecl } from './bridge.js';

export interface NamespacedTool {
  namespacedName: string;
  originalName: string;
  origin: string;
  description?: string | undefined;
  inputSchema?: Record<string, unknown> | undefined;
}

export function toOriginSlug(urlOrOrigin: string): string {
  try {
    const withProto = urlOrOrigin.includes('://') ? urlOrOrigin : `https://${urlOrOrigin}`;
    const parsed = new URL(withProto);
    return parsed.hostname.toLowerCase().replace(/[^a-z0-9]/g, '_');
  } catch {
    return urlOrOrigin.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
}

export function namespaceTool(origin: string, tool: WebMcpToolDecl): NamespacedTool {
  const slug = toOriginSlug(origin);
  return {
    namespacedName: `site_${slug}__${tool.name}`,
    originalName: tool.name,
    origin,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
}

export function parseNamespacedTool(
  namespacedName: string,
): { originSlug: string; toolName: string } | null {
  const match = /^site_([a-z0-9_]+)__(.+)$/.exec(namespacedName);
  if (!match || !match[1] || !match[2]) return null;
  return {
    originSlug: match[1],
    toolName: match[2],
  };
}

export async function listSiteTools(
  tabId: number,
  origin = 'https://current.page',
): Promise<NamespacedTool[]> {
  if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
    try {
      const res = (await chrome.tabs.sendMessage(tabId, {
        kind: 'webmcp',
        action: 'list_tools',
      })) as { tools?: WebMcpToolDecl[] };
      const rawTools = res?.tools || [];
      return rawTools.map((t) => namespaceTool(origin, t));
    } catch {
      return [];
    }
  }

  // Fallback for tests or local DOM
  if (typeof window !== 'undefined') {
    return new Promise<NamespacedTool[]>((resolve) => {
      const id = `req_${Date.now()}`;
      const timeout = setTimeout(() => resolve([]), 500);

      const listener = (event: MessageEvent) => {
        const msg = event.data as WebMcpBridgeMessage | null;
        if (msg && msg.__tether_webmcp === 1 && msg.id === id && msg.type === 'tools_result') {
          clearTimeout(timeout);
          window.removeEventListener('message', listener);
          const raw = msg.tools || [];
          resolve(raw.map((t) => namespaceTool(origin, t)));
        }
      };

      window.addEventListener('message', listener);
      window.postMessage(
        { __tether_webmcp: 1, id, type: 'list_tools' } as WebMcpBridgeMessage,
        '*',
      );
    });
  }

  return [];
}

export async function callSiteTool(
  tabId: number,
  namespacedName: string,
  args: unknown,
): Promise<unknown> {
  const parsed = parseNamespacedTool(namespacedName);
  if (!parsed) {
    throw new Error(
      `Invalid namespaced tool name: "${namespacedName}". Expected format: site_<origin>__<toolName>`,
    );
  }

  if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
    return await chrome.tabs.sendMessage(tabId, {
      kind: 'webmcp',
      action: 'call_tool',
      toolName: parsed.toolName,
      args,
    });
  }

  // Direct window communication fallback for test environments
  if (typeof window !== 'undefined') {
    return new Promise((resolve, reject) => {
      const id = `call_${Date.now()}`;
      const timeout = setTimeout(() => reject(new Error('WebMCP tool call timed out')), 2000);

      const listener = (event: MessageEvent) => {
        const msg = event.data as WebMcpBridgeMessage | null;
        if (msg && msg.__tether_webmcp === 1 && msg.id === id && msg.type === 'tool_call_result') {
          clearTimeout(timeout);
          window.removeEventListener('message', listener);
          if (msg.error) reject(new Error(msg.error));
          else resolve(msg.result);
        }
      };

      window.addEventListener('message', listener);
      window.postMessage(
        {
          __tether_webmcp: 1,
          id,
          type: 'call_tool',
          toolName: parsed.toolName,
          args,
        } as WebMcpBridgeMessage,
        '*',
      );
    });
  }

  throw new Error('No tab execution context available');
}
