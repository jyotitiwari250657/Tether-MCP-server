// PRD FR-620, TRD §6.16: Chat-UI Bridge module exports (Off by default)
export type {
  ChatHost,
  BridgeState,
  ParsedToolCall,
  ChatBridgeConfig,
} from './types.js';

export { parseToolCallBlocks } from './parser.js';

export {
  formatToolResultMarkdown,
  injectIntoComposer,
} from './injector.js';
