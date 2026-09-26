// PRD PRV-03 / TRD Appendix B: Forbidden column name exceptions with justifications.
// Any column named 'url', 'body', 'content', 'args', 'value', 'secret', 'html', 'text'
// is rejected by CI (scripts/check-store-schema.mjs) unless justified here.

export interface AllowlistEntry {
  column: string;
  table: string;
  justification: string;
}

export const FORBIDDEN_COLUMN_SUBSTRINGS = [
  'url',
  'body',
  'content',
  'args',
  'value',
  'secret',
  'html',
  'text',
] as const;

// Zero plaintext at rest: currently zero forbidden columns are permitted or needed.
export const ALLOWED_SENSITIVE_COLUMNS: readonly AllowlistEntry[] = [];

export const STORE_SCHEMA_ALLOWLIST: readonly string[] = ALLOWED_SENSITIVE_COLUMNS.map(
  (e) => `${e.table}.${e.column}`,
);
