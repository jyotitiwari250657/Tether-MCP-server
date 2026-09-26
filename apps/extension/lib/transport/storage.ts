/**
 * Daemon Token Storage Bridge (SEC-07, TRD §6.11).
 * Reads and persists the daemon authentication token in chrome.storage.local.
 * Ensures zero plaintext token exposure in logs or error messages (HR-7).
 */

export const STORAGE_KEY_DAEMON_TOKEN = 'daemon:token';

/**
 * Ephemeral port override used by the e2e harness (Prompt 12 §1b, AC-P12-02):
 * the harness launches the daemon on a random free port and publishes it here
 * before the service worker connects. Always null in normal operation.
 */
export const STORAGE_KEY_DAEMON_PORT = 'e2e:daemonPort';

export async function loadDaemonPort(): Promise<number | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY_DAEMON_PORT);
      const val = stored?.[STORAGE_KEY_DAEMON_PORT];
      if (typeof val === 'number' && Number.isInteger(val) && val > 0 && val < 65536) {
        return val;
      }
    } catch {
      // Storage unavailable or errored
    }
  }
  return null;
}

/**
 * Loads the stored daemon token from chrome.storage.local if available.
 */
export async function loadStoredToken(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY_DAEMON_TOKEN);
      const val = stored?.[STORAGE_KEY_DAEMON_TOKEN];
      if (typeof val === 'string' && val.length > 0) {
        return val;
      }
    } catch {
      // Storage unavailable or errored
    }
  }
  return null;
}

/**
 * Persists the daemon token into chrome.storage.local.
 */
export async function saveStoredToken(token: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_DAEMON_TOKEN]: token });
    } catch {
      // Storage unavailable or errored
    }
  }
}
