/**
 * Daemon Update Installer (TRD §7).
 * Atomically replaces daemon binary with automatic rollback on failure.
 */

import * as fs from 'node:fs';

export async function applyUpdate(
  targetBinaryPath: string,
  newBinaryBuffer: Buffer,
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  const backupPath = `${targetBinaryPath}.old.${Date.now()}`;

  try {
    // 1. Create backup of current binary
    if (fs.existsSync(targetBinaryPath)) {
      fs.copyFileSync(targetBinaryPath, backupPath);
    }

    // 2. Write new binary to a temporary sibling file
    const tempPath = `${targetBinaryPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, newBinaryBuffer);

    // 3. Ensure executable permissions on POSIX
    if (process.platform !== 'win32') {
      fs.chmodSync(tempPath, 0o755);
    }

    // 4. Atomic rename into place
    try {
      fs.renameSync(tempPath, targetBinaryPath);
    } catch {
      // Fallback for Windows where file might be busy: copy/replace
      fs.copyFileSync(tempPath, targetBinaryPath);
      fs.unlinkSync(tempPath);
    }

    return { success: true, backupPath };
  } catch (err) {
    // Rollback if backup exists
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, targetBinaryPath);
      } catch {
        // Rollback attempt failed
      }
    }
    return {
      success: false,
      backupPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
