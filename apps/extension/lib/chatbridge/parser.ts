// PRD FR-620, TRD §6.16: Chat-UI Bridge Fenced Block Parser
import type { ParsedToolCall } from './types.js';

const TETHER_TOOL_BLOCK_REGEX = /```tether-tool\s*([\s\S]*?)\s*```/g;

export function parseToolCallBlocks(markdownText: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  if (!markdownText) return calls;

  const matches = markdownText.matchAll(TETHER_TOOL_BLOCK_REGEX);

  let idx = 0;
  for (const match of matches) {
    const rawBlock = match[0];
    const jsonContent = match[1]?.trim() || '';

    try {
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const tool = typeof parsed.tool === 'string' ? parsed.tool : '';
      const args =
        typeof parsed.args === 'object' && parsed.args !== null
          ? (parsed.args as Record<string, unknown>)
          : {};

      if (tool) {
        calls.push({
          id: `call_${Date.now()}_${idx++}`,
          tool,
          args,
          rawBlock,
        });
      }
    } catch {
      // Ignore malformed JSON blocks
    }
  }

  return calls;
}
