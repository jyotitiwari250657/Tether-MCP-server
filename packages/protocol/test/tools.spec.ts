import { describe, expect, test } from 'vitest';
import * as protocolIndex from '../src/index.js';
import {
  FORBIDDEN_TOOLS,
  PROFILES,
  TOOLS,
  TOOL_NAME_RE,
  isToolAllowed,
  listToolsForProfile,
  tokenBudgetForProfile,
} from '../src/tools/index.js';

describe('Tool Registry, Anti-Spoofing & Token Budgets (TRD §5.4, §11, PRD SEC-03, HR-5, FR-612)', () => {
  test('TRD §5.4 / PRD SEC-03: FORBIDDEN_TOOLS are not present in TOOLS', () => {
    const toolNames = TOOLS.map((t) => t.name);
    for (const forbidden of FORBIDDEN_TOOLS) {
      expect(toolNames).not.toContain(forbidden);
    }
  });

  test('TRD §5.4 / PRD HR-5: every tool name matches TOOL_NAME_RE', () => {
    expect(TOOLS.length).toBeGreaterThan(0);
    for (const tool of TOOLS) {
      expect(tool.name).toMatch(TOOL_NAME_RE);
    }
  });

  test('TRD §5.4 / PRD FR-611: TOOLS.length === 40', () => {
    expect(TOOLS.length).toBe(40);
  });

  test('TRD §5.4 / PRD HR-8: every T2 tool has requires.confirm === true', () => {
    const t2Tools = TOOLS.filter((t) => t.tier === 2);
    expect(t2Tools.length).toBeGreaterThan(0);
    for (const tool of t2Tools) {
      expect(tool.requires.confirm).toBe(true);
    }
  });

  test('TRD §5.4: no tool description exceeds 150 characters', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeLessThanOrEqual(150);
      expect(tool.title.length).toBeLessThanOrEqual(40);
    }
  });

  test('TRD §5.4 / PRD HR-9: every tool has valid schemas, tiers, profiles, and budgetMs <= 30000', () => {
    for (const tool of TOOLS) {
      expect([0, 1, 2, 3]).toContain(tool.tier);
      expect(tool.budgetMs).toBeGreaterThan(0);
      expect(tool.budgetMs).toBeLessThanOrEqual(30_000);
      expect(tool.profiles.length).toBeGreaterThan(0);
      for (const profile of tool.profiles) {
        expect(['browser-readonly', 'browser-act']).toContain(profile);
      }
      expect(tool.input).toBeDefined();
      expect(tool.output).toBeDefined();
    }
  });

  test('TRD §11 NFR-110 / PRD FR-612: browser-readonly ≤ 2 500 tokens', () => {
    const tokens = tokenBudgetForProfile('browser-readonly');
    expect(tokens).toBeLessThanOrEqual(2_500);
  });

  test('TRD §11 NFR-110 / PRD FR-612: browser-act ≤ 4 500 tokens', () => {
    const tokens = tokenBudgetForProfile('browser-act');
    expect(tokens).toBeLessThanOrEqual(4_500);
  });

  test('TRD §5.4: isToolAllowed and listToolsForProfile helpers behave correctly', () => {
    expect(isToolAllowed('browser_snapshot', 'browser-readonly')).toBe(true);
    expect(isToolAllowed('browser_click', 'browser-readonly')).toBe(false);
    expect(isToolAllowed('browser_click', 'browser-act')).toBe(true);
    expect(isToolAllowed('non_existent_tool', 'browser-act')).toBe(false);

    const readonlyList = listToolsForProfile('browser-readonly');
    expect(readonlyList.length).toBe(22);

    const actList = listToolsForProfile('browser-act');
    expect(actList.length).toBe(40);

    expect(protocolIndex.calculateToolsTokenBudget([])).toBe(0);
  });

  test('TRD §4.3.3: Root barrel exports all expected tool arrays and specifications', () => {
    expect(protocolIndex.PROTOCOL_VERSION).toBe(1);
    expect(protocolIndex.READONLY_TOOLS.length).toBe(10);
    expect(protocolIndex.ACT_TOOLS.length).toBe(18);
    expect(protocolIndex.GOVERNANCE_TOOLS.length).toBe(10);
    expect(protocolIndex.WEBMCP_TOOLS.length).toBe(2);
    expect(protocolIndex.TOOLS.length).toBe(40);
  });
});
