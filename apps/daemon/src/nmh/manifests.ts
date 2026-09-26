/**
 * Native Messaging Host Manifests (PRD FR-308, TRD §7.8).
 */

import * as path from 'node:path';

export interface NmhManifest {
  name: string;
  description: string;
  path: string;
  type: 'stdio';
  allowed_origins: string[];
}

export function generateNmhManifest(
  binaryPath: string,
  allowedExtensionIds: string[],
): NmhManifest {
  return {
    name: 'com.tether.native',
    description: 'Tether Native Messaging Host bridge',
    path: path.resolve(binaryPath),
    type: 'stdio',
    allowed_origins: allowedExtensionIds.map((id) => `chrome-extension://${id}/`),
  };
}

export function getDefaultManifestPath(platform: NodeJS.Platform = process.platform): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  switch (platform) {
    case 'win32':
      return path.join(home, '.tether', 'nmh-manifest.json');
    case 'darwin':
      return path.join(
        home,
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'NativeMessagingHosts',
        'com.tether.native.json',
      );
    default:
      return path.join(
        home,
        '.config',
        'google-chrome',
        'NativeMessagingHosts',
        'com.tether.native.json',
      );
  }
}
