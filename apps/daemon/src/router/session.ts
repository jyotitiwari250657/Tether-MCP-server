/**
 * Daemon Session Concurrency Lock (TRD §7.4).
 * Enforces single-driver serialization for state-changing actions per session.
 */

export class SessionLock {
  private activeLocks: Map<string, Promise<void>> = new Map();

  async acquire<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.activeLocks.get(sessionId) ?? Promise.resolve();
    let release: () => void = () => {};

    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.activeLocks.set(
      sessionId,
      prev.then(() => next),
    );

    try {
      await prev;
      return await fn();
    } finally {
      release();
      if (this.activeLocks.get(sessionId) === next) {
        this.activeLocks.delete(sessionId);
      }
    }
  }

  isLocked(sessionId: string): boolean {
    return this.activeLocks.has(sessionId);
  }
}
