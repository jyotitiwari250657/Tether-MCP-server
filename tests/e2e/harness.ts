import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { type BrowserContext, type Worker, chromium } from 'playwright';

async function waitPortFree(port: number, timeoutMs = 4000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const free = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.listen(port, '127.0.0.1', () => {
        srv.close(() => resolve(true));
      });
    });
    if (free) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** True when something is LISTENING on the port (daemon readiness probe). */
async function waitPortListening(port: number, timeoutMs = 4000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (open) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

/**
 * Picks a random free port in a range (Prompt 12 §1b, AC-P12-02). Two parallel
 * harnesses therefore never contend for 18795/18796 and lingering daemons from
 * a crashed spec cannot starve the suite. `exclude` prevents the ws/http draws
 * of a single harness from colliding (nothing binds between the two checks).
 */
export async function randomFreePort(
  range = { min: 18800, max: 18900 },
  exclude: number[] = [],
): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const port = range.min + Math.floor(Math.random() * (range.max - range.min));
    if (exclude.includes(port)) continue;
    const free = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.listen(port, '127.0.0.1', () => {
        srv.close(() => resolve(true));
      });
    });
    if (free) return port;
  }
  throw new Error(`No free port found in [${range.min}, ${range.max}] excluding [${exclude}]`);
}

/** Kills a process and (best-effort) its whole child tree, cross-platform. */
function killProcessTree(pid: number): void {
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(pid), '/f', '/t', '/e'], { stdio: 'ignore' });
    } catch {}
    return;
  }
  try {
    spawnSync('pkill', ['-P', String(pid)], { stdio: 'ignore' });
  } catch {}
  try {
    process.kill(pid, 'SIGTERM');
  } catch {}
}

export interface LaunchTetherOptions {
  manifest?: 'lean' | 'full';
  daemon?: boolean;
  /** Legacy fixed ws port. If omitted, a random free port is allocated. */
  port?: number;
  /** Random ws port range (default 18800..18900). Ignored when `port` is set. */
  portRange?: { min: number; max: number };
}

export interface TetherHarness {
  ctx: BrowserContext;
  sw: Worker | null;
  daemon: ChildProcess | null;
  userDataDir: string;
  extensionId: string;
  /** WS port the daemon actually bound. */
  wsPort: number;
  /** HTTP (MCP/health) port the daemon actually bound. */
  httpPort: number;
  close: () => Promise<void>;
}

export interface LaunchConfig {
  userDataDir: string;
  extensionPath: string;
  args: string[];
  headless: boolean;
}

export function getLaunchConfig(opts: LaunchTetherOptions = {}): LaunchConfig {
  const root = path.resolve(process.cwd());
  const extPath = path.resolve(root, 'apps/extension/.output/chrome-mv3');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-e2e-'));

  // HR-13, TRD §12: Extensions do not load in legacy headless mode; headless: false is mandatory
  return {
    userDataDir: tempDir,
    extensionPath: extPath,
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
  };
}

export async function launchTether(opts: LaunchTetherOptions = {}): Promise<TetherHarness> {
  const config = getLaunchConfig(opts);
  let daemonProcess: ChildProcess | null = null;

  // Prompt 12 §1b: dynamic ports by default; explicit opts.port keeps legacy fixed ports.
  const wsPort = opts.port ?? (await randomFreePort(opts.portRange));
  const httpPort = opts.port
    ? opts.port + 1
    : await randomFreePort(opts.portRange ?? undefined, [wsPort]);

  if (opts.daemon) {
    await waitPortFree(wsPort, 3000);
    await waitPortFree(httpPort, 3000);

    const daemonScript = path.resolve(process.cwd(), 'apps/daemon/dist/index.js');
    // Daemon gets an isolated temp HOME so e2e runs never touch real user state.
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-daemon-'));
    daemonProcess = spawn(
      'node',
      [
        daemonScript,
        'serve',
        '--no-tray',
        '--port-ws',
        String(wsPort),
        '--port-http',
        String(httpPort),
      ],
      {
        env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
        // Pipe so the daemon cannot tie this process's stdio; we drain below.
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    daemonProcess.stdout?.on('data', () => {});
    daemonProcess.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    daemonProcess.on('error', () => {});

    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const wsUp = await waitPortListening(wsPort, 300);
      const httpUp = await waitPortListening(httpPort, 300);
      if (wsUp && httpUp) break;
    }
  }

  const ctx = await chromium.launchPersistentContext(config.userDataDir, {
    headless: config.headless,
    args: config.args,
  });

  // Wait for service worker to initialize
  let sw: Worker | null = null;
  const existingWorkers = ctx.serviceWorkers();
  if (existingWorkers.length > 0) {
    sw = existingWorkers[0] ?? null;
  } else {
    try {
      sw = await ctx.waitForEvent('serviceworker', { timeout: 10_000 });
    } catch {
      sw = null;
    }
  }

  let extensionId = '';
  if (sw) {
    const url = sw.url();
    const match = url.match(/chrome-extension:\/\/([^/]+)/);
    if (match?.[1]) {
      extensionId = match[1];
    }
  }

  if (opts.daemon && sw) {
    // Prompt 12 §1b: publish the dynamic daemon port for the extension
    // (transport/storage.ts checks `e2e:daemonPort` before falling back to 18795).
    try {
      await sw.evaluate((port) => {
        const g = globalThis as {
          chrome?: {
            storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } };
          };
        };
        void g.chrome?.storage.local.set({ 'e2e:daemonPort': port });
      }, wsPort);
    } catch {}
  }

  if (opts.daemon) {
    const tConn = Date.now();
    while (Date.now() - tConn < 10000) {
      try {
        const res = await fetch(`http://127.0.0.1:${httpPort}/readyz`);
        if (res.ok) {
          const data = (await res.json()) as { extensionConnected?: boolean };
          if (data.extensionConnected) break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const close = async () => {
    try {
      await ctx.close();
    } catch {
      // ignore
    }
    if (daemonProcess?.pid) {
      killProcessTree(daemonProcess.pid);
      try {
        daemonProcess.kill('SIGKILL');
      } catch {}
    }
    if (opts.daemon) {
      await waitPortFree(wsPort, 3000);
      await waitPortFree(httpPort, 3000);
    }
    try {
      fs.rmSync(config.userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };

  return {
    ctx,
    sw,
    daemon: daemonProcess,
    userDataDir: config.userDataDir,
    extensionId,
    wsPort,
    httpPort,
    close,
  };
}

export async function openSidePanel(ctx: BrowserContext, extId?: string): Promise<void> {
  const targetId = extId || 'default';
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${targetId}/sidepanel.html`);
}

export async function injectContentScript(
  ctx: BrowserContext,
  tabId: number,
  scriptFiles: string[] = ['content.js'],
): Promise<void> {
  const pages = ctx.pages();
  const targetPage = pages[tabId] ?? pages[0];
  if (!targetPage) {
    throw new Error(`Tab ${tabId} not found`);
  }
  for (const file of scriptFiles) {
    await targetPage.addScriptTag({ path: file });
  }
}
