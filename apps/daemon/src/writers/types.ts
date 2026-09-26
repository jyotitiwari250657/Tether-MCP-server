/**
 * Harness Config Writer Types (PRD FR-309, TRD §7.5).
 */

export interface HarnessConfigOptions {
  dryRun?: boolean | undefined;
  profile?: ('browser-readonly' | 'browser-act') | undefined;
  port?: number | undefined;
  token?: string | undefined;
  customPath?: string | undefined;
}

export interface ConfigWriteResult {
  harness: string;
  targetPath: string;
  action: 'created' | 'updated' | 'unchanged' | 'dry-run';
  backupPath?: string | undefined;
  warning?: string | undefined;
  content: string;
}

export interface HarnessWriter {
  readonly name: string;
  readonly defaultPath: string;
  writeConfig(opts?: HarnessConfigOptions): Promise<ConfigWriteResult>;
  removeConfig(opts?: HarnessConfigOptions): Promise<ConfigWriteResult>;
}
