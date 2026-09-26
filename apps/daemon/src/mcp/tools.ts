/**
 * Daemon MCP Tool Definitions (PRD FR-301, TRD §7.3).
 * Adapts protocol TOOLS to MCP Server tool format.
 */

import { TOOLS, type ToolProfile, type ToolSpec, listToolsForProfile } from '@tether/protocol';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function cleanJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'object' };
  }

  const copy = { ...(schema as Record<string, unknown>) };
  delete copy.$schema;
  if (!copy.type) {
    copy.type = 'object';
  }
  return copy;
}

export function specToMcpTool(spec: ToolSpec<unknown, unknown>): McpToolDefinition {
  const jsonSchema = zodToJsonSchema(spec.input, { target: 'openApi3' });
  const cleaned = cleanJsonSchema(jsonSchema);

  return {
    name: spec.name,
    description: `${spec.title}: ${spec.description}`,
    inputSchema: cleaned,
  };
}

export function getMcpTools(profile?: ToolProfile): McpToolDefinition[] {
  const specs = profile ? listToolsForProfile(profile) : TOOLS;
  return specs.map(specToMcpTool);
}
