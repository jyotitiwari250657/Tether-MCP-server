import { describe, expect, test } from 'vitest';
import { PROTOCOL_VERSION, isCompatible } from '../src/version.js';

describe('Protocol Versioning Contract', () => {
  test('TRD §5.1 / PRD HR-4: PROTOCOL_VERSION is defined as literal 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  test('TRD §5.1 / PRD HR-5: isCompatible accepts matching protocol version', () => {
    expect(isCompatible(1)).toBe(true);
    expect(isCompatible(PROTOCOL_VERSION)).toBe(true);
  });

  test('TRD §5.1 / PRD HR-5: isCompatible rejects older protocol versions', () => {
    expect(isCompatible(0)).toBe(false);
    expect(isCompatible(-1)).toBe(false);
  });

  test('TRD §5.1 / PRD HR-5: isCompatible rejects newer protocol versions', () => {
    expect(isCompatible(2)).toBe(false);
    expect(isCompatible(99)).toBe(false);
  });
});
