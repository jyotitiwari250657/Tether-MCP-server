import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

// FR-101: Manifest V3 with React, module SW, side panel, popup, and runtime content script
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: () => {
    const isFull = process.env.TETHER_MANIFEST === 'full';
    const manifestFile = isFull ? './manifest.full.json' : './manifest.lean.json';
    const manifestPath = fileURLToPath(new URL(manifestFile, import.meta.url));
    const raw = readFileSync(manifestPath, 'utf-8');
    const base = JSON.parse(raw);

    return {
      ...base,
      content_scripts: [],
    };
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // PRD FR-102, HR-3: <all_urls> is in optional_host_permissions only for lean store package
      // For automated testing and internal development, host_permissions allows headless/automation drivers
      if (process.env.TETHER_MANIFEST === 'lean') {
        manifest.host_permissions = undefined;
      } else {
        manifest.host_permissions = ['<all_urls>'];
      }
      manifest.content_scripts = [];
    },
  },
  vite: () => ({
    build: {
      target: 'esnext',
      minify: 'esbuild',
    },
    resolve: {
      alias: {
        '@tether/protocol': fileURLToPath(
          new URL('../../packages/protocol/src/index.ts', import.meta.url),
        ),
      },
    },
  }),
});
