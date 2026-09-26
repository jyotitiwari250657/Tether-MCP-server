/**
 * Skills & Plugins Installer (PRD FR-310, TRD §7.6).
 * Validates OpenAI constraints (≤5 skills, ≤256 KiB) and installs plugin manifests.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MAX_SKILLS_COUNT,
  MAX_SKILL_SIZE_BYTES,
  type SkillDefinition,
  generateClaudePluginManifest,
  generateCodexPluginManifest,
  generateCursorPluginManifest,
  generateGeminiExtensionManifest,
} from './manifests.js';

export class SkillInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillInstallError';
  }
}

export function validateSkills(skills: SkillDefinition[]): void {
  if (skills.length > MAX_SKILLS_COUNT) {
    throw new SkillInstallError(
      `Cannot install ${skills.length} skills. Maximum allowed is ${MAX_SKILLS_COUNT} (PRD FR-310).`,
    );
  }

  for (const skill of skills) {
    if (!skill.name || typeof skill.name !== 'string') {
      throw new SkillInstallError('Skill must have a valid non-empty name.');
    }
    const byteLength = Buffer.byteLength(skill.instructions, 'utf-8');
    if (byteLength > MAX_SKILL_SIZE_BYTES) {
      throw new SkillInstallError(
        `Skill "${skill.name}" exceeds maximum size of 256 KiB (${byteLength} bytes).`,
      );
    }
  }
}

export async function installPluginManifests(
  skills: SkillDefinition[],
  targetDir: string,
): Promise<{ installed: string[] }> {
  validateSkills(skills);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const installed: string[] = [];

  // Claude plugin
  const claudePath = path.join(targetDir, '.claude-plugin');
  fs.writeFileSync(
    claudePath,
    JSON.stringify(generateClaudePluginManifest(skills), null, 2),
    'utf-8',
  );
  installed.push(claudePath);

  // Codex plugin
  const codexPath = path.join(targetDir, '.codex-plugin');
  fs.writeFileSync(
    codexPath,
    JSON.stringify(generateCodexPluginManifest(skills), null, 2),
    'utf-8',
  );
  installed.push(codexPath);

  // Cursor plugin
  const cursorPath = path.join(targetDir, '.cursor-plugin');
  fs.writeFileSync(
    cursorPath,
    JSON.stringify(generateCursorPluginManifest(skills), null, 2),
    'utf-8',
  );
  installed.push(cursorPath);

  // Gemini extension
  const geminiPath = path.join(targetDir, 'gemini-extension.json');
  fs.writeFileSync(
    geminiPath,
    JSON.stringify(generateGeminiExtensionManifest(skills), null, 2),
    'utf-8',
  );
  installed.push(geminiPath);

  return { installed };
}
