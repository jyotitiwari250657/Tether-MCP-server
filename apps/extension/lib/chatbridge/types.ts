// PRD FR-620, TRD §6.16: Experimental Chat-UI Bridge Types
export type ChatHost = 'chatgpt' | 'claude' | 'gemini' | 'generic';

export type BridgeState = 'idle' | 'executing' | 'disabled';

export interface ParsedToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  rawBlock: string;
}

export interface ChatBridgeConfig {
  enabled: boolean; // MUST be false by default (PRD FR-620)
  host: ChatHost;
  autoExecute: boolean;
}
