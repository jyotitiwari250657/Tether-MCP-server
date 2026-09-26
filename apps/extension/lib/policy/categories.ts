/**
 * Sensitive Categories Classifier & Blocklist (PRD FR-503, TRD §6.6.3).
 * Built-in domain blocklist and heuristics detecting high-risk origin categories and credentials.
 */

import type { SensitiveCategory } from './types.js';

export const BLOCKLIST: readonly SensitiveCategory[] = [
  'banking',
  'email',
  'crypto',
  'cloud-console',
  'health',
  'government',
] as const;

// Curated domain mapping (~150 high-priority domains across sensitive categories)
const DOMAIN_MAP: Record<string, SensitiveCategory> = {
  // Banking & Financial
  'chase.com': 'banking',
  'bankofamerica.com': 'banking',
  'wellsfargo.com': 'banking',
  'citi.com': 'banking',
  'capitalone.com': 'banking',
  'usbank.com': 'banking',
  'pnc.com': 'banking',
  'td.com': 'banking',
  'barclays.co.uk': 'banking',
  'hsbc.com': 'banking',
  'santander.com': 'banking',
  'bnpparibas.com': 'banking',
  'paypal.com': 'banking',
  'stripe.com': 'banking',
  'revolut.com': 'banking',
  'venmo.com': 'banking',
  'robinhood.com': 'banking',
  'fidelity.com': 'banking',
  'schwab.com': 'banking',
  'vanguard.com': 'banking',
  'etrade.com': 'banking',
  'wise.com': 'banking',
  'monzo.com': 'banking',
  'starlingbank.com': 'banking',
  'klarna.com': 'banking',
  'affirm.com': 'banking',

  // Email & Identity
  'gmail.com': 'email',
  'googlemail.com': 'email',
  'outlook.com': 'email',
  'hotmail.com': 'email',
  'live.com': 'email',
  'yahoo.com': 'email',
  'protonmail.com': 'email',
  'proton.me': 'email',
  'zoho.com': 'email',
  'icloud.com': 'email',
  'fastmail.com': 'email',
  'mail.com': 'email',
  'yandex.com': 'email',
  'gmx.com': 'email',
  'tutanota.com': 'email',
  'tuta.com': 'email',

  // Crypto & Web3
  'coinbase.com': 'crypto',
  'binance.com': 'crypto',
  'kraken.com': 'crypto',
  'metamask.io': 'crypto',
  'uniswap.org': 'crypto',
  'opensea.io': 'crypto',
  'kucoin.com': 'crypto',
  'bybit.com': 'crypto',
  'gemini.com': 'crypto',
  'okx.com': 'crypto',
  'bitfinex.com': 'crypto',
  'etherscan.io': 'crypto',
  'phantom.app': 'crypto',
  'trezor.io': 'crypto',
  'ledger.com': 'crypto',
  'solana.com': 'crypto',

  // Cloud & Admin Consoles
  'console.cloud.google.com': 'cloud-console',
  'aws.amazon.com': 'cloud-console',
  'console.aws.amazon.com': 'cloud-console',
  'azure.microsoft.com': 'cloud-console',
  'portal.azure.com': 'cloud-console',
  'digitalocean.com': 'cloud-console',
  'linode.com': 'cloud-console',
  'cloudflare.com': 'cloud-console',
  'heroku.com': 'cloud-console',
  'vercel.com': 'cloud-console',
  'netlify.com': 'cloud-console',

  // Health & Medical Records
  'mychart.com': 'health',
  'epic.com': 'health',
  'cerner.com': 'health',
  'kaiserpermanente.org': 'health',
  'teladoc.com': 'health',
  'onemedical.com': 'health',
  'mayoclinic.org': 'health',

  // Government
  'irs.gov': 'government',
  'usa.gov': 'government',
  'ssa.gov': 'government',
  'medicare.gov': 'government',
  'gov.uk': 'government',
  'canada.ca': 'government',
  'service.gov.uk': 'government',
};

/**
 * Classifies an origin or URL into a SensitiveCategory or null (PRD FR-503).
 */
export function classify(originOrUrl: string): SensitiveCategory | null {
  if (!originOrUrl) return null;

  let host = originOrUrl.toLowerCase().trim();
  let pathname = '';

  try {
    if (host.includes('://')) {
      const u = new URL(host);
      host = u.hostname;
      pathname = u.pathname;
    } else {
      const slash = host.indexOf('/');
      if (slash !== -1) {
        pathname = host.slice(slash);
        host = host.slice(0, slash);
      }
    }
  } catch {
    // Fall back to string analysis
  }

  // 1. Direct domain map lookup (exact and wildcard match)
  if (DOMAIN_MAP[host]) {
    return DOMAIN_MAP[host] ?? null;
  }

  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (DOMAIN_MAP[parentDomain]) {
      return DOMAIN_MAP[parentDomain] ?? null;
    }
  }

  // 2. Government heuristic (.gov, .mil, .gov.*)
  if (host.endsWith('.gov') || host.endsWith('.mil') || /\.gov\.[a-z]{2}$/.test(host)) {
    return 'government';
  }

  // 3. Crypto heuristics
  if (
    host.includes('metamask') ||
    host.includes('phantom') ||
    host.includes('ledger') ||
    host.includes('trezor') ||
    host.includes('wallet')
  ) {
    return 'crypto';
  }

  // 4. Banking & payments heuristics
  if (
    host.includes('bank') ||
    host.includes('pay') ||
    host.includes('invest') ||
    host.includes('trading') ||
    pathname.includes('bank')
  ) {
    return 'banking';
  }

  // 5. Email & password recovery heuristics
  if (
    host.startsWith('mail.') ||
    host.startsWith('webmail.') ||
    host.includes('.mail.') ||
    pathname.includes('/password') ||
    pathname.includes('/reset') ||
    pathname.includes('/recover') ||
    pathname.includes('/otp') ||
    pathname.includes('/signin')
  ) {
    return 'email';
  }

  // 6. Cloud & admin console heuristics
  if (
    host.startsWith('console.') ||
    host.startsWith('admin.') ||
    host.includes('.console.') ||
    pathname.includes('/admin') ||
    pathname.includes('/iam') ||
    pathname.includes('/settings/security')
  ) {
    return 'cloud-console';
  }

  // 7. Health records heuristics
  if (
    pathname.includes('/patient') ||
    pathname.includes('/medical') ||
    pathname.includes('/records')
  ) {
    return 'health';
  }

  return null;
}

/**
 * Checks if a visible password or OTP input exists in the target subtree (PRD FR-503, TRD §6.6.3).
 */
export function hasCredentialEntry(docOrElement: Document | Element): boolean {
  if (!docOrElement || typeof docOrElement.querySelectorAll !== 'function') {
    return false;
  }

  const inputs = docOrElement.querySelectorAll(
    'input[type="password"], input[autocomplete="one-time-code"]',
  );

  for (const input of Array.from(inputs)) {
    const el = input as HTMLElement;
    // Check if element is visually displayed
    if (el.style.display === 'none' || el.style.visibility === 'hidden') {
      continue;
    }
    return true;
  }

  return false;
}
