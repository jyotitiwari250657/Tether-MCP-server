// TRD §4.3: shared dummy-tool factory for policy engine specs.
import type { ToolSpec } from '@tether/protocol';

export function createDummyTool(
  name: string,
  tier: 0 | 1 | 2 | 3,
  powerMode = false,
  secret = false,
): ToolSpec {
  return {
    name,
    title: name,
    description: `Test tool ${name}`,
    tier,
    profiles: ['browser-act'],
    annotations: {
      readOnlyHint: tier === 0,
      destructiveHint: tier === 2,
      openWorldHint: false,
      idempotentHint: true,
    },
    input: {} as unknown as ToolSpec['input'],
    output: {} as unknown as ToolSpec['output'],
    requires: { powerMode, secret },
    budgetMs: 5000,
  };
}
