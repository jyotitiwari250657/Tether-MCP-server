// TRD §4.3: event-registry base extracted from TransportClient so client.ts
// stays under the 300-line cap. Behavior is identical to the inline version.
export type EventHandler = (payload: unknown) => void;

export class EventEmitterBase {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  on(evt: string, handler: EventHandler): () => void {
    let set = this.handlers.get(evt);
    if (!set) {
      set = new Set();
      this.handlers.set(evt, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  emit(evt: string, payload: unknown): void {
    const set = this.handlers.get(evt);
    if (set) {
      for (const h of set) {
        try {
          h(payload);
        } catch {}
      }
    }
  }
}
