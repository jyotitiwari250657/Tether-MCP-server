/**
 * Daemon Configuration Manager (PRD FR-301, TRD §7.1).
 * Loads and persists settings from ~/.tether/config.toml.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import toml from 'toml';

export interface DaemonConfig {
  wsPort: number;
  httpPort: number;
  bindHost: string;
  extensionId: string;
  allowedOrigins: string[];
}

export const DEFAULT_CONFIG: DaemonConfig = {
  wsPort: 18795,
  httpPort: 18796,
  bindHost: '127.0.0.1',
  extensionId: '',
  allowedOrigins: ['chrome-extension://*'],
};

export function getTetherDir(): string {
  const tetherDir = join(homedir(), '.tether');
  if (!existsSync(tetherDir)) {
    mkdirSync(tetherDir, { recursive: true, mode: 0o700 });
  }
  return tetherDir;
}

export function getConfigPath(): string {
  return join(getTetherDir(), 'config.toml');
}

export function loadConfig(): DaemonConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = toml.parse(raw) as Partial<DaemonConfig>;
    return {
      wsPort: parsed.wsPort ?? DEFAULT_CONFIG.wsPort,
      httpPort: parsed.httpPort ?? DEFAULT_CONFIG.httpPort,
      bindHost: '127.0.0.1', // strictly locked to loopback per PRD FR-301, SEC-07
      extensionId: parsed.extensionId ?? DEFAULT_CONFIG.extensionId,
      allowedOrigins: parsed.allowedOrigins ?? DEFAULT_CONFIG.allowedOrigins,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cfg: DaemonConfig): void {
  const configPath = getConfigPath();
  const tomlContent = [
    '# Tether Daemon Configuration (TRD §7.1)',
    `wsPort = ${cfg.wsPort}`,
    `httpPort = ${cfg.httpPort}`,
    `bindHost = "${cfg.bindHost}"`,
    `extensionId = "${cfg.extensionId}"`,
    `allowedOrigins = ${JSON.stringify(cfg.allowedOrigins)}`,
    '',
  ].join('\n');

  writeFileSync(configPath, tomlContent, { encoding: 'utf-8', mode: 0o600 });
}
