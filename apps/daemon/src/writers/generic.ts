/**
 * Generic JSON Harness Writer (TRD §7.5).
 */

import * as fs from 'node:fs';
import type { ConfigWriteResult, HarnessConfigOptions, HarnessWriter } from './types.js';
import { backupAndWrite, resolveHome } from './utils.js';

export class GenericJsonWriter implements HarnessWriter {
  readonly name = 'generic';
  readonly defaultPath: string;

  constructor(defaultPath = 'mcp.json') {
    this.defaultPath = defaultPath;
  }

  async writeConfig(opts: HarnessConfigOptions = {}): Promise<ConfigWriteResult> {
    const targetPath = opts.customPath ?? this.defaultPath;
    const resolved = resolveHome(targetPath);
    const profile = opts.profile ?? 'browser-act';

    let config: Record<string, unknown> = {};
    if (fs.existsSync(resolved)) {
      try {
        config = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
      } catch {
        config = {};
      }
    }

    const mcpServers = (config.mcpServers as Record<string, unknown>) ?? {};
    mcpServers.tether = {
      command: 'tether',
      args: ['mcp', '--profile', profile],
    };
    config.mcpServers = mcpServers;

    const newContent = `${JSON.stringify(config, null, 2)}\n`;
    const { action, backupPath } = backupAndWrite(targetPath, newContent, opts.dryRun);

    return {
      harness: this.name,
      targetPath: resolved,
      action,
      backupPath,
      content: newContent,
    };
  }

  async removeConfig(opts: HarnessConfigOptions = {}): Promise<ConfigWriteResult> {
    const targetPath = opts.customPath ?? this.defaultPath;
    const resolved = resolveHome(targetPath);

    if (!fs.existsSync(resolved)) {
      return { harness: this.name, targetPath: resolved, action: 'unchanged', content: '' };
    }

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    } catch {
      return { harness: this.name, targetPath: resolved, action: 'unchanged', content: '' };
    }

    const mcpServers = (config.mcpServers as Record<string, unknown>) ?? {};
    if (mcpServers.tether) {
      delete mcpServers.tether;
      config.mcpServers = mcpServers;
      const newContent = `${JSON.stringify(config, null, 2)}\n`;
      const { action, backupPath } = backupAndWrite(targetPath, newContent, opts.dryRun);
      return { harness: this.name, targetPath: resolved, action, backupPath, content: newContent };
    }

    return { harness: this.name, targetPath: resolved, action: 'unchanged', content: '' };
  }
}
