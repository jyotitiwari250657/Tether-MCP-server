/**
 * Bounded Message Queue (TRD §6.11, PRD FR-401).
 * Queues outbound messages up to a cap, dropping oldest non-req events on overflow.
 */

export class BoundedQueue<T> {
  private readonly items: T[] = [];
  readonly maxSize: number;

  constructor(maxSize = 64) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.items.length >= this.maxSize) {
      // Find oldest non-req event to drop if item is Envelope
      let dropIdx = -1;
      for (let i = 0; i < this.items.length; i++) {
        const candidate = this.items[i] as { kind?: string };
        if (candidate?.kind !== 'req') {
          dropIdx = i;
          break;
        }
      }

      if (dropIdx !== -1) {
        this.items.splice(dropIdx, 1);
      } else {
        // All items are reqs, drop FIFO head
        this.items.shift();
      }
    }
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }

  getItems(): readonly T[] {
    return this.items;
  }
}
