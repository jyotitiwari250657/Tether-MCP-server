/**
 * HTML-AAM ARIA Implicit Role Mapping (PRD FR-201, TRD §6.4.2).
 * Maps HTML elements to their implicit ARIA role per W3C HTML-AAM.
 */

function isScopedToBody(element: Element): boolean {
  let parent = element.parentElement;
  while (parent) {
    const tag = parent.tagName.toUpperCase();
    if (
      tag === 'ARTICLE' ||
      tag === 'ASIDE' ||
      tag === 'NAV' ||
      tag === 'SECTION' ||
      tag === 'MAIN'
    ) {
      return false;
    }
    parent = parent.parentElement;
  }
  return true;
}

function inputRole(type: string): string | null {
  switch (type.toLowerCase()) {
    case 'button':
    case 'image':
    case 'reset':
    case 'submit':
      return 'button';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'range':
      return 'slider';
    case 'number':
      return 'spinbutton';
    case 'search':
      return 'searchbox';
    case 'email':
    case 'tel':
    case 'text':
    case 'url':
    case '':
      return 'textbox';
    case 'hidden':
      return null;
    default:
      return 'textbox';
  }
}

/**
 * Derives the implicit ARIA role for an HTML element per HTML-AAM.
 */
export function implicitRole(element: Element): string | null {
  const tagName = element.tagName.toUpperCase();

  switch (tagName) {
    case 'A':
      return element.hasAttribute('href') ? 'link' : null;

    case 'BUTTON':
      return 'button';

    case 'INPUT': {
      const type = element.getAttribute('type') ?? 'text';
      return inputRole(type);
    }

    case 'TEXTAREA':
      return 'textbox';

    case 'SELECT': {
      const isMultiple = element.hasAttribute('multiple');
      const size = Number.parseInt(element.getAttribute('size') ?? '1', 10);
      return isMultiple || size > 1 ? 'listbox' : 'combobox';
    }

    case 'OPTION':
      return 'option';

    case 'OPTGROUP':
      return 'group';

    case 'DATALIST':
      return 'listbox';

    case 'TABLE':
      return 'table';

    case 'TR':
      return 'row';

    case 'TH': {
      const scope = element.getAttribute('scope');
      return scope === 'row' ? 'rowheader' : 'columnheader';
    }

    case 'TD':
      return 'cell';

    case 'UL':
    case 'OL':
    case 'MENU':
      return 'list';

    case 'LI':
      return 'listitem';

    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return 'heading';

    case 'NAV':
      return 'navigation';

    case 'MAIN':
      return 'main';

    case 'HEADER':
      return isScopedToBody(element) ? 'banner' : null;

    case 'FOOTER':
      return isScopedToBody(element) ? 'contentinfo' : null;

    case 'ASIDE':
      return 'complementary';

    case 'FORM':
      return 'form';

    case 'DIALOG':
      return 'dialog';

    case 'SECTION':
      return 'region';

    case 'ARTICLE':
      return 'article';

    case 'HR':
      return 'separator';

    case 'PROGRESS':
      return 'progressbar';

    case 'IMG':
      return 'img';

    case 'FIGURE':
      return 'figure';

    case 'SUMMARY':
      return 'button';

    case 'DETAILS':
      return 'group';

    default:
      return null;
  }
}
