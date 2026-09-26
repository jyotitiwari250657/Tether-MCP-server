/**
 * macOS LaunchAgent Autostart Manager (TRD §7).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const MACOS_PLIST_ID = 'com.tether.daemon';

export function generateMacOsPlist(binaryPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MACOS_PLIST_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binaryPath}</string>
    <string>serve</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/tether.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/tether.err</string>
</dict>
</plist>
`;
}

export function installMacOsAutostart(binaryPath: string): string {
  const home = process.env.HOME || '';
  const dir = path.join(home, 'Library', 'LaunchAgents');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const plistPath = path.join(dir, `${MACOS_PLIST_ID}.plist`);
  fs.writeFileSync(plistPath, generateMacOsPlist(binaryPath), 'utf-8');
  return plistPath;
}

export function removeMacOsAutostart(): boolean {
  const home = process.env.HOME || '';
  const plistPath = path.join(home, 'Library', 'LaunchAgents', `${MACOS_PLIST_ID}.plist`);
  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
    return true;
  }
  return false;
}
