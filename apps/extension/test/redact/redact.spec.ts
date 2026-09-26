// @vitest-environment node
/**
 * Outbound Redactor Tests (PRD FR-509, HR-7, TRD §6.7).
 * Verifies detector regexes, redaction formats, recursive walk, and hit logging.
 */

import { describe, expect, test } from 'vitest';
import { detect, getCardBrand, isLuhnValid } from '../../lib/redact/detectors.js';
import { redact, redactString } from '../../lib/redact/redact.js';

describe('Outbound Redactor (PRD FR-509, HR-7, TRD §6.7)', () => {
  // 1. PAN detection & Luhn validation
  test('FR-509: isLuhnValid and getCardBrand validate credit card numbers', () => {
    expect(isLuhnValid('4242424242424242')).toBe(true);
    expect(isLuhnValid('4242424242424241')).toBe(false);
    expect(getCardBrand('4242424242424242')).toBe('visa');
    expect(getCardBrand('5105105105105100')).toBe('mastercard');
    expect(getCardBrand('378282246310005')).toBe('amex');
    expect(getCardBrand('6011111111111117')).toBe('discover');
  });

  test('FR-509: redacts valid PAN (continuous and spaced)', () => {
    const res1 = redactString('Payment with 4242424242424242 card');
    expect(res1.redacted).toBe('Payment with ⟨PAN:visa••••4242⟩ card');
    expect(res1.hits.length).toBe(1);

    const res2 = redactString('Spaced card 4242 4242 4242 4242 ending');
    expect(res2.redacted).toBe('Spaced card ⟨PAN:visa••••4242⟩ ending');
  });

  // 2. Email redaction
  test('FR-509: redacts email preserving first letter and domain', () => {
    const res = redactString('Contact user@example.com for support');
    expect(res.redacted).toBe('Contact ⟨EMAIL:u•••@example.com⟩ for support');
    expect(res.hits[0]?.kind).toBe('EMAIL');
  });

  // 3. Phone redaction
  test('FR-509: redacts phone numbers with last 4 digits preserved', () => {
    const res = redactString('Call us at +1-555-123-4567 or 555-987-6543');
    expect(res.redacted).toContain('⟨PHONE:•••4567⟩');
    expect(res.redacted).toContain('⟨PHONE:•••6543⟩');
  });

  // 4. IBAN redaction
  test('FR-509: redacts IBAN values', () => {
    const res = redactString('Transfer to GB82WEST12345698765432 please');
    expect(res.redacted).toBe('Transfer to ⟨IBAN:••••⟩ please');
    expect(res.hits[0]?.kind).toBe('IBAN');
  });

  // 5. Bearer & JWT token redaction
  test('FR-509: redacts Bearer and standalone JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG4T8J_example';
    const res = redactString(`Authorization: Bearer ${jwt}`);
    expect(res.redacted).toBe('Authorization: ⟨TOKEN⟩');
  });

  // 6. API key redaction
  test('FR-509: redacts API key shapes with prefix', () => {
    const res1 = redactString('Secret key is sk_test_4eC39HqLyjWDarjtT1zdp7dc');
    expect(res1.redacted).toBe('Secret key is ⟨APIKEY:sk⟩');

    const res2 = redactString('GitHub token ghp_1234567890abcdef1234567890');
    expect(res2.redacted).toBe('GitHub token ⟨APIKEY:ghp⟩');
  });

  // 7. Private key blocks
  test('FR-509: redacts private key blocks', () => {
    const block = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Yg...
...dummy...
-----END RSA PRIVATE KEY-----`;
    const res = redactString(`Key data:\n${block}`);
    expect(res.redacted).toBe('Key data:\n⟨PRIVATEKEY⟩');
  });

  // 8. Nested object recursive walk
  test('FR-509: recursively redacts nested objects', () => {
    const payload = {
      user: {
        email: 'user@example.com',
        profile: { phone: '+1-555-123-4567' },
      },
      ok: true,
    };
    const { redacted, hits } = redact(payload);
    expect(redacted).toEqual({
      user: {
        email: '⟨EMAIL:u•••@example.com⟩',
        profile: { phone: '⟨PHONE:•••4567⟩' },
      },
      ok: true,
    });
    expect(hits.length).toBe(2);
  });

  // 9. Array recursive walk
  test('FR-509: recursively redacts arrays of items', () => {
    const payload = ['user@example.com', '+1-555-123-4567', 12345];
    const { redacted, hits } = redact(payload);
    expect(redacted).toEqual(['⟨EMAIL:u•••@example.com⟩', '⟨PHONE:•••4567⟩', 12345]);
    expect(hits.length).toBe(2);
  });

  // 10. No hits on clean payload
  test('FR-509: returns unmodified payload when no sensitive data found', () => {
    const payload = { message: 'hello world', count: 42, active: true };
    const { redacted, hits } = redact(payload);
    expect(redacted).toEqual(payload);
    expect(hits.length).toBe(0);
  });

  // 11. Mixed sensitive data in single object
  test('FR-509: redacts multiple sensitive fields in one object', () => {
    const payload = {
      card: '4242424242424242',
      email: 'user@example.com',
      token: 'sk_live_12345678901234567890',
    };
    const { redacted, hits } = redact(payload);
    expect(redacted).toEqual({
      card: '⟨PAN:visa••••4242⟩',
      email: '⟨EMAIL:u•••@example.com⟩',
      token: '⟨APIKEY:sk⟩',
    });
    expect(hits.length).toBe(3);
  });

  // 12. Edge cases: empty string and nulls
  test('FR-509: handles empty string, null, and undefined without error', () => {
    expect(redact('')).toEqual({ redacted: '', hits: [] });
    expect(redact(null)).toEqual({ redacted: null, hits: [] });
    expect(redact(undefined)).toEqual({ redacted: undefined, hits: [] });
    expect(detect('')).toEqual([]);
  });
});
