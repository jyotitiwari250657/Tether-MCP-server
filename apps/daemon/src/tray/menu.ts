/**
 * Tray Menu Configuration (TRD §7, NFR-109).
 */

export interface TrayCallbacks {
  onOpenBrowser?: () => void;
  onQuit?: () => void;
  onCheckUpdates?: () => void;
}

export function buildTrayMenuItems(connected: boolean): {
  title: string;
  tooltip: string;
  items: Array<{ title: string; tooltip: string; checked?: boolean; enabled?: boolean }>;
} {
  return {
    title: 'Tether',
    tooltip: `Tether Daemon - ${connected ? 'Extension Connected' : 'Extension Offline'}`,
    items: [
      {
        title: `Status: ${connected ? 'Online' : 'Offline'}`,
        tooltip: 'Connection status to Chrome extension',
        enabled: false,
      },
      {
        title: 'Open Pair Page',
        tooltip: 'Open pairing screen in browser',
        enabled: true,
      },
      {
        title: 'Check for Updates',
        tooltip: 'Check for new Tether releases',
        enabled: true,
      },
      {
        title: 'Quit Tether',
        tooltip: 'Stop daemon and exit',
        enabled: true,
      },
    ],
  };
}
