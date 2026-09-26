/**
 * Accessible Name Computation (PRD FR-201, PRD HR-7, TRD §6.4.2).
 * Implements simplified W3C ACCNAME priority chain with secret redaction.
 */

const SECRET_NAME_PATTERN = /(?:otp|cvv|cvc|password|passwd|pin|token|secret)/i;

function isSecretField(element: Element): boolean {
  if (element.tagName.toUpperCase() !== 'INPUT') {
    return false;
  }
  const type = (element.getAttribute('type') ?? '').toLowerCase();
  if (type === 'password') {
    return true;
  }
  const autocomplete = (element.getAttribute('autocomplete') ?? '').toLowerCase();
  if (autocomplete === 'one-time-code' || autocomplete.includes('password')) {
    return true;
  }
  const name = element.getAttribute('name') ?? '';
  const id = element.getAttribute('id') ?? '';
  return SECRET_NAME_PATTERN.test(name) || SECRET_NAME_PATTERN.test(id);
}

function resolveLabelledBy(element: Element): string {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (!labelledBy) {
    return '';
  }
  const doc = element.ownerDocument ?? document;
  const ids = labelledBy.trim().split(/\s+/);
  const parts: string[] = [];
  for (const id of ids) {
    const target = doc.getElementById(id);
    if (target) {
      const text = (target.textContent ?? '').trim();
      if (text) {
        parts.push(text);
      }
    }
  }
  return parts.join(' ');
}

function resolveForLabel(element: Element): string {
  const id = element.getAttribute('id');
  if (!id) {
    return '';
  }
  const doc = element.ownerDocument ?? document;
  const label = doc.querySelector(`label[for="${id}"]`);
  return label ? (label.textContent ?? '').trim() : '';
}

function resolveParentLabel(element: Element): string {
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName.toUpperCase() === 'LABEL') {
      const text = (parent.textContent ?? '').trim();
      return text.slice(0, 40);
    }
    parent = parent.parentElement;
  }
  return '';
}

function getOwnText(element: Element): string {
  let text = '';
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child && child.nodeType === 3 /* TEXT_NODE */) {
      text += child.textContent ?? '';
    }
  }
  return text.trim().slice(0, 80);
}

/**
 * Computes accessible name per TRD §6.4.2 priority chain.
 * HR-7: Password and OTP field values are strictly suppressed.
 */
export function accessibleName(element: Element): string {
  // 1. aria-label
  const ariaLabel = (element.getAttribute('aria-label') ?? '').trim();
  if (ariaLabel) {
    return ariaLabel;
  }

  // 2. aria-labelledby (resolved, space-joined)
  const labelledByText = resolveLabelledBy(element);
  if (labelledByText) {
    return labelledByText;
  }

  // 3. label[for=id] text
  const forLabelText = resolveForLabel(element);
  if (forLabelText) {
    return forLabelText;
  }

  // 4. alt
  const alt = (element.getAttribute('alt') ?? '').trim();
  if (alt) {
    return alt;
  }

  // 5. title
  const title = (element.getAttribute('title') ?? '').trim();
  if (title) {
    return title;
  }

  // 6. placeholder / aria-placeholder
  const placeholder = (
    element.getAttribute('placeholder') ??
    element.getAttribute('aria-placeholder') ??
    ''
  ).trim();
  if (placeholder) {
    return placeholder;
  }

  // 7. value (if not a password/OTP/secret field - HR-7)
  if (!isSecretField(element)) {
    const val = (element as HTMLInputElement).value;
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }

  // 8. own text content (trimmed, <= 80 chars)
  const ownText = getOwnText(element);
  if (ownText) {
    return ownText;
  }

  // 9. parent's label text (<= 40 chars)
  const parentLabelText = resolveParentLabel(element);
  if (parentLabelText) {
    return parentLabelText;
  }

  return '';
}
