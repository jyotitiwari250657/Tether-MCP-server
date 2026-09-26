// FR-109: Service worker keepalive stub (real implementation in P05)
export interface KeepaliveState {
  active: boolean;
  portConnected: boolean;
}

export class Keepalive {
  private active = false;

  public start(): void {
    this.active = true;
    console.log('[Tether] Keepalive started (stub)');
  }

  public stop(): void {
    this.active = false;
    console.log('[Tether] Keepalive stopped (stub)');
  }

  public getState(): KeepaliveState {
    return {
      active: this.active,
      portConnected: false,
    };
  }
}
