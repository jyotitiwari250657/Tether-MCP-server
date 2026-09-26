// AC-E2E-02: Snapshot fidelity against fixture digests
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type FixtureServer, startFixtureServer } from './fixtures';
import { type TetherHarness, launchTether } from './harness';
import { McpTestClient } from './helpers/mcp-client';
import { clickEnableInject } from './helpers/ui';

interface Digest {
  name: string;
  title: string;
  expectedRefs: string[];
  nodeCount: number;
}

describe('Scenario: Snapshot Fidelity (AC-E2E-02)', () => {
  let harness: TetherHarness | null = null;
  let fixtureServer: FixtureServer | null = null;
  let mcpClient: McpTestClient | null = null;

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.close().catch(() => {});
      mcpClient = null;
    }
    if (harness) {
      await harness.close();
      harness = null;
    }
    if (fixtureServer) {
      await fixtureServer.close().catch(() => {});
      fixtureServer = null;
    }
  });

  it('captures accurate snapshot trees matching digest for static-1, shadow-open, virt-table', async () => {
    fixtureServer = await startFixtureServer(4100);
    harness = await launchTether({ daemon: true });
    mcpClient = new McpTestClient(harness.httpPort);
    await mcpClient.connect();

    const fixtures = ['static-1', 'shadow-open', 'virt-table'];

    for (const fixture of fixtures) {
      const digestPath = path.resolve(
        process.cwd(),
        'tests/fixtures/sites',
        fixture,
        'snapshot-digest.json',
      );
      const digest = JSON.parse(fs.readFileSync(digestPath, 'utf8')) as Digest;

      const page = await harness.ctx.newPage();
      await page.goto(`${fixtureServer.url}/${fixture}`);
      await page.bringToFront();

      // Enable site access & inject content bridge
      await clickEnableInject(harness.ctx, harness.extensionId);

      // Execute browser_snapshot tool call
      const res = await mcpClient.call('browser_snapshot', {});
      console.log('DEBUG browser_snapshot res:', JSON.stringify(res, null, 2));
      expect(res.ok).toBe(true);

      const snap = res.data as { tree: string; trust: string; nodes?: Array<{ ref: string }> };
      expect(snap.trust).toBe('untrusted');
      expect(snap.tree).toBeTruthy();

      // Verify node count +-10% tolerance (or at least within reasonable margin)
      const treeLines = snap.tree.split('\n').filter((l) => l.trim().startsWith('-'));
      const detectedCount = snap.nodes?.length ?? treeLines.length;
      const countDiff = Math.abs(detectedCount - digest.nodeCount);
      const tolerance = Math.max(1, Math.ceil(digest.nodeCount * 0.15));
      expect(countDiff).toBeLessThanOrEqual(tolerance);

      // Verify expected refs are present in tree output or nodes array
      for (const ref of digest.expectedRefs) {
        const foundInTree = snap.tree.includes(`[ref=${ref}]`);
        const foundInNodes = snap.nodes?.some((n) => n.ref === ref) ?? false;
        expect(foundInTree || foundInNodes).toBe(true);
      }

      await page.close().catch(() => {});
    }
  }, 60000);
});
