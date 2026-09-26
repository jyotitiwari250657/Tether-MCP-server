/**
 * Service Worker Bootstrapping & Lifecycle (PRD FR-108, FR-401..FR-405, TRD §6.1).
 * Initializes connection to local daemon with automatic loopback bootstrap handshake.
 */

import type { TransportClient } from '../transport/client.js';

export async function bootstrap(transport: TransportClient): Promise<void> {
  console.log('[Tether] Bootstrapping transport connection');
  if (typeof chrome !== 'undefined' && chrome.storage?.session?.setAccessLevel) {
    try {
      await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      });
    } catch {}
  }
  await transport.ensureConnected();
}
