import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type SkillDefinition,
  SkillInstallError,
  installPluginManifests,
  validateSkills,
} from '../../src/skills/index.js';

describe('Skills & Plugin Installer (PRD FR-310, TRD §7.6)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-skills-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('allows up to 5 skills', () => {
    const skills: SkillDefinition[] = [
      { name: 's1', description: 'desc 1', instructions: 'inst 1' },
      { name: 's2', description: 'desc 2', instructions: 'inst 2' },
      { name: 's3', description: 'desc 3', instructions: 'inst 3' },
      { name: 's4', description: 'desc 4', instructions: 'inst 4' },
      { name: 's5', description: 'desc 5', instructions: 'inst 5' },
    ];
    expect(() => validateSkills(skills)).not.toThrow();
  });

  it('rejects more than 5 skills (PRD FR-310)', () => {
    const skills: SkillDefinition[] = [
      { name: 's1', description: 'desc', instructions: 'inst' },
      { name: 's2', description: 'desc', instructions: 'inst' },
      { name: 's3', description: 'desc', instructions: 'inst' },
      { name: 's4', description: 'desc', instructions: 'inst' },
      { name: 's5', description: 'desc', instructions: 'inst' },
      { name: 's6', description: 'desc', instructions: 'inst' },
    ];
    expect(() => validateSkills(skills)).toThrow(SkillInstallError);
    expect(() => validateSkills(skills)).toThrow(/Maximum allowed is 5/);
  });

  it('rejects skills larger than 256 KiB', () => {
    const largeInstructions = 'x'.repeat(256 * 1024 + 10);
    const skills: SkillDefinition[] = [
      { name: 'large-skill', description: 'too big', instructions: largeInstructions },
    ];
    expect(() => validateSkills(skills)).toThrow(SkillInstallError);
    expect(() => validateSkills(skills)).toThrow(/exceeds maximum size of 256 KiB/);
  });

  it('installs Claude, Codex, Cursor, and Gemini manifests', async () => {
    const skills: SkillDefinition[] = [
      { name: 'web-nav', description: 'Web navigation', instructions: 'Use browser_navigate' },
    ];

    const res = await installPluginManifests(skills, tempDir);
    expect(res.installed).toHaveLength(4);

    expect(fs.existsSync(path.join(tempDir, '.claude-plugin'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.codex-plugin'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.cursor-plugin'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'gemini-extension.json'))).toBe(true);
  });
});
