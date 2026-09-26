// PRD FR-621, TRD §6.15: WebMCP module exports
export {
  type WebMcpToolDecl,
  type WebMcpBridgeMessage,
  initWebMcpBridge,
} from './bridge.js';

export {
  type NamespacedTool,
  toOriginSlug,
  namespaceTool,
  parseNamespacedTool,
  listSiteTools,
  callSiteTool,
} from './proxy.js';
