/**
 * Codex Harness Writer (PRD FR-309, TRD §7.5).
 * Updates ~/.codex/config.toml to register Tether MCP.
 */

import * as fs from 'node:fs';
import type { ConfigWriteResult, HarnessConfigOptions, HarnessWriter } from './types.js';
import { backupAndWrite, resolveHome } from './utils.js';

export class CodexWriter implements HarnessWriter {
  readonly name = 'codex';
  readonly defaultPath = '~/.codex/config.toml';

  async writeConfig(opts: HarnessConfigOptions = {}): Promise<ConfigWriteResult> {
    const targetPath = opts.customPath ?? this.defaultPath;
    const resolved = resolveHome(targetPath);
    const profile = opts.profile ?? 'browser-act';

    let content = '';
    if (fs.existsSync(resolved)) {
      content = fs.readFileSync(resolved, 'utf-8');
    }

    const entry = `[mcp.tether]\ncommand = "tether"\nargs = ["mcp", "--profile", "${profile}"]\n`;

    // Replace existing [mcp.tether] section or append
    const mcpRegex = /\[mcp\.tether\][\s\S]*?(?=\n\[|\n*$)/;
    let newContent = '';
    if (mcpRegex.test(content)) {
      newContent = content.replace(mcpRegex, entry.trim());
    } else {
      newContent = content.length > 0 ? `${content.trim()}\n\n${entry}` : entry;
    }

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

    const content = fs.readFileSync(resolved, 'utf-8');
    const mcpRegex = /\n*\[mcp\.tether\][\s\S]*?(?=\n\[|\n*$)/;
    const newContent = content.replace(mcpRegex, '').trim() + (content.length > 0 ? '\n' : '');

    const { action, backupPath } = backupAndWrite(targetPath, newContent, opts.dryRun);
    return { harness: this.name, targetPath: resolved, action, backupPath, content: newContent };
  }
}
