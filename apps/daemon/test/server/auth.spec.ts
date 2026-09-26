import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateToken, loadOrCreateToken, verifyToken } from '../../src/server/auth.js';

describe('Daemon Auth & Token (PRD SEC-07, TRD §7.2)', () => {
  let tempDir: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-auth-test-'));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates a 64-character hex token (32 random bytes)', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('creates ~/.tether/token with 0600 permissions if not present', () => {
    const token = loadOrCreateToken();
    const tokenPath = path.join(tempDir, '.tether', 'token');

    expect(fs.existsSync(tokenPath)).toBe(true);
    const content = fs.readFileSync(tokenPath, 'utf-8').trim();
    expect(content).toBe(token);

    if (process.platform !== 'win32') {
      const stats = fs.statSync(tokenPath);
      expect(stats.mode & 0o777).toBe(0o600);
    }
  });

  it('loads existing token from ~/.tether/token', () => {
    const tetherDir = path.join(tempDir, '.tether');
    fs.mkdirSync(tetherDir, { recursive: true });
    const existingToken = 'a'.repeat(64);
    fs.writeFileSync(path.join(tetherDir, 'token'), existingToken, 'utf-8');

    const loaded = loadOrCreateToken();
    expect(loaded).toBe(existingToken);
  });

  it('verifies tokens using constant-time comparison', () => {
    const valid = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    expect(verifyToken(valid, valid)).toBe(true);
    expect(verifyToken('wrong', valid)).toBe(false);
    expect(verifyToken(valid, 'wrong')).toBe(false);
  });
});
