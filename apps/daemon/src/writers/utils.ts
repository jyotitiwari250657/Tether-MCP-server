/**
 * Harness Config Writer Common Utilities (TRD §7.5).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export function resolveHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, filepath.slice(2));
  }
  return path.resolve(filepath);
}

export function backupAndWrite(
  targetPath: string,
  newContent: string,
  dryRun = false,
): { action: 'created' | 'updated' | 'unchanged' | 'dry-run'; backupPath?: string | undefined } {
  const resolved = resolveHome(targetPath);

  if (dryRun) {
    return { action: 'dry-run' };
  }

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(resolved)) {
    const existing = fs.readFileSync(resolved, 'utf-8');
    if (existing.trim() === newContent.trim()) {
      return { action: 'unchanged' };
    }
    const backupPath = `${resolved}.bak.${Date.now()}`;
    fs.writeFileSync(backupPath, existing, 'utf-8');
    fs.writeFileSync(resolved, newContent, 'utf-8');
    return { action: 'updated', backupPath };
  }

  fs.writeFileSync(resolved, newContent, 'utf-8');
  return { action: 'created' };
}
