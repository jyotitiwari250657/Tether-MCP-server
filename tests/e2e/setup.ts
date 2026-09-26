// TRD §12: Global E2E setup and teardown for test runs
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { type FixtureServer, startFixtureServer } from './fixtures';

let fixtureServer: FixtureServer | null = null;

export async function setupE2E(): Promise<{ serverUrl: string }> {
  const root = path.resolve(process.cwd());
  const extDist = path.resolve(root, 'apps/extension/.output/chrome-mv3');

  if (!fs.existsSync(extDist)) {
    execSync('pnpm --filter @tether/extension build', {
      cwd: root,
      stdio: 'inherit',
    });
  }

  fixtureServer = await startFixtureServer(3000);
  return { serverUrl: fixtureServer.url };
}

export async function teardownE2E(): Promise<void> {
  if (fixtureServer) {
    await fixtureServer.close();
    fixtureServer = null;
  }
}
