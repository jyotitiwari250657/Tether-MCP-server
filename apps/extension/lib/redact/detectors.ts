/**
 * Sensitive Data Detectors (PRD FR-509, HR-7, TRD §6.7).
 * Pattern detectors for PAN, Email, Phone, IBAN, Bearer/JWT, API Keys, and Private Keys.
 */

export interface RedactionHit {
  kind: string;
  start: number;
  end: number;
  replacement: string;
}

export function isLuhnValid(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number.parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function getCardBrand(digits: string): string {
  if (digits.startsWith('4')) return 'visa';
  if (
    /^5[1-5]/.test(digits) ||
    /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[0-1][0-9]|720)/.test(digits)
  ) {
    return 'mastercard';
  }
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^6(011|5)/.test(digits)) return 'discover';
  return 'card';
}

export function detect(text: string): RedactionHit[] {
  if (!text) return [];

  const hits: RedactionHit[] = [];

  // 1. Private Key Blocks
  const privKeyRe = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
  let match: RegExpExecArray | null = privKeyRe.exec(text);
  while (match !== null) {
    hits.push({
      kind: 'PRIVATEKEY',
      start: match.index,
      end: match.index + match[0].length,
      replacement: '⟨PRIVATEKEY⟩',
    });
    match = privKeyRe.exec(text);
  }

  // 2. Bearer / JWT tokens
  const bearerRe = /\bBearer\s+([A-Za-z0-9_\-\.~+/]+=*)/gi;
  match = bearerRe.exec(text);
  while (match !== null) {
    hits.push({
      kind: 'TOKEN',
      start: match.index,
      end: match.index + match[0].length,
      replacement: '⟨TOKEN⟩',
    });
    match = bearerRe.exec(text);
  }

  const jwtRe = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
  match = jwtRe.exec(text);
  while (match !== null) {
    hits.push({
      kind: 'TOKEN',
      start: match.index,
      end: match.index + match[0].length,
      replacement: '⟨TOKEN⟩',
    });
    match = jwtRe.exec(text);
  }

  // 3. API Key shapes: (sk|pk|ghp|gho|xox[baprs]|AKIA|AIza)[-_A-Za-z0-9]{16,}
  const apiKeyRe = /\b((?:sk|pk|ghp|gho|xox[baprs]|AKIA|AIza)[-_A-Za-z0-9]{16,})\b/g;
  match = apiKeyRe.exec(text);
  while (match !== null) {
    const raw = match[1] ?? '';
    const prefix = raw.split('_')[0] ?? raw.slice(0, 4);
    hits.push({
      kind: 'APIKEY',
      start: match.index,
      end: match.index + match[0].length,
      replacement: `⟨APIKEY:${prefix}⟩`,
    });
    match = apiKeyRe.exec(text);
  }

  // 4. IBAN: 2 letters + 2 digits + up to 30 alnum (min 15 chars)
  const ibanRe = /\b([A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})\b/g;
  match = ibanRe.exec(text);
  while (match !== null) {
    hits.push({
      kind: 'IBAN',
      start: match.index,
      end: match.index + match[0].length,
      replacement: '⟨IBAN:••••⟩',
    });
    match = ibanRe.exec(text);
  }

  // 5. PAN: 13-19 digit runs with optional spaces/dashes, Luhn-valid
  const panRe = /\b(?:\d[ -]*?){13,19}\b/g;
  match = panRe.exec(text);
  while (match !== null) {
    const raw = match[0];
    const digits = raw.replace(/[\s-]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && isLuhnValid(digits)) {
      const brand = getCardBrand(digits);
      const last4 = digits.slice(-4);
      hits.push({
        kind: 'PAN',
        start: match.index,
        end: match.index + raw.length,
        replacement: `⟨PAN:${brand}••••${last4}⟩`,
      });
    }
    match = panRe.exec(text);
  }

  // 6. Email: RFC-5322-lite
  const emailRe = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  match = emailRe.exec(text);
  while (match !== null) {
    const user = match[1] ?? '';
    const domain = match[2] ?? '';
    const firstChar = user.charAt(0);
    hits.push({
      kind: 'EMAIL',
      start: match.index,
      end: match.index + match[0].length,
      replacement: `⟨EMAIL:${firstChar}•••@${domain}⟩`,
    });
    match = emailRe.exec(text);
  }

  // 7. Phone: E.164 and international/national phone numbers
  const phoneRe = /(?:\+?(\d{1,3}))?[-.\s]?(?:\(?(\d{3})\)?)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g;
  match = phoneRe.exec(text);
  while (match !== null) {
    const raw = match[0].trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      const last4 = digits.slice(-4);
      hits.push({
        kind: 'PHONE',
        start: match.index,
        end: match.index + match[0].length,
        replacement: `⟨PHONE:•••${last4}⟩`,
      });
    }
    match = phoneRe.exec(text);
  }

  // Sort hits by start ascending; discard overlapping spans
  hits.sort((a, b) => a.start - b.start);
  const nonOverlapping: RedactionHit[] = [];
  let lastEnd = -1;

  for (const h of hits) {
    if (h.start >= lastEnd) {
      nonOverlapping.push(h);
      lastEnd = h.end;
    }
  }

  return nonOverlapping;
}
