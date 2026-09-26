// PRD FR-601, FR-607, TRD §6.11: Mode B HTTP Long-Poll Transport
export interface LongPollConfig {
  relayUrl: string;
  deviceId: string;
  devicePubKey?: string | undefined;
  timeoutMs?: number | undefined;
}

export type CommandHandler = (cmd: {
  id: string;
  sessionId: string;
  envelope: unknown;
}) => Promise<unknown>;

export class HttpLongPollTransport {
  private abortController: AbortController | null = null;
  private isRunning = false;
  private onCommandHandler: CommandHandler | null = null;

  constructor(private readonly config: LongPollConfig) {}

  onCommand(handler: CommandHandler): void {
    this.onCommandHandler = handler;
  }

  get active(): boolean {
    return this.isRunning;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();
    void this.pollLoop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async sendIngest(commandId: string, result: unknown): Promise<boolean> {
    try {
      const url = `${this.config.relayUrl.replace(/\/$/, '')}/api/device/ingest`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': this.config.deviceId,
        },
        body: JSON.stringify({ commandId, result }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async pollLoop(): Promise<void> {
    const baseUrl = this.config.relayUrl.replace(/\/$/, '');
    const pollUrl = `${baseUrl}/api/device/poll?deviceId=${encodeURIComponent(this.config.deviceId)}${this.config.timeoutMs ? `&timeout=${this.config.timeoutMs}` : ''}`;

    while (this.isRunning) {
      try {
        const res = await fetch(pollUrl, {
          method: 'GET',
          headers: {
            'x-device-id': this.config.deviceId,
            'x-device-pubkey': this.config.devicePubKey ?? '',
          },
          signal: this.abortController ? this.abortController.signal : null,
        });

        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          idle?: boolean;
          command?: { id: string; sessionId: string; envelope: unknown };
        };

        if (data.command && this.onCommandHandler) {
          const result = await this.onCommandHandler(data.command);
          await this.sendIngest(data.command.id, result);
        } else if (data.idle) {
          await new Promise((r) => setTimeout(r, 50));
        }
      } catch (err: unknown) {
        if (!this.isRunning) break;
        // Backoff delay on connection error
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}
