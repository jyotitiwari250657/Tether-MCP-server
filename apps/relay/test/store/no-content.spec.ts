import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_COLUMN_SUBSTRINGS, STORE_SCHEMA_ALLOWLIST } from '../../src/store/allowlist.js';

// PRD HR-7, SEC-06, PRV-04: Zero plaintext at rest schema validation
describe('PRD HR-7 / SEC-06 Zero Plaintext At Rest Schema Validation', () => {
  const schemaPath = resolve(__dirname, '../../src/store/schema.sql');
  const migrationPath = resolve(__dirname, '../../migrations/0001_init.sql');

  const checkSchemaContent = (sql: string, filename: string) => {
    const lines = sql.split('\n');
    let currentTable = '';

    for (const line of lines) {
      const tableMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (tableMatch?.[1]) {
        currentTable = tableMatch[1];
      }

      // Column definition lines inside CREATE TABLE
      const colMatch = line.trim().match(/^([a-zA-Z0-9_]+)\s+[A-Z]+/);
      if (colMatch?.[1] && currentTable) {
        const colName = colMatch[1].toLowerCase();
        const fullIdentifier = `${currentTable}.${colName}`;

        for (const forbidden of FORBIDDEN_COLUMN_SUBSTRINGS) {
          if (colName.includes(forbidden)) {
            const isAllowed = STORE_SCHEMA_ALLOWLIST.includes(fullIdentifier);
            expect(
              isAllowed,
              `Forbidden column "${colName}" in table "${currentTable}" in ${filename} is not in STORE_SCHEMA_ALLOWLIST`,
            ).toBe(true);
          }
        }
      }
    }
  };

  it('validates src/store/schema.sql has no unauthorized plaintext columns', () => {
    const sql = readFileSync(schemaPath, 'utf8');
    checkSchemaContent(sql, 'schema.sql');
  });

  it('validates migrations/0001_init.sql has no unauthorized plaintext columns', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    checkSchemaContent(sql, '0001_init.sql');
  });

  it('verifies audit_meta only stores hash and seq, not body or content', () => {
    const sql = readFileSync(schemaPath, 'utf8');
    expect(sql).toContain('hash TEXT NOT NULL');
    expect(sql).toContain('prev_hash TEXT NOT NULL');
    expect(sql).not.toMatch(/audit_meta[\s\S]*?(?:payload_text|entry_json|content|body)/i);
  });

  it('verifies tokens only stores refresh_hash, never raw token', () => {
    const sql = readFileSync(schemaPath, 'utf8');
    expect(sql).toContain('refresh_hash TEXT NOT NULL');
    expect(sql).not.toMatch(/tokens[\s\S]*?(?:refresh_token\s+TEXT|raw_token)/i);
  });
});
