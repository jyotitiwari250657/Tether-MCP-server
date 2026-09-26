/**
 * Harness Batch Configuration (PRD FR-309, TRD §7.5).
 */

import {
  type ConfigWriteResult,
  type HarnessConfigOptions,
  getHarnessWriter,
} from '../writers/index.js';
import { type DetectedHarness, detectInstalledHarnesses } from './detect.js';

export async function configureAllDetectedHarnesses(
  opts: HarnessConfigOptions = {},
): Promise<{ configured: ConfigWriteResult[]; skipped: DetectedHarness[] }> {
  const detected = detectInstalledHarnesses();
  const configured: ConfigWriteResult[] = [];
  const skipped: DetectedHarness[] = [];

  for (const h of detected) {
    if (h.exists) {
      const writer = getHarnessWriter(h.name);
      if (writer) {
        const result = await writer.writeConfig(opts);
        configured.push(result);
      }
    } else {
      skipped.push(h);
    }
  }

  return { configured, skipped };
}
