import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ClaudeCodeWriter,
  CodexWriter,
  CopilotCliWriter,
  CursorWriter,
  DEEPSEEK_RFC941_WARNING,
  DeepSeekWriter,
  GeminiCliWriter,
  VsCodeWriter,
  getHarnessWriter,
} from '../../src/writers/index.js';

describe('Harness Config Writers (PRD FR-309, TRD §7.5)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-writers-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Codex: creates and updates config.toml with [mcp.tether]', async () => {
    const writer = new CodexWriter();
    const targetPath = path.join(tempDir, 'config.toml');

    const res1 = await writer.writeConfig({ customPath: targetPath, profile: 'browser-act' });
    expect(res1.action).toBe('created');
    expect(res1.content).toContain('[mcp.tether]');
    expect(res1.content).toContain('browser-act');

    // Update with backup
    const res2 = await writer.writeConfig({ customPath: targetPath, profile: 'browser-readonly' });
    expect(res2.action).toBe('updated');
    expect(res2.backupPath).toBeDefined();
    expect(fs.existsSync(res2.backupPath!)).toBe(true);

    // Remove
    const res3 = await writer.removeConfig({ customPath: targetPath });
    expect(res3.action).toBe('updated');
    expect(res3.content).not.toContain('[mcp.tether]');
  });

  it('Claude Code: updates config.json with mcpServers.tether', async () => {
    const writer = new ClaudeCodeWriter();
    const targetPath = path.join(tempDir, 'claude.json');

    const res1 = await writer.writeConfig({ customPath: targetPath });
    expect(res1.action).toBe('created');
    const parsed = JSON.parse(res1.content);
    expect(parsed.mcpServers?.tether?.command).toBe('tether');

    // Remove
    const res2 = await writer.removeConfig({ customPath: targetPath });
    expect(res2.action).toBe('updated');
    const parsed2 = JSON.parse(res2.content);
    expect(parsed2.mcpServers?.tether).toBeUndefined();
  });

  it('Cursor: updates mcp.json', async () => {
    const writer = new CursorWriter();
    const targetPath = path.join(tempDir, 'cursor.json');

    const res = await writer.writeConfig({ customPath: targetPath });
    expect(res.action).toBe('created');
    const parsed = JSON.parse(res.content);
    expect(parsed.mcpServers?.tether).toBeDefined();
  });

  it('VS Code: updates .vscode/mcp.json', async () => {
    const writer = new VsCodeWriter();
    const targetPath = path.join(tempDir, 'vscode.json');

    const res = await writer.writeConfig({ customPath: targetPath });
    expect(res.action).toBe('created');
    const parsed = JSON.parse(res.content);
    expect(parsed.mcpServers?.tether).toBeDefined();
  });

  it('Copilot CLI: updates mcp.json', async () => {
    const writer = new CopilotCliWriter();
    const targetPath = path.join(tempDir, 'copilot.json');

    const res = await writer.writeConfig({ customPath: targetPath });
    expect(res.action).toBe('created');
    const parsed = JSON.parse(res.content);
    expect(parsed.mcpServers?.tether).toBeDefined();
  });

  it('Gemini CLI: updates settings.json', async () => {
    const writer = new GeminiCliWriter();
    const targetPath = path.join(tempDir, 'gemini.json');

    const res = await writer.writeConfig({ customPath: targetPath });
    expect(res.action).toBe('created');
    const parsed = JSON.parse(res.content);
    expect(parsed.mcpServers?.tether).toBeDefined();
  });

  it('DeepSeek: strictly locks profile to browser-readonly and emits RFC #941 warning', async () => {
    const writer = new DeepSeekWriter();
    const targetPath = path.join(tempDir, 'deepseek.json');

    // Attempt to request browser-act
    const res = await writer.writeConfig({ customPath: targetPath, profile: 'browser-act' });
    expect(res.action).toBe('created');
    expect(res.warning).toBe(DEEPSEEK_RFC941_WARNING);

    const parsed = JSON.parse(res.content);
    expect(parsed.mcpServers.tether.args).toContain('browser-readonly');
    expect(parsed.mcpServers.tether.args).not.toContain('browser-act');
  });

  it('supports dry-run without writing files', async () => {
    const writer = new CursorWriter();
    const targetPath = path.join(tempDir, 'dryrun.json');

    const res = await writer.writeConfig({ customPath: targetPath, dryRun: true });
    expect(res.action).toBe('dry-run');
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it('resolves harness writers via getHarnessWriter', () => {
    expect(getHarnessWriter('codex')).toBeInstanceOf(CodexWriter);
    expect(getHarnessWriter('claude-code')).toBeInstanceOf(ClaudeCodeWriter);
    expect(getHarnessWriter('cursor')).toBeInstanceOf(CursorWriter);
    expect(getHarnessWriter('vscode')).toBeInstanceOf(VsCodeWriter);
    expect(getHarnessWriter('copilot-cli')).toBeInstanceOf(CopilotCliWriter);
    expect(getHarnessWriter('gemini-cli')).toBeInstanceOf(GeminiCliWriter);
    expect(getHarnessWriter('deepseek')).toBeInstanceOf(DeepSeekWriter);
    expect(getHarnessWriter('unknown')).toBeNull();
  });

  it('tests removeConfig across cursor, vscode, copilot, gemini, deepseek, and generic', async () => {
    const writers = [
      new CursorWriter(),
      new VsCodeWriter(),
      new CopilotCliWriter(),
      new GeminiCliWriter(),
      new DeepSeekWriter(),
    ];

    for (const w of writers) {
      const p = path.join(tempDir, `${w.name}-remove.json`);
      await w.writeConfig({ customPath: p });
      const rem = await w.removeConfig({ customPath: p });
      expect(rem.action).toBe('updated');
      const rem2 = await w.removeConfig({ customPath: p });
      expect(rem2.action).toBe('unchanged');
    }
  });
});
