/**
 * Platform Autostart Router (TRD §7).
 */

import { installLinuxAutostart, removeLinuxAutostart } from './linux.js';
import { installMacOsAutostart, removeMacOsAutostart } from './macos.js';
import { installWindowsAutostart, removeWindowsAutostart } from './windows.js';

export function installAutostart(
  binaryPath = process.execPath,
  platform: NodeJS.Platform = process.platform,
): string {
  switch (platform) {
    case 'win32':
      return installWindowsAutostart(binaryPath);
    case 'darwin':
      return installMacOsAutostart(binaryPath);
    default:
      return installLinuxAutostart(binaryPath);
  }
}

export function removeAutostart(platform: NodeJS.Platform = process.platform): boolean {
  switch (platform) {
    case 'win32':
      return removeWindowsAutostart();
    case 'darwin':
      return removeMacOsAutostart();
    default:
      return removeLinuxAutostart();
  }
}
