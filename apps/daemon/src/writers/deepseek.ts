/**
 * DeepSeek Harness Writer (PRD FR-309, TRD §7.5).
 * Updates ~/.deepseek/config.json to register Tether MCP server.
 * Enforces browser-readonly profile and emits RFC #941 warning.
 */

import * as fs from 'node:fs';
import type { ConfigWriteResult, HarnessConfigOptions, HarnessWriter } from './types.js';
import { backupAndWrite, resolveHome } from './utils.js';

export const DEEPSEEK_RFC941_WARNING =
  'WARNING: DeepSeek RFC #941 vulnerability mitigation: DeepSeek harness is restricted to browser-readonly profile to prevent untrusted execution.';

export class DeepSeekWriter implements HarnessWriter {
  readonly name = 'deepseek';
  readonly defaultPath = '~/.deepseek/config.json';

  async writeConfig(opts: HarnessConfigOptions = {}): Promise<ConfigWriteResult> {
    const targetPath = opts.customPath ?? this.defaultPath;
    const resolved = resolveHome(targetPath);

    // PRD FR-309: DeepSeek is strictly restricted to browser-readonly regardless of requested profile
    const profile = 'browser-readonly';

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
      warning: DEEPSEEK_RFC941_WARNING,
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
