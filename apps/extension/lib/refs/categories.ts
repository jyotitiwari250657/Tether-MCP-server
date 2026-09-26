/**
 * DOM Node Categorization Helpers (TRD §6.4.1).
 * Detects interactive, landmark, textual, and hidden DOM elements.
 */

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'menuitem',
  'tab',
  'switch',
  'option',
  'searchbox',
  'slider',
  'spinbutton',
]);

const LANDMARK_ROLES = new Set([
  'main',
  'navigation',
  'banner',
  'contentinfo',
  'form',
  'table',
  'dialog',
  'region',
  'alert',
  'status',
  'complementary',
  'search',
  'list',
  'listitem',
  'article',
]);

export function isHidden(element: Element): boolean {
  if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('inert')) {
    return true;
  }
  const win = element.ownerDocument?.defaultView ?? globalThis;
  if (win.getComputedStyle) {
    const style = win.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return true;
    }
  }
  const r = element.getBoundingClientRect?.();
  if (r && r.width > 0 && r.height > 0 && (r.width < 2 || r.height < 2)) {
    return true;
  }
  return false;
}

export function isInteractive(element: Element, role: string): boolean {
  const tag = element.tagName.toUpperCase();
  if (tag === 'A' && element.hasAttribute('href')) return true;
  if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'SUMMARY') return true;
  if (tag === 'INPUT' && (element.getAttribute('type') ?? '').toLowerCase() !== 'hidden')
    return true;
  if (tag === 'LABEL' && element.hasAttribute('for')) return true;
  if (INTERACTIVE_ROLES.has(role)) return true;
  if (element.hasAttribute('tabindex')) {
    const tabIdx = Number.parseInt(element.getAttribute('tabindex') ?? '-1', 10);
    if (tabIdx >= 0) return true;
  }
  return (
    element.hasAttribute('contenteditable') ||
    element.hasAttribute('onclick') ||
    element.hasAttribute('aria-disabled')
  );
}

export function isTextual(element: Element): boolean {
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child && child.nodeType === 3 /* TEXT_NODE */) {
      if ((child.textContent ?? '').trim().length > 0) return true;
    }
  }
  return false;
}

export function isLandmark(element: Element, role: string, name: string): boolean {
  const tag = element.tagName.toUpperCase();
  if (tag === 'FORM' || tag === 'SECTION' || tag === 'NAV') {
    return name.trim().length > 0;
  }
  if (
    tag === 'MAIN' ||
    tag === 'HEADER' ||
    tag === 'FOOTER' ||
    tag === 'ASIDE' ||
    tag === 'TABLE' ||
    tag === 'DIALOG'
  )
    return true;
  return LANDMARK_ROLES.has(role);
}

export function getStates(element: Element): string[] {
  const states: string[] = [];
  const el = element as HTMLInputElement;
  if (el.checked || element.getAttribute('aria-checked') === 'true') states.push('checked');
  if ((element as HTMLOptionElement).selected || element.getAttribute('aria-selected') === 'true')
    states.push('selected');
  if (element.getAttribute('aria-expanded') === 'true') states.push('expanded');
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true')
    states.push('disabled');
  if (element.hasAttribute('required') || element.getAttribute('aria-required') === 'true')
    states.push('required');
  return states;
}
