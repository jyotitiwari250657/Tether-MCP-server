// AC-P09-04, AC-P09-13, AC-P12-02: Harness configuration, dynamic ports, and cleanup
import * as net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { startFixtureServer } from './fixtures';
import { getLaunchConfig, launchTether, randomFreePort } from './harness';

describe('E2E Harness Configuration', () => {
  it('AC-P09-13: asserts that launch options strictly enforce headless: false', () => {
    const config = getLaunchConfig();

    // HR-13, PRD §12.3: Extensions do not load in legacy headless Chrome
    expect(config.headless).toBe(false);
    expect(config.args).toContain('--disable-gpu');
    expect(config.args.some((arg) => arg.startsWith('--load-extension='))).toBe(true);
    expect(config.args.some((arg) => arg.startsWith('--disable-extensions-except='))).toBe(true);
    expect(config.userDataDir).toBeDefined();
  });

  it('AC-P09-04: configures userDataDir with unique temporary path', () => {
    const config1 = getLaunchConfig();
    const config2 = getLaunchConfig();

    expect(config1.userDataDir).not.toBe(config2.userDataDir);
  });

  it('AC-P12-02: randomFreePort returns bindable ports inside the requested range', async () => {
    for (let i = 0; i < 3; i++) {
      const port = await randomFreePort({ min: 18800, max: 18900 });
      expect(port).toBeGreaterThanOrEqual(18800);
      expect(port).toBeLessThanOrEqual(18900);
      // The port must actually be bindable right after selection.
      const free = await new Promise<boolean>((resolve) => {
        const srv = net.createServer();
        srv.once('error', () => resolve(false));
        srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
      });
      expect(free).toBe(true);
    }
  });
});

describe('Fixture Server', () => {
  it('starts and stops fixture server properly', async () => {
    const server = await startFixtureServer(3456);
    expect(server.url).toContain('127.0.0.1');
    expect(server.port).toBe(3456);

    const res = await fetch(`${server.url}/nonexistent.html`);
    expect(res.status).toBe(404);

    await server.close();
  });
});

describe('Harness Launch & Cleanup (AC-P12-02)', () => {
  const harnesses: Awaited<ReturnType<typeof launchTether>>[] = [];

  afterEach(async () => {
    while (harnesses.length > 0) {
      const h = harnesses.pop();
      if (h) await h.close().catch(() => {});
    }
  });

  it(
    'AC-P12-02: two parallel harnesses get distinct dynamic ports and both daemons become ready',
    { timeout: 90_000 },
    async () => {
      const [a, b] = await Promise.all([
        launchTether({ daemon: true }),
        launchTether({ daemon: true }),
      ]);
      harnesses.push(a, b);

      expect(a.wsPort).toBeGreaterThanOrEqual(18800);
      expect(a.wsPort).toBeLessThanOrEqual(18900);
      expect(b.wsPort).toBeGreaterThanOrEqual(18800);
      expect(b.wsPort).toBeLessThanOrEqual(18900);
      expect(a.wsPort).not.toBe(b.wsPort);
      expect(a.httpPort).not.toBe(b.httpPort);

      // Both daemons answer independently on their own ports.
      const [ha, hb] = await Promise.all([
        fetch(`http://127.0.0.1:${a.httpPort}/healthz`),
        fetch(`http://127.0.0.1:${b.httpPort}/healthz`),
      ]);
      expect(ha.ok).toBe(true);
      expect(hb.ok).toBe(true);
    },
  );

  it(
    'AC-P12-02: close() releases both daemon ports so they are immediately reusable',
    { timeout: 90_000 },
    async () => {
      const h = await launchTether({ daemon: true });
      harnesses.push(h);

      const health = await fetch(`http://127.0.0.1:${h.httpPort}/healthz`);
      expect(health.ok).toBe(true);

      await h.close();

      // Ports must be free again after cleanup (the flake mechanism this fix targets).
      for (const port of [h.wsPort, h.httpPort]) {
        const free = await new Promise<boolean>((resolve) => {
          const srv = net.createServer();
          srv.once('error', () => resolve(false));
          srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
        });
        expect(free).toBe(true);
      }
    },
  );
});
