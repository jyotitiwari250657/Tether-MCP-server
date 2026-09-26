// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { formatToolResultMarkdown, injectIntoComposer } from '../../lib/chatbridge/injector.js';
import { parseToolCallBlocks } from '../../lib/chatbridge/parser.js';

// PRD FR-620, NG-12, TRD §6.16: Chat-UI Bridge
describe('Chat-UI Bridge Parser & Composer Injector', () => {
  it('parses valid fenced tether-tool markdown blocks', () => {
    const markdown = `
Here is what I plan to do:

\`\`\`tether-tool
{
  "tool": "click",
  "args": { "ref": "button-login" }
}
\`\`\`

And then check the output.
`;

    const parsed = parseToolCallBlocks(markdown);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.tool).toBe('click');
    expect(parsed[0]?.args).toEqual({ ref: 'button-login' });
  });

  it('ignores non-tether code blocks and malformed JSON blocks', () => {
    const markdown = `
\`\`\`json
{ "tool": "not_tether" }
\`\`\`

\`\`\`tether-tool
{ invalid json syntax
\`\`\`

\`\`\`typescript
const a = 1;
\`\`\`
`;

    const parsed = parseToolCallBlocks(markdown);
    expect(parsed).toHaveLength(0);
  });

  it('formats tool results into fenced tether-result markdown', () => {
    const formatted = formatToolResultMarkdown('call_123', true, {
      status: 'ok',
    });
    expect(formatted).toContain('```tether-result');
    expect(formatted).toContain('"id": "call_123"');
    expect(formatted).toContain('"ok": true');
    expect(formatted).toContain('```');
  });

  it('injects formatted result into textarea chat composer', () => {
    const textarea = document.createElement('textarea');
    textarea.id = 'prompt-textarea';
    textarea.value = 'Existing user message';
    document.body.appendChild(textarea);

    const injected = injectIntoComposer(document, '```tether-result\n{"ok":true}\n```');
    expect(injected).toBe(true);
    expect(textarea.value).toContain('Existing user message\n\n```tether-result');

    document.body.removeChild(textarea);
  });

  it('injects formatted result into contenteditable chat composer', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);

    const injected = injectIntoComposer(document, '```tether-result\n{"ok":true}\n```');
    expect(injected).toBe(true);
    expect(div.innerHTML).toContain('tether-result');

    document.body.removeChild(div);
  });
});
