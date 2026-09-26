/**
 * Daemon Update Checker (TRD §7).
 */

export interface ReleaseInfo {
  version: string;
  url: string;
  sha256: string;
  signature: string; // Ed25519 signature
  releaseNotes?: string;
}

export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  const [lMaj = 0, lMin = 0, lPatch = 0] = parse(latest);

  if (lMaj > cMaj) return true;
  if (lMaj === cMaj && lMin > cMin) return true;
  if (lMaj === cMaj && lMin === cMin && lPatch > cPatch) return true;
  return false;
}

export async function checkForUpdate(
  currentVersion: string,
  feedUrl = 'https://releases.tether.dev/daemon/latest.json',
  fetcher: typeof fetch = globalThis.fetch,
): Promise<{ updateAvailable: boolean; release?: ReleaseInfo }> {
  try {
    const res = await fetcher(feedUrl);
    if (!res.ok) {
      return { updateAvailable: false };
    }
    const release = (await res.json()) as ReleaseInfo;
    const updateAvailable = isNewerVersion(currentVersion, release.version);
    return { updateAvailable, release };
  } catch {
    return { updateAvailable: false };
  }
}
