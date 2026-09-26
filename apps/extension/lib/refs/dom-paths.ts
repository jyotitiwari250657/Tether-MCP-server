/**
 * CSS Path and XPath Generation (TRD §6.4.3, §6.4.4).
 * Generates unambiguous selectors for element re-querying during self-healing.
 */

export function getCssPath(element: Element): string {
  if (element.id) {
    return `#${CSS.escape ? CSS.escape(element.id) : element.id}`;
  }

  const parts: string[] = [];
  let curr: Element | null = element;

  while (curr && curr.nodeType === 1 /* ELEMENT_NODE */ && curr.tagName.toUpperCase() !== 'HTML') {
    if (curr.id) {
      parts.unshift(`#${CSS.escape ? CSS.escape(curr.id) : curr.id}`);
      break;
    }

    const tag = curr.tagName.toLowerCase();
    let index = 1;
    let sibling = curr.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tag) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    parts.unshift(`${tag}:nth-of-type(${index})`);
    curr = curr.parentElement;
  }

  return parts.join(' > ');
}

export function getXPath(element: Element): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts: string[] = [];
  let curr: Element | null = element;

  while (curr && curr.nodeType === 1) {
    if (curr.id) {
      parts.unshift(`*[@id="${curr.id}"]`);
      return `//${parts.join('/')}`;
    }

    const tag = curr.tagName.toLowerCase();
    let index = 1;
    let sibling = curr.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tag) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    parts.unshift(`${tag}[${index}]`);
    curr = curr.parentElement;
  }

  return `/${parts.join('/')}`;
}
