// @vitest-environment happy-dom
/**
 * Sensitive Categories Classifier Tests (PRD FR-503, TRD §6.6.3).
 * Verifies domain blocklist classifications, heuristics, and credential detection.
 */

import { describe, expect, test } from 'vitest';
import { BLOCKLIST, classify, hasCredentialEntry } from '../../lib/policy/categories.js';

describe('Policy Sensitive Categories & Blocklist (PRD FR-503, TRD §6.6.3)', () => {
  test('FR-503: BLOCKLIST contains all mandatory sensitive categories', () => {
    expect(BLOCKLIST).toEqual(
      expect.arrayContaining([
        'banking',
        'email',
        'crypto',
        'cloud-console',
        'health',
        'government',
      ]),
    );
  });

  test('FR-503: classifies banking domains correctly', () => {
    expect(classify('chase.com')).toBe('banking');
    expect(classify('bankofamerica.com')).toBe('banking');
    expect(classify('https://www.paypal.com/checkout')).toBe('banking');
  });

  test('FR-503: classifies email providers correctly', () => {
    expect(classify('gmail.com')).toBe('email');
    expect(classify('https://outlook.com/owa')).toBe('email');
    expect(classify('protonmail.com')).toBe('email');
  });

  test('FR-503: classifies crypto exchanges and wallets correctly', () => {
    expect(classify('coinbase.com')).toBe('crypto');
    expect(classify('https://binance.com')).toBe('crypto');
    expect(classify('metamask.io')).toBe('crypto');
  });

  test('FR-503: classifies cloud and admin consoles correctly', () => {
    expect(classify('console.cloud.google.com')).toBe('cloud-console');
    expect(classify('https://portal.azure.com')).toBe('cloud-console');
    expect(classify('aws.amazon.com')).toBe('cloud-console');
  });

  test('FR-503: classifies health records systems correctly', () => {
    expect(classify('mychart.com')).toBe('health');
    expect(classify('epic.com')).toBe('health');
    expect(classify('https://clinic.example.com/patient/records')).toBe('health');
  });

  test('FR-503: classifies government portals correctly', () => {
    expect(classify('irs.gov')).toBe('government');
    expect(classify('usa.gov')).toBe('government');
    expect(classify('service.gov.uk')).toBe('government');
  });

  test('FR-503: classifies non-sensitive domains as null', () => {
    expect(classify('example.com')).toBeNull();
    expect(classify('https://news.ycombinator.com')).toBeNull();
    expect(classify('')).toBeNull();
  });

  test('FR-503: applies keyword heuristics for banking and crypto', () => {
    expect(classify('https://community-bank-local.org')).toBe('banking');
    expect(classify('https://my-phantom-wallet-extension.io')).toBe('crypto');
  });

  test('FR-503: applies path heuristics for email/passwords and consoles', () => {
    expect(classify('https://auth.company.org/password/reset')).toBe('email');
    expect(classify('https://internal.company.org/settings/security')).toBe('cloud-console');
  });

  test('TRD §6.6.3: hasCredentialEntry detects visible password and OTP inputs', () => {
    document.body.innerHTML = `
      <div>
        <input type="text" name="username" />
        <input type="password" name="pwd" />
      </div>
    `;
    expect(hasCredentialEntry(document)).toBe(true);

    document.body.innerHTML = `
      <div>
        <input type="text" autocomplete="one-time-code" />
      </div>
    `;
    expect(hasCredentialEntry(document)).toBe(true);

    document.body.innerHTML = `
      <div>
        <input type="text" name="search" />
      </div>
    `;
    expect(hasCredentialEntry(document)).toBe(false);

    // Hidden password input should be ignored
    document.body.innerHTML = `
      <div>
        <input type="password" style="display: none" />
      </div>
    `;
    expect(hasCredentialEntry(document)).toBe(false);
  });
});
