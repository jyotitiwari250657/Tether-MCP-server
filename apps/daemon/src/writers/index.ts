/**
 * Harness Config Writers Registry (PRD FR-309, TRD §7.5).
 */

import { ClaudeCodeWriter } from './claude-code.js';
import { CodexWriter } from './codex.js';
import { CopilotCliWriter } from './copilot-cli.js';
import { CursorWriter } from './cursor.js';
import { DEEPSEEK_RFC941_WARNING, DeepSeekWriter } from './deepseek.js';
import { GeminiCliWriter } from './gemini-cli.js';
import { GenericJsonWriter } from './generic.js';
import type { HarnessWriter } from './types.js';
import { VsCodeWriter } from './vscode.js';

export {
  ClaudeCodeWriter,
  CodexWriter,
  CopilotCliWriter,
  CursorWriter,
  DeepSeekWriter,
  DEEPSEEK_RFC941_WARNING,
  GeminiCliWriter,
  GenericJsonWriter,
  VsCodeWriter,
};

export type {
  ConfigWriteResult,
  HarnessConfigOptions,
  HarnessWriter,
} from './types.js';

export const HARNESS_NAMES = [
  'codex',
  'claude-code',
  'cursor',
  'vscode',
  'copilot-cli',
  'gemini-cli',
  'deepseek',
] as const;

export type HarnessName = (typeof HARNESS_NAMES)[number];

export function getHarnessWriter(name: string): HarnessWriter | null {
  switch (name.toLowerCase()) {
    case 'codex':
      return new CodexWriter();
    case 'claude-code':
    case 'claude':
      return new ClaudeCodeWriter();
    case 'cursor':
      return new CursorWriter();
    case 'vscode':
    case 'code':
      return new VsCodeWriter();
    case 'copilot-cli':
    case 'copilot':
      return new CopilotCliWriter();
    case 'gemini-cli':
    case 'gemini':
      return new GeminiCliWriter();
    case 'deepseek':
      return new DeepSeekWriter();
    default:
      return null;
  }
}
