/**
 * Harness Auto-Detection (PRD FR-309, TRD §7.5).
 * Detects presence of known AI harness configs on user machine.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HarnessName } from '../writers/index.js';

export interface DetectedHarness {
  name: HarnessName;
  detectedPath: string;
  exists: boolean;
}

export function detectInstalledHarnesses(): DetectedHarness[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const harnesses: Array<{ name: HarnessName; dir: string }> = [
    { name: 'codex', dir: path.join(home, '.codex') },
    { name: 'claude-code', dir: path.join(home, '.claude') },
    { name: 'cursor', dir: path.join(home, '.cursor') },
    { name: 'vscode', dir: path.join(process.cwd(), '.vscode') },
    { name: 'copilot-cli', dir: path.join(home, '.config', 'github-copilot') },
    { name: 'gemini-cli', dir: path.join(home, '.gemini') },
    { name: 'deepseek', dir: path.join(home, '.deepseek') },
  ];

  return harnesses.map(({ name, dir }) => ({
    name,
    detectedPath: dir,
    exists: fs.existsSync(dir),
  }));
}
