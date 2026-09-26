/**
 * System Tray Controller (TRD §7, NFR-109).
 * Lightweight native systray wrapper via systray2.
 */

import SysTray from 'systray2';
import { type TrayCallbacks, buildTrayMenuItems } from './menu.js';

export class DaemonTray {
  private systray: SysTray | null = null;
  private isConnected = false;

  constructor(private readonly callbacks: TrayCallbacks = {}) {}

  async start(): Promise<void> {
    try {
      const menu = buildTrayMenuItems(this.isConnected);
      // Transparent / default 1x1 icon or base64 placeholder for systray
      const defaultIcon = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      this.systray = new SysTray({
        menu: {
          icon: defaultIcon.toString('base64'),
          title: menu.title,
          tooltip: menu.tooltip,
          items: menu.items,
        },
        debug: false,
        copyDir: false,
      });

      this.systray.onClick((action) => {
        if (action.seq_id === 1) {
          this.callbacks.onOpenBrowser?.();
        } else if (action.seq_id === 2) {
          this.callbacks.onCheckUpdates?.();
        } else if (action.seq_id === 3) {
          this.callbacks.onQuit?.();
          this.stop();
        }
      });
    } catch {
      // Systray is optional/headless: ignore failure gracefully
      this.systray = null;
    }
  }

  updateStatus(connected: boolean): void {
    this.isConnected = connected;
    if (this.systray) {
      try {
        const menu = buildTrayMenuItems(this.isConnected);
        const defaultIcon = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        );
        this.systray.sendAction({
          type: 'update-menu',
          menu: {
            icon: defaultIcon.toString('base64'),
            title: menu.title,
            tooltip: menu.tooltip,
            items: menu.items,
          },
        });
      } catch {
        // Ignore update failure
      }
    }
  }

  stop(): void {
    if (this.systray) {
      try {
        this.systray.kill();
      } catch {
        // Ignore kill failure
      }
      this.systray = null;
    }
  }
}
