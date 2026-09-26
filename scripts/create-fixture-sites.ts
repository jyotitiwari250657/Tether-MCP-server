// TRD §12.4: Generator for the 30-site fixture corpus
import * as fs from 'node:fs';
import * as path from 'node:path';

interface FixtureDef {
  name: string;
  title: string;
  html: string;
  expectedRefs: string[];
  nodeCount: number;
}

const SITES: FixtureDef[] = [
  // 1. Static
  {
    name: 'static-1',
    title: 'Static Article',
    html: `<header><h1>Welcome to Acme Docs</h1><nav><a href="#overview">Overview</a><a href="#details">Details</a></nav></header><main><p>This is a static article explaining system fundamentals.</p><button id="read-btn">Read More</button></main>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 14,
  },
  {
    name: 'static-2',
    title: 'CRM Dashboard',
    html: `<div class="crm-header"><h1>Pipeline Overview</h1><span class="badge">Q3</span></div><div class="metrics"><div class="card"><h3>Total Value</h3><p id="pipeline-val">$450,000</p></div><div class="card"><h3>Deals</h3><p id="deal-count">38</p></div></div><table><tr><th>Client</th><th>Stage</th></tr><tr><td>GlobalTech</td><td>Proposal</td></tr></table>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4', 'A5'],
    nodeCount: 22,
  },
  {
    name: 'static-3',
    title: 'Documentation Portal',
    html: `<aside><ul><li><a href="#intro">Introduction</a></li><li><a href="#api">API Reference</a></li><li><a href="#faq">FAQ</a></li></ul></aside><article><h2>Getting Started</h2><p>Install the SDK via package manager.</p><pre><code>npm install @acme/sdk</code></pre></article>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 18,
  },
  // 2. React SPA
  {
    name: 'react-router',
    title: 'React Router SPA',
    html: `<div id="root"><nav><button id="tab-home" onclick="document.getElementById('view').innerText='Home View'">Home</button><button id="tab-settings" onclick="document.getElementById('view').innerText='Settings View'">Settings</button></nav><div id="view">Home View</div></div>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 12,
  },
  {
    name: 'react-portal',
    title: 'React Portal Modal',
    html: `<div id="root"><button id="open-portal" onclick="document.getElementById('portal-root').style.display='block'">Open Modal</button></div><div id="portal-root" style="display:none;"><div class="modal"><p>Portal Dialog Content</p><button id="close-portal" onclick="document.getElementById('portal-root').style.display='none'">Close</button></div></div>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 15,
  },
  {
    name: 'react-strict',
    title: 'React Strict Mode Re-render',
    html: `<div id="root"><p id="counter">Count: 0</p><button id="inc" onclick="let c=document.getElementById('counter');c.innerText='Count: '+(parseInt(c.innerText.split(' ')[1])+1)">Increment</button></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 8,
  },
  // 3. Vue/Nuxt
  {
    name: 'vue-hydration',
    title: 'Vue Hydration Page',
    html: `<div id="app" data-server-rendered="true"><h1>Hydration Test</h1><p data-v-1234>Pre-rendered state</p><button id="hydrate-btn">Interactive</button></div><script>document.getElementById('app').removeAttribute('data-server-rendered');</script>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 10,
  },
  {
    name: 'nuxt-ssr',
    title: 'Nuxt SSR App',
    html: `<div id="__nuxt"><div id="__layout"><header><h1>Nuxt SSR Header</h1></header><main><p id="ssr-text">SSR Content Loaded</p></main></div></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 11,
  },
  {
    name: 'vue-composition',
    title: 'Vue Composition App',
    html: `<div id="app"><input id="item-input" placeholder="New item"/><button id="add-item" onclick="let li=document.createElement('li');li.innerText=document.getElementById('item-input').value;document.getElementById('list').appendChild(li);">Add</button><ul id="list"><li>Item 1</li></ul></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 16,
  },
  // 4. Shadow DOM
  {
    name: 'shadow-open',
    title: 'Open Shadow DOM',
    html: `<div><h1>Shadow Open</h1><custom-element id="host"></custom-element></div><script>const host=document.getElementById('host');const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<p id="shadow-text">Inside Shadow DOM</p><button id="shadow-btn">Shadow Action</button>';</script>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 12,
  },
  {
    name: 'shadow-closed',
    title: 'Closed Shadow DOM',
    html: `<div><h1>Shadow Closed</h1><custom-closed id="closed-host"></custom-closed></div><script>const host=document.getElementById('closed-host');const shadow=host.attachShadow({mode:'closed'});shadow.innerHTML='<p>Closed Content</p>';</script>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 9,
  },
  {
    name: 'shadow-nested',
    title: 'Nested Shadow DOM',
    html: `<div><h1>Nested Shadow</h1><outer-comp id="outer"></outer-comp></div><script>const outer=document.getElementById('outer');const s1=outer.attachShadow({mode:'open'});s1.innerHTML='<div id="inner-host"></div>';const s2=s1.getElementById('inner-host').attachShadow({mode:'open'});s2.innerHTML='<button id="deep-btn">Deep Button</button>';</script>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 11,
  },
  // 5. Same-origin iframe
  {
    name: 'iframe-simple',
    title: 'Simple Same-Origin Iframe',
    html: `<div><h1>Parent Frame</h1><iframe id="child-frame" srcdoc="<html><body><button id='iframe-btn'>Iframe Action</button></body></html>"></iframe></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 8,
  },
  {
    name: 'iframe-nested',
    title: 'Nested Same-Origin Iframe',
    html: `<div><h1>Root Frame</h1><iframe id="mid-frame" srcdoc="<html><body><iframe id='leaf-frame' srcdoc='<html><body><p>Deep Nested</p></body></html>'></iframe></body></html>"></iframe></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 8,
  },
  {
    name: 'iframe-dynamic',
    title: 'Dynamic Same-Origin Iframe',
    html: `<div><h1>Dynamic Frame</h1><button id="add-frame-btn" onclick="let f=document.createElement('iframe');f.srcdoc='<p>Created Frame</p>';document.body.appendChild(f);">Create</button></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 7,
  },
  // 6. Cross-origin iframe
  {
    name: 'xorigin-ads',
    title: 'Cross-Origin Ad Widget',
    html: `<div><h1>Publisher Site</h1><iframe id="ad-frame" sandbox="allow-scripts" srcdoc="<html><body><div id='ad'>Sponsored Content</div></body></html>"></iframe></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 7,
  },
  {
    name: 'xorigin-video',
    title: 'Cross-Origin Video Player',
    html: `<div><h1>Media Hub</h1><iframe id="video-frame" sandbox="allow-scripts" srcdoc="<html><body><p>Video Stream Opaque</p></body></html>"></iframe></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 7,
  },
  {
    name: 'xorigin-chat',
    title: 'Cross-Origin Chat Widget',
    html: `<div><h1>Main Store</h1><iframe id="chat-widget" sandbox="allow-scripts" srcdoc="<html><body><p>Support Chat</p></body></html>"></iframe></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 7,
  },
  // 7. Virtualized grid
  {
    name: 'virt-table',
    title: 'Virtualized Table',
    html: `<div id="table-container" style="height:300px;overflow:auto;"><div style="height:10000px;"><table id="grid"><tr><th>ID</th><th>Name</th></tr><tr><td>1</td><td>Row 1</td></tr><tr><td>2</td><td>Row 2</td></tr></table></div></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 16,
  },
  {
    name: 'virt-list',
    title: 'Virtualized List',
    html: `<div id="list-viewport" style="height:200px;overflow-y:scroll;"><ul id="virt-items"><li>Item 0</li><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 12,
  },
  {
    name: 'virt-canvas',
    title: 'Virtualized Canvas Grid',
    html: `<div><h1>Canvas Chart</h1><canvas id="chart" width="400" height="200"></canvas><p>Rendered on canvas</p></div>`,
    expectedRefs: ['A1', 'A2'],
    nodeCount: 6,
  },
  // 8. Modal-heavy checkout
  {
    name: 'checkout-consent',
    title: 'Checkout Cookie Consent',
    html: `<div id="page"><h2>Storefront</h2><button id="buy-btn">Buy Now</button></div><div id="consent-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);"><div class="box"><p>Accept all tracking cookies?</p><button id="accept-cookie" onclick="document.getElementById('consent-overlay').remove()">Accept All</button><button id="reject-cookie" onclick="document.getElementById('consent-overlay').remove()">Reject</button></div></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 18,
  },
  {
    name: 'checkout-cookie',
    title: 'Cookie Preferences Banner',
    html: `<div><h1>Site Content</h1></div><div id="banner"><p>We value your privacy</p><button id="manage-prefs">Manage Preferences</button><button id="dismiss-banner" onclick="this.parentElement.remove()">Dismiss</button></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 14,
  },
  {
    name: 'checkout-pay',
    title: 'Checkout Payment Modal',
    html: `<div><h1>Your Cart</h1><div id="modal"><form id="pay-form"><label>Card Number</label><input id="cc-num" type="text"/><label>CVV</label><input id="cc-cvv" type="password"/><button id="submit-pay" type="button">Pay $99</button></form></div></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 17,
  },
  // 9. Infinite scroll
  {
    name: 'feed-twitter',
    title: 'Social Feed',
    html: `<div id="feed"><div class="tweet" id="tweet-1"><p>First post in feed</p></div><div class="tweet" id="tweet-2"><p>Second post in feed</p></div></div><button id="load-more" onclick="let d=document.createElement('div');d.className='tweet';d.innerHTML='<p>Loaded Post</p>';document.getElementById('feed').appendChild(d);">Load More</button>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 15,
  },
  {
    name: 'feed-insta',
    title: 'Image Grid Feed',
    html: `<div id="grid" style="display:flex;"><div class="item">Photo 1</div><div class="item">Photo 2</div></div><button id="next-page" onclick="let d=document.createElement('div');d.className='item';d.innerText='Photo Next';document.getElementById('grid').appendChild(d);">Next</button>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 12,
  },
  {
    name: 'feed-news',
    title: 'News Feed Stream',
    html: `<div id="stream"><article><h2>Breaking News 1</h2><p>Article snippet 1</p></article><article><h2>Breaking News 2</h2><p>Article snippet 2</p></article></div><button id="stream-more">More News</button>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 14,
  },
  // 10. Credential forms
  {
    name: 'login-bank',
    title: 'Secure Banking Login',
    html: `<div><h2>Bank Vault Login</h2><form id="bank-form"><label for="bank-user">Account ID</label><input id="bank-user" type="text"/><label for="bank-pass">Secret Password</label><input id="bank-pass" type="password"/><label for="bank-pin">Security PIN</label><input id="bank-pin" type="password"/><button id="bank-login-btn" type="submit">Sign In</button></form></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4', 'A5'],
    nodeCount: 19,
  },
  {
    name: 'login-email',
    title: 'Email Account Login',
    html: `<div><h2>Sign In with Email</h2><form id="login-form"><label for="email">Email address</label><input id="email" type="email" placeholder="user@example.com"/><label for="password">Password</label><input id="password" type="password"/><button id="login-submit" type="submit">Log In</button></form></div>`,
    expectedRefs: ['A1', 'A2', 'A3', 'A4'],
    nodeCount: 16,
  },
  {
    name: 'login-otp',
    title: 'Two-Factor Authentication OTP',
    html: `<div><h2>Enter 6-Digit Code</h2><form id="otp-form"><input id="otp-code" type="text" maxlength="6" placeholder="000000"/><button id="verify-otp" type="submit">Verify Code</button></form></div>`,
    expectedRefs: ['A1', 'A2', 'A3'],
    nodeCount: 11,
  },
];

export function generateFixtureSites(baseDir: string): void {
  for (const site of SITES) {
    const siteDir = path.join(baseDir, site.name);
    fs.mkdirSync(siteDir, { recursive: true });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${site.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #1e293b; }
    button { cursor: pointer; padding: 6px 12px; margin: 4px; }
    input { padding: 6px; margin: 4px; }
  </style>
</head>
<body>
${site.html}
</body>
</html>
`;

    fs.writeFileSync(path.join(siteDir, 'index.html'), htmlContent, 'utf-8');

    const digest = {
      name: site.name,
      title: site.title,
      expectedRefs: site.expectedRefs,
      nodeCount: site.nodeCount,
      generatedAt: '2026-09-20T00:00:00.000Z',
    };
    fs.writeFileSync(
      path.join(siteDir, 'snapshot-digest.json'),
      JSON.stringify(digest, null, 2),
      'utf-8',
    );
  }
}

if (process.argv[1]?.endsWith('create-fixture-sites.ts')) {
  const targetDir = path.resolve(process.cwd(), 'tests/fixtures/sites');
  generateFixtureSites(targetDir);
  console.log(`Generated ${SITES.length} fixture sites in ${targetDir}`);
}
