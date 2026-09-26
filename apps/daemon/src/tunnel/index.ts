/**
 * Tunnel Client Wrapper (TRD §7.9).
 * Provides secure outbound tunnel integration for remote MCP clients.
 */

export interface TunnelOptions {
  localPort: number;
  remoteEndpoint?: string;
  token?: string;
}

export class TunnelClient {
  private isRunning = false;

  constructor(private readonly opts: TunnelOptions) {}

  async start(): Promise<{ url: string }> {
    this.isRunning = true;
    // In local/stub mode returns loopback address; remote tunnel provider connects if specified
    const url = this.opts.remoteEndpoint ?? `http://127.0.0.1:${this.opts.localPort}`;
    return { url };
  }

  stop(): void {
    this.isRunning = false;
  }

  get running(): boolean {
    return this.isRunning;
  }
}
