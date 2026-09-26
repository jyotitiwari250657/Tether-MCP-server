#!/usr/bin/env node
/**
 * Tether Daemon CLI (PRD FR-301..310, TRD §7).
 * Commands: serve | mcp | connect | nmh | doctor | update
 */

import { Command } from 'commander';
import { loadConfig } from './config.js';
import { configureAllDetectedHarnesses, detectInstalledHarnesses } from './install/index.js';
import { TetherMcpServer, runMcpStdio } from './mcp/index.js';
import { readNativeMessage, writeNativeMessage } from './nmh/index.js';
import { OcrService } from './ocr/index.js';
import { ToolDispatcher } from './router/index.js';
import { loadOrCreateToken } from './server/auth.js';
import { DaemonHttpServer } from './server/http.js';
import { DaemonWsServer } from './server/ws.js';
import { DaemonTray } from './tray/index.js';
import { checkForUpdate } from './update/index.js';
import { VaultService } from './vault/index.js';
import { getHarnessWriter } from './writers/index.js';

const program = new Command();
program.name('tether').description('Tether Local Native Daemon').version('0.1.0');

program
  .command('serve')
  .description('Start the local loopback WebSocket and HTTP servers')
  .option('--port-ws <port>', 'WebSocket port', '18795')
  .option('--port-http <port>', 'HTTP port', '18796')
  .option('--no-tray', 'Disable system tray icon')
  .action(async (opts) => {
    const config = loadConfig();
    const token = loadOrCreateToken();
    const vaultService = new VaultService();
    const ocrService = new OcrService();

    let wsServer: DaemonWsServer;
    let dispatcher: ToolDispatcher;

    wsServer = new DaemonWsServer({
      port: Number(opts.portWs),
      token,
      config,
      pinnedExtensionId: config.extensionId || undefined,
      onRequest: (req) => dispatcher.handleExtensionRequest(req),
      ocrService,
    });

    dispatcher = new ToolDispatcher({
      wsServer,
      vaultService,
    });

    const httpServer = new DaemonHttpServer({
      port: Number(opts.portHttp),
      token,
      config,
      dispatcher,
    });

    await wsServer.start();
    await httpServer.start();

    console.log('Tether Daemon running.');
    console.log(`- WebSocket: ws://127.0.0.1:${opts.portWs}`);
    console.log(`- HTTP:      http://127.0.0.1:${opts.portHttp}`);
    console.log('- Token:     ~/.tether/token');

    if (opts.tray) {
      const tray = new DaemonTray({
        onQuit: () => {
          wsServer.close();
          httpServer.close();
          process.exit(0);
        },
      });
      await tray.start();
    }
  });

program
  .command('mcp')
  .description('Run stdio MCP server for agent harnesses')
  .option('--profile <profile>', 'Tool profile (browser-act | browser-readonly)', 'browser-act')
  .action(async (opts) => {
    const token = loadOrCreateToken();
    const vaultService = new VaultService();
    const ocrService = new OcrService();
    let wsServer: DaemonWsServer;
    let dispatcher: ToolDispatcher;

    wsServer = new DaemonWsServer({
      port: 18795,
      token,
      onRequest: (req) => dispatcher.handleExtensionRequest(req),
      ocrService,
    });

    dispatcher = new ToolDispatcher({
      wsServer,
      vaultService,
    });

    const mcpServer = new TetherMcpServer({
      dispatcher,
      profile: opts.profile as 'browser-act' | 'browser-readonly',
    });

    await runMcpStdio(mcpServer);
  });

program
  .command('connect [harness]')
  .description('Configure AI agent harness to use Tether MCP')
  .option('--dry-run', 'Show planned configuration without modifying disk')
  .option('--profile <profile>', 'Tool profile to configure', 'browser-act')
  .action(async (harness, opts) => {
    if (harness) {
      const writer = getHarnessWriter(harness);
      if (!writer) {
        console.error(`Unknown harness: ${harness}`);
        process.exit(1);
      }
      const res = await writer.writeConfig({
        dryRun: opts.dryRun,
        profile: opts.profile,
      });
      if (res.warning) {
        console.warn(res.warning);
      }
      console.log(`Configured ${harness} (${res.action}): ${res.targetPath}`);
      return;
    }

    const { configured, skipped } = await configureAllDetectedHarnesses({
      dryRun: opts.dryRun,
      profile: opts.profile,
    });

    for (const c of configured) {
      if (c.warning) console.warn(c.warning);
      console.log(`Configured ${c.harness} (${c.action}): ${c.targetPath}`);
    }
    for (const s of skipped) {
      console.log(`Skipped ${s.name} (not detected at ${s.detectedPath})`);
    }
  });

program
  .command('nmh')
  .description('Run in Chrome Native Messaging Host mode')
  .action(async () => {
    while (true) {
      try {
        const msg = await readNativeMessage();
        if (!msg) break;
        writeNativeMessage({ ok: true, echo: msg });
      } catch {
        break;
      }
    }
  });

program
  .command('doctor')
  .description('Check daemon health, token, and system integration')
  .action(async () => {
    console.log('Tether System Doctor:');
    const token = loadOrCreateToken();
    console.log(`[✓] Token file present (${token.length} chars)`);

    try {
      const vault = new VaultService();
      const secrets = await vault.listSecrets();
      console.log(`[✓] OS Keychain accessible (${secrets.length} secrets stored)`);
    } catch (err) {
      console.log(`[!] OS Keychain check failed: ${String(err)}`);
    }

    const harnesses = detectInstalledHarnesses();
    for (const h of harnesses) {
      console.log(
        `[${h.exists ? '✓' : '-'}] Harness ${h.name}: ${h.exists ? 'Found' : 'Not found'}`,
      );
    }
  });

program
  .command('update')
  .description('Check for daemon updates')
  .action(async () => {
    const res = await checkForUpdate('0.1.0');
    if (res.updateAvailable && res.release) {
      console.log(`New version available: ${res.release.version}`);
      console.log(`Download: ${res.release.url}`);
    } else {
      console.log('Tether daemon is up to date (0.1.0).');
    }
  });

if (process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('tether')) {
  program.parse();
}

export { program };
