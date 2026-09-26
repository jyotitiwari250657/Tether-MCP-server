import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callSiteTool,
  listSiteTools,
  namespaceTool,
  parseNamespacedTool,
  toOriginSlug,
} from '../../lib/webmcp/proxy.js';

// PRD FR-621, SEC-10, TRD §6.15: WebMCP Mode C Proxy & Namespacing
describe('WebMCP Mode C Proxy & Origin Namespacing', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('slugifies URLs and domains safely', () => {
    expect(toOriginSlug('https://github.com/org/repo')).toBe('github_com');
    expect(toOriginSlug('https://sub.domain.co.uk:8080/path')).toBe('sub_domain_co_uk');
    expect(toOriginSlug('localhost:3000')).toBe('localhost');
  });

  it('namespaces tools with origin slug prefix to prevent collision/spoofing (SEC-10)', () => {
    const origin = 'https://linear.app';
    const tool = {
      name: 'create_issue',
      description: 'Create a new Linear issue',
      inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
    };

    const namespaced = namespaceTool(origin, tool);
    expect(namespaced.namespacedName).toBe('site_linear_app__create_issue');
    expect(namespaced.originalName).toBe('create_issue');
    expect(namespaced.origin).toBe(origin);
  });

  it('parses namespaced tool names into slug and toolName', () => {
    const parsed = parseNamespacedTool('site_notion_so__query_database');
    expect(parsed).not.toBeNull();
    expect(parsed?.originSlug).toBe('notion_so');
    expect(parsed?.toolName).toBe('query_database');

    expect(parseNamespacedTool('invalid_format_tool')).toBeNull();
    expect(parseNamespacedTool('site_missing_separator')).toBeNull();
  });

  it('lists site tools by querying the content script bridge', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({
      tools: [
        { name: 'search', description: 'Search the site' },
        { name: 'filter', description: 'Filter products' },
      ],
    });

    (chrome.tabs.sendMessage as unknown) = mockSendMessage;

    const tools = await listSiteTools(42, 'https://store.example.com');
    expect(tools).toHaveLength(2);
    expect(tools[0]?.namespacedName).toBe('site_store_example_com__search');
    expect(tools[1]?.namespacedName).toBe('site_store_example_com__filter');
  });

  it('calls site tool by delegating unwrapped name to content script', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({
      status: 'ok',
      ticketId: 'ISSUE-123',
    });

    (chrome.tabs.sendMessage as unknown) = mockSendMessage;

    const result = await callSiteTool(42, 'site_linear_app__create_issue', {
      title: 'Fix login bug',
    });

    expect(mockSendMessage).toHaveBeenCalledWith(42, {
      kind: 'webmcp',
      action: 'call_tool',
      toolName: 'create_issue',
      args: { title: 'Fix login bug' },
    });

    expect(result).toEqual({ status: 'ok', ticketId: 'ISSUE-123' });
  });

  it('rejects callSiteTool if name format is invalid', async () => {
    await expect(callSiteTool(42, 'unnamespaced_tool', {})).rejects.toThrow(
      /Invalid namespaced tool name/,
    );
  });
});
