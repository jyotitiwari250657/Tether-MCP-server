/**
 * Windows Autostart Manager (TRD §7).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export function getWindowsStartupScriptPath(): string {
  const appData = process.env.APPDATA || '';
  return path.join(
    appData,
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
    'tether-daemon.cmd',
  );
}

export function installWindowsAutostart(binaryPath: string): string {
  const scriptPath = getWindowsStartupScriptPath();
  const dir = path.dirname(scriptPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = `@echo off\r\nstart "" "${binaryPath}" serve\r\n`;
  fs.writeFileSync(scriptPath, content, 'utf-8');
  return scriptPath;
}

export function removeWindowsAutostart(): boolean {
  const scriptPath = getWindowsStartupScriptPath();
  if (fs.existsSync(scriptPath)) {
    fs.unlinkSync(scriptPath);
    return true;
  }
  return false;
}
