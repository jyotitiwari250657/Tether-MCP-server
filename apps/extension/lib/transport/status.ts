/**
 * Shared Transport Status Hook & Helpers (Prompt 09-FIX-03, TRD §6.11).
 * Synchronizes live transport status with background SW for Popup and Sidepanel.
 */

import { useEffect, useState } from 'react';
import type { TransportState } from './client.js';

export interface TransportStatusDisplay {
  label: 'Connected' | 'Connecting…' | 'Not Connected';
  colorClass: string;
  dotClass: string;
}

export function getStatusDisplay(state: TransportState): TransportStatusDisplay {
  switch (state) {
    case 'online':
      return {
        label: 'Connected',
        colorClass: 'text-teal-fg',
        dotClass: 'bg-dot-on',
      };
    case 'connecting':
    case 'backoff':
      return {
        label: 'Connecting…',
        colorClass: 'text-amber-fg',
        dotClass: 'bg-dot-wait animate-pulse',
      };
    default:
      return {
        label: 'Not Connected',
        colorClass: 'text-text-500',
        dotClass: 'bg-dot-off',
      };
  }
}

export function useTransportStatus() {
  const [state, setState] = useState<TransportState>('idle');

  useEffect(() => {
    let active = true;

    const queryStatus = () => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
      try {
        chrome.runtime.sendMessage({ type: 'get_transport_status' }, (res) => {
          if (!active) return;
          if (chrome.runtime?.lastError) return;
          if (res && typeof res === 'object' && 'state' in res) {
            setState((res as { state: TransportState }).state);
          }
        });
      } catch {}
    };

    // Initial query on mount
    queryStatus();

    // If no response or while visible, retry every 2s
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        queryStatus();
      }
    }, 2000);

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        queryStatus();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    // Subscribe to live broadcasts
    const messageListener = (msg: unknown) => {
      if (!active || !msg || typeof msg !== 'object') return;
      const m = msg as Record<string, unknown>;
      if (m.type === 'transport.state' && typeof m.state === 'string') {
        setState(m.state as TransportState);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      active = false;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  return {
    state,
    status: getStatusDisplay(state),
    setState,
  };
}
