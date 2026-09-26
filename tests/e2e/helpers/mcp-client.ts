// TRD §7.3, AC-E2E-01..07: Minimal MCP-over-HTTP client for E2E and live eval
export interface McpCallResult {
  ok: boolean;
  data?: unknown;
  error?:
    | {
        code?: string | undefined;
        message?: string | undefined;
        hint?: string | undefined;
        diff?: Array<{ label: string; value: string; tone?: string | undefined }> | undefined;
        [key: string]: unknown;
      }
    | undefined;
  raw?: unknown;
}

export class McpTestClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private reqId = 1;

  /**
   * Accepts a port number (preferred — pairs with the harness's dynamic
   * daemon port, AC-P12-02) or a full base URL.
   */
  constructor(baseUrl: number | string = 18796) {
    this.baseUrl = (typeof baseUrl === 'number' ? `http://127.0.0.1:${baseUrl}` : baseUrl).replace(
      /\/+$/,
      '',
    );
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async connect(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Origin: 'http://127.0.0.1:18796',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.reqId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'tether-e2e-client', version: '1.0.0' },
        },
      }),
    });

    const sid = res.headers.get('mcp-session-id');
    if (!sid) throw new Error(`Failed to obtain mcp-session-id: status=${res.status}`);
    this.sessionId = sid;

    await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': this.sessionId,
        Origin: 'http://127.0.0.1:18796',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    return sid;
  }

  async call(tool: string, args: Record<string, unknown> = {}): Promise<McpCallResult> {
    if (!this.sessionId) await this.connect();

    const res = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': this.sessionId ?? '',
        Origin: 'http://127.0.0.1:18796',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.reqId++,
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
    });

    const text = await res.text();
    let jsonRpc: Record<string, unknown> | null = null;
    if (text.includes('data:')) {
      const dataLines = text
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);
      const lastLine = dataLines[dataLines.length - 1];
      if (lastLine)
        try {
          jsonRpc = JSON.parse(lastLine);
        } catch {}
    } else {
      try {
        jsonRpc = JSON.parse(text);
      } catch {}
    }

    if (!jsonRpc)
      return {
        ok: false,
        error: { code: 'PARSE_ERROR', message: `Unparseable: ${text}` },
        raw: text,
      };
    if (jsonRpc.error && typeof jsonRpc.error === 'object') {
      const errObj = jsonRpc.error as Record<string, unknown>;
      return {
        ok: false,
        error: {
          code: String(errObj.code ?? 'RPC_ERROR'),
          message: String(errObj.message ?? ''),
          ...errObj,
        },
        raw: jsonRpc,
      };
    }

    const r = jsonRpc.result as Record<string, unknown> | undefined;
    const content = r?.content as Array<{ type: string; text: string }> | undefined;
    const isError = Boolean(r?.isError);
    let parsedContent: unknown = null;

    if (
      Array.isArray(content) &&
      content[0]?.type === 'text' &&
      typeof content[0]?.text === 'string'
    ) {
      try {
        parsedContent = JSON.parse(content[0].text);
      } catch {
        parsedContent = content[0].text;
      }
    }

    if (
      isError ||
      (parsedContent && typeof parsedContent === 'object' && 'code' in parsedContent)
    ) {
      return {
        ok: false,
        error:
          typeof parsedContent === 'object'
            ? (parsedContent as McpCallResult['error'])
            : { message: String(parsedContent) },
        data: parsedContent,
        raw: jsonRpc,
      };
    }

    return { ok: true, data: parsedContent ?? r, raw: jsonRpc };
  }

  async close(): Promise<void> {
    if (this.sessionId) {
      const sid = this.sessionId;
      this.sessionId = null;
      try {
        await fetch(`${this.baseUrl}/mcp`, {
          method: 'DELETE',
          headers: { 'mcp-session-id': sid, Origin: 'http://127.0.0.1:18796' },
        });
      } catch {}
    }
  }
}
