// PRD FR-620, TRD §6.16: Chat Composer Tool Result Injector
export function formatToolResultMarkdown(id: string, ok: boolean, result: unknown): string {
  const payload = {
    id,
    ok,
    result,
  };
  return `\`\`\`tether-result\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

export function injectIntoComposer(doc: Document, formattedResult: string): boolean {
  // Common selectors for chat web UIs: ChatGPT, Claude, generic contenteditable/textarea
  const inputEl = doc.querySelector<HTMLTextAreaElement | HTMLDivElement>(
    '#prompt-textarea, textarea[placeholder*="message" i], div[contenteditable="true"]',
  );

  if (!inputEl) return false;

  if (inputEl instanceof HTMLTextAreaElement) {
    const existing = inputEl.value;
    inputEl.value = existing ? `${existing}\n\n${formattedResult}` : formattedResult;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (inputEl.getAttribute('contenteditable') === 'true' || inputEl.isContentEditable) {
    const p = doc.createElement('p');
    p.textContent = formattedResult;
    inputEl.appendChild(p);
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return true;
  }

  return false;
}
