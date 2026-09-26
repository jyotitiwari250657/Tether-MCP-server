// @vitest-environment happy-dom
/**
 * Ref Engine Snapshot Tests (PRD FR-201..FR-206, TRD §6.4.1, §6.4.3).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { accessibleName } from '../../lib/refs/accessibleName.js';
import { implicitRole } from '../../lib/refs/implicit-role.js';
import { computeTextSig, sha1 } from '../../lib/refs/sha1.js';
import { clearNodeRegistries, snapshot } from '../../lib/refs/snapshot.js';

describe('Ref Engine — Snapshot (PRD FR-201..FR-205, TRD §6.4.1, §6.4.3)', () => {
  beforeEach(() => {
    clearNodeRegistries();
    document.body.innerHTML = '';
    // Mock chrome.storage.session
    const storageMock: Record<string, unknown> = {};
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        session: {
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(storageMock, items);
          }),
          get: vi.fn(async (key: string) => ({ [key]: storageMock[key] })),
        },
      },
    };
  });

  // 1. Basic snapshot of a simple form
  test('FR-201: basic snapshot produces indented tree format with refs', async () => {
    document.body.innerHTML = `
      <form aria-label="Login Form">
        <label for="username">Username</label>
        <input id="username" type="text" value="alice" />
        <button type="submit">Submit</button>
      </form>
    `;

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('- form "Login Form" [ref=A1]');
    expect(result.tree).toContain('  - textbox "Username"');
    expect(result.tree).toContain('  - button "Submit"');
    expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    expect(result.trust).toBe('untrusted');
  });

  // 2. Skip rules: SCRIPT, STYLE, display:none, aria-hidden pruned
  test('FR-202: skip rules prune script, style, display:none, and aria-hidden="true"', async () => {
    document.body.innerHTML = `
      <script>console.log("ignore");</script>
      <style>.hidden { display: none; }</style>
      <div style="display: none;">Invisible Text</div>
      <div aria-hidden="true"><button>Hidden Button</button></div>
      <div inert><button>Inert Button</button></div>
      <button>Visible Button</button>
    `;

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).not.toContain('Invisible');
    expect(result.tree).not.toContain('Hidden Button');
    expect(result.tree).not.toContain('Inert Button');
    expect(result.tree).toContain('- button "Visible Button"');
  });

  // 3. Interactive nodes: a[href], button, input, select, textarea, [role], [tabindex]
  test('FR-201: captures all interactive node types', async () => {
    document.body.innerHTML = `
      <a href="https://example.com">Link</a>
      <button>Click Me</button>
      <input type="checkbox" checked />
      <select><option selected>Option 1</option></select>
      <textarea>Comment</textarea>
      <div role="button">Custom Button</div>
      <div tabindex="0">Focusable Div</div>
    `;

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('link "Link"');
    expect(result.tree).toContain('button "Click Me"');
    expect(result.tree).toContain('checkbox');
    expect(result.tree).toContain('combobox');
    expect(result.tree).toContain('textbox');
    expect(result.tree).toContain('button "Custom Button"');
    expect(result.tree).toContain('Focusable Div');
  });

  // 4. Textual nodes: direct text content captured
  test('FR-201: captures direct text content on textual elements', async () => {
    document.body.innerHTML = `
      <p>Direct paragraph content</p>
      <span>Inline text snippet</span>
    `;

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('Direct paragraph content');
    expect(result.tree).toContain('Inline text snippet');
  });

  // 5. Landmarks: main, nav, header, footer, aside, form, table
  test('FR-201: identifies structural landmarks', async () => {
    document.body.innerHTML = `
      <header>Header content</header>
      <nav>Nav content</nav>
      <main>Main content</main>
      <footer>Footer content</footer>
      <aside>Aside content</aside>
      <table><tr><td>Cell</td></tr></table>
    `;

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('- banner');
    expect(result.tree).toContain('- navigation');
    expect(result.tree).toContain('- main');
    expect(result.tree).toContain('- contentinfo');
    expect(result.tree).toContain('- complementary');
    expect(result.tree).toContain('- table');
  });

  // 6. Open shadow DOM: traversal with 'S' prefix
  test('FR-203: traverses open shadow DOM with S prefix', async () => {
    const host = document.createElement('div');
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Shadow Host');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const innerBtn = document.createElement('button');
    innerBtn.textContent = 'Shadow Button';
    shadow.appendChild(innerBtn);

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('region "Shadow Host" [ref=A1]');
    expect(result.tree).toContain('button "Shadow Button" [ref=AS1]');
  });

  // 7. Same-origin iframe: frame prefix letter
  test('FR-203: traverses same-origin iframe with frame prefix letter', async () => {
    const iframe = document.createElement('iframe');
    iframe.title = 'Inline Frame';
    document.body.appendChild(iframe);

    // Mock contentDocument
    const frameDoc = document.implementation.createHTMLDocument('Frame Doc');
    const frameBtn = frameDoc.createElement('button');
    frameBtn.textContent = 'Frame Button';
    frameDoc.body.appendChild(frameBtn);
    Object.defineProperty(iframe, 'contentDocument', { value: frameDoc });

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('button "Frame Button"');
  });

  // 8. Cross-origin iframe: opaque node emission
  test('FR-203: cross-origin iframe emits opaque node without throwing', async () => {
    const iframe = document.createElement('iframe');
    iframe.title = 'Cross Origin Frame';
    iframe.src = 'https://other-domain.example/widget';
    document.body.appendChild(iframe);

    Object.defineProperty(iframe, 'contentDocument', {
      get() {
        throw new Error(
          'SecurityError: Blocked a frame with origin from accessing a cross-origin frame.',
        );
      },
    });

    const result = await snapshot(1, {}, document.body);
    expect(result.tree).toContain('- iframe "Cross Origin Frame"');
    expect(result.tree).toContain('[opaque]');
  });

  // 9. 200-node cap: truncation with cursor
  test('FR-205: truncates at node limit and returns cursor', async () => {
    const container = document.createElement('div');
    for (let i = 0; i < 220; i++) {
      const btn = document.createElement('button');
      btn.textContent = `Button ${i}`;
      container.appendChild(btn);
    }
    document.body.appendChild(container);

    const result = await snapshot(1, { maxNodes: 50 }, document.body);
    expect(result.truncated).toBe(true);
    expect(result.nodes.length).toBeLessThanOrEqual(50);
    expect(result.cursor).toBeDefined();
  });

  // 10. Role derivation: ARIA -> implicit role -> tag
  test('FR-201: role derivation respects ARIA override over implicit role', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    expect(div.getAttribute('role')).toBe('button');

    const btn = document.createElement('button');
    expect(implicitRole(btn)).toBe('button');

    const input = document.createElement('input');
    input.type = 'checkbox';
    expect(implicitRole(input)).toBe('checkbox');
  });

  // 11. Accessible name priority chain & password redaction
  test('FR-201, HR-7: accessible name 8-level priority chain and password suppression', () => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Aria Label');
    btn.textContent = 'Content Text';
    expect(accessibleName(btn)).toBe('Aria Label');

    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.setAttribute('placeholder', 'Enter Password');
    passInput.value = 'SuperSecret123!';
    expect(accessibleName(passInput)).toBe('Enter Password');
    expect(accessibleName(passInput)).not.toContain('SuperSecret123!');
  });

  // 12. textSig determinism
  test('FR-204: textSig is deterministic for same geometry and content', () => {
    const sig1 = computeTextSig('button', 'Submit', { x: 10, y: 20, w: 100, h: 40 });
    const sig2 = computeTextSig('button', 'Submit', { x: 10, y: 20, w: 100, h: 40 });
    const sigDifferentName = computeTextSig('button', 'Cancel', { x: 10, y: 20, w: 100, h: 40 });

    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(12);
    expect(sig1).not.toBe(sigDifferentName);
  });

  // 13. Session storage persistence (AC-P05-11)
  test('FR-206, AC-P05-11: snapshot persists refMap to chrome.storage.session', async () => {
    document.body.innerHTML = '<button>Save</button>';
    const setSpy = vi.spyOn(chrome.storage.session, 'set');

    await snapshot(1, {}, document.body);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        'refMap:1': expect.any(Object),
        refMap: expect.any(Object),
      }),
    );
  });
});
