// @vitest-environment happy-dom
/**
 * Implicit Role & Accessible Name Unit Tests (PRD FR-201, TRD §6.4.2).
 */

import { describe, expect, test } from 'vitest';
import { accessibleName } from '../../lib/refs/accessibleName.js';
import { getCssPath, getXPath } from '../../lib/refs/dom-paths.js';
import { implicitRole } from '../../lib/refs/implicit-role.js';
import { sha1 } from '../../lib/refs/sha1.js';
import { snapshot } from '../../lib/refs/snapshot.js';

describe('Ref Engine — Implicit Role & Accessible Name (PRD FR-201, TRD §6.4.2)', () => {
  test('FR-201: implicitRole correctly maps all HTML tags', () => {
    const createElement = (tag: string, attrs: Record<string, string> = {}) => {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
      }
      return el;
    };

    expect(implicitRole(createElement('a', { href: '#' }))).toBe('link');
    expect(implicitRole(createElement('a'))).toBeNull();
    expect(implicitRole(createElement('button'))).toBe('button');

    // Inputs
    expect(implicitRole(createElement('input', { type: 'button' }))).toBe('button');
    expect(implicitRole(createElement('input', { type: 'image' }))).toBe('button');
    expect(implicitRole(createElement('input', { type: 'reset' }))).toBe('button');
    expect(implicitRole(createElement('input', { type: 'submit' }))).toBe('button');
    expect(implicitRole(createElement('input', { type: 'checkbox' }))).toBe('checkbox');
    expect(implicitRole(createElement('input', { type: 'radio' }))).toBe('radio');
    expect(implicitRole(createElement('input', { type: 'range' }))).toBe('slider');
    expect(implicitRole(createElement('input', { type: 'number' }))).toBe('spinbutton');
    expect(implicitRole(createElement('input', { type: 'search' }))).toBe('searchbox');
    expect(implicitRole(createElement('input', { type: 'email' }))).toBe('textbox');
    expect(implicitRole(createElement('input', { type: 'tel' }))).toBe('textbox');
    expect(implicitRole(createElement('input', { type: 'text' }))).toBe('textbox');
    expect(implicitRole(createElement('input', { type: 'url' }))).toBe('textbox');
    expect(implicitRole(createElement('input', { type: 'hidden' }))).toBeNull();
    expect(implicitRole(createElement('input', { type: 'unknown-type' }))).toBe('textbox');

    // Controls & Tables
    expect(implicitRole(createElement('textarea'))).toBe('textbox');
    expect(implicitRole(createElement('select'))).toBe('combobox');
    expect(implicitRole(createElement('select', { multiple: '' }))).toBe('listbox');
    expect(implicitRole(createElement('select', { size: '4' }))).toBe('listbox');
    expect(implicitRole(createElement('option'))).toBe('option');
    expect(implicitRole(createElement('optgroup'))).toBe('group');
    expect(implicitRole(createElement('datalist'))).toBe('listbox');
    expect(implicitRole(createElement('table'))).toBe('table');
    expect(implicitRole(createElement('tr'))).toBe('row');
    expect(implicitRole(createElement('th'))).toBe('columnheader');
    expect(implicitRole(createElement('th', { scope: 'row' }))).toBe('rowheader');
    expect(implicitRole(createElement('td'))).toBe('cell');

    // Lists & Headings
    expect(implicitRole(createElement('ul'))).toBe('list');
    expect(implicitRole(createElement('ol'))).toBe('list');
    expect(implicitRole(createElement('menu'))).toBe('list');
    expect(implicitRole(createElement('li'))).toBe('listitem');
    expect(implicitRole(createElement('h1'))).toBe('heading');
    expect(implicitRole(createElement('h2'))).toBe('heading');
    expect(implicitRole(createElement('h3'))).toBe('heading');
    expect(implicitRole(createElement('h4'))).toBe('heading');
    expect(implicitRole(createElement('h5'))).toBe('heading');
    expect(implicitRole(createElement('h6'))).toBe('heading');

    // Landmarks
    expect(implicitRole(createElement('nav'))).toBe('navigation');
    expect(implicitRole(createElement('main'))).toBe('main');
    expect(implicitRole(createElement('header'))).toBe('banner');
    expect(implicitRole(createElement('footer'))).toBe('contentinfo');
    expect(implicitRole(createElement('aside'))).toBe('complementary');
    expect(implicitRole(createElement('form'))).toBe('form');
    expect(implicitRole(createElement('dialog'))).toBe('dialog');
    expect(implicitRole(createElement('section'))).toBe('region');
    expect(implicitRole(createElement('article'))).toBe('article');

    // Scoped header/footer inside article
    const article = createElement('article');
    const innerHeader = createElement('header');
    article.appendChild(innerHeader);
    expect(implicitRole(innerHeader)).toBeNull();

    const innerFooter = createElement('footer');
    article.appendChild(innerFooter);
    expect(implicitRole(innerFooter)).toBeNull();

    // Misc
    expect(implicitRole(createElement('hr'))).toBe('separator');
    expect(implicitRole(createElement('progress'))).toBe('progressbar');
    expect(implicitRole(createElement('img'))).toBe('img');
    expect(implicitRole(createElement('figure'))).toBe('figure');
    expect(implicitRole(createElement('summary'))).toBe('button');
    expect(implicitRole(createElement('details'))).toBe('group');
    expect(implicitRole(createElement('div'))).toBeNull();
  });

  test('FR-201: accessibleName covers all priority chain levels and multi-id resolution', () => {
    // 1. alt
    const img = document.createElement('img');
    img.setAttribute('alt', 'Company Logo');
    expect(accessibleName(img)).toBe('Company Logo');

    // 2. title
    const div = document.createElement('div');
    div.setAttribute('title', 'Tooltip Title');
    expect(accessibleName(div)).toBe('Tooltip Title');

    // 3. aria-placeholder
    const inp = document.createElement('input');
    inp.setAttribute('aria-placeholder', 'Search items...');
    expect(accessibleName(inp)).toBe('Search items...');

    // 4. parent label
    const label = document.createElement('label');
    label.textContent = 'Parent Label Text';
    const childSpan = document.createElement('span');
    label.appendChild(childSpan);
    expect(accessibleName(childSpan)).toBe('Parent Label Text');

    // 5. aria-labelledby with multiple IDs
    const doc = document;
    const s1 = doc.createElement('span');
    s1.id = 'part1';
    s1.textContent = 'First';
    const s2 = doc.createElement('span');
    s2.id = 'part2';
    s2.textContent = 'Last';
    const btn = doc.createElement('button');
    btn.setAttribute('aria-labelledby', 'part1 part2');
    doc.body.appendChild(s1);
    doc.body.appendChild(s2);
    doc.body.appendChild(btn);

    expect(accessibleName(btn)).toBe('First Last');

    // 6. empty fallback
    const emptyDiv = document.createElement('div');
    expect(accessibleName(emptyDiv)).toBe('');
  });

  test('TRD §6.4.3: sha1 processes multi-byte unicode characters correctly', () => {
    const ascii = sha1('hello');
    const multiByte1 = sha1('café');
    const multiByte2 = sha1('こんにちは');

    expect(ascii).toHaveLength(40);
    expect(multiByte1).toHaveLength(40);
    expect(multiByte2).toHaveLength(40);
  });

  test('TRD §6.4.3: dom-paths generates selectors with IDs and nth-of-type', () => {
    const container = document.createElement('div');
    container.innerHTML = '<ul id="list"><li>Item 1</li><li>Item 2</li></ul>';
    document.body.appendChild(container);

    const items = container.querySelectorAll('li');
    const secondItem = items[1];
    if (!secondItem) throw new Error('secondItem not found');
    expect(getCssPath(secondItem)).toContain('li:nth-of-type(2)');
    expect(getXPath(secondItem)).toContain('li[2]');

    const list = document.getElementById('list');
    if (!list) throw new Error('list not found');
    expect(getCssPath(list)).toBe('#list');
    expect(getXPath(list)).toBe('//*[@id="list"]');
  });

  test('FR-205: snapshot triggers token reduction loop when maxTokens is constrained', async () => {
    document.body.innerHTML = `
      <div>
        <button>First Long Action Button Name Here</button>
        <button>Second Long Action Button Name Here</button>
        <button>Third Long Action Button Name Here</button>
      </div>
    `;

    const result = await snapshot(1, { maxTokens: 15 }, document.body);
    expect(result.truncated).toBe(true);
    expect(result.tokens).toBeLessThanOrEqual(25);
  });
});
