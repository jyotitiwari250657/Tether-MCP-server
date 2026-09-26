/**
 * Linux Systemd User Service Autostart Manager (TRD §7).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export function generateLinuxService(binaryPath: string): string {
  return `[Unit]
Description=Tether Daemon
After=network.target

[Service]
Type=simple
ExecStart=${binaryPath} serve
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
`;
}

export function installLinuxAutostart(binaryPath: string): string {
  const home = process.env.HOME || '';
  const dir = path.join(home, '.config', 'systemd', 'user');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const servicePath = path.join(dir, 'tether.service');
  fs.writeFileSync(servicePath, generateLinuxService(binaryPath), 'utf-8');
  return servicePath;
}

export function removeLinuxAutostart(): boolean {
  const home = process.env.HOME || '';
  const servicePath = path.join(home, '.config', 'systemd', 'user', 'tether.service');
  if (fs.existsSync(servicePath)) {
    fs.unlinkSync(servicePath);
    return true;
  }
  return false;
}
