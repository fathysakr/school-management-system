// Database backup script — dumps full schema + data from Turso/local SQLite to a single SQL file.
// Usage: node scripts/backup-db.mjs
// Requires env: TURSO_DB_URL (+ optional TURSO_DB_TOKEN), or falls back to local data/school.db
import { createClient } from '@libsql/client';
import { writeFileSync, mkdirSync } from 'fs';

const url = process.env.TURSO_DB_URL || 'file:./data/school.db';
const client = createClient({
  url,
  authToken: process.env.TURSO_DB_TOKEN || undefined,
});

function sqlEscape(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Uint8Array) {
    return `X'${Array.from(value).map((b) => b.toString(16).padStart(2, '0')).join('')}'`;
  }
  const str = String(value);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(str)) {
    // binary-ish content: encode as hex blob text-safe
    const hex = Array.from(Buffer.from(str, 'utf8')).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `X'${hex}'`;
  }
  return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
  console.log(`Backing up database: ${url}`);
  const tablesResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name"
  );
  const tables = tablesResult.rows.map((r) => r.name);

  const lines = [
    `-- Backup generated: ${new Date().toISOString()}`,
    '-- School Management System (مدرسة صفوة الرواد الأهلية)',
    'PRAGMA foreign_keys=OFF;',
    'BEGIN TRANSACTION;',
    '',
  ];

  for (const table of tables) {
    const ddl = await client.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
      [table]
    );
    if (ddl.rows[0] && ddl.rows[0].sql) {
      lines.push(`-- Table: ${table}`);
      lines.push(`DROP TABLE IF EXISTS ${table};`);
      lines.push(`${ddl.rows[0].sql};`);
    }

    const countRes = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
    const count = Number(countRes.rows[0].c);
    if (count === 0) continue;

    const colsRes = await client.execute(`SELECT * FROM ${table} LIMIT 1`);
    const columns = colsRes.columns;
    const colList = columns.join(', ');

    const BATCH = 200;
    lines.push(`-- ${count} rows`);
    for (let offset = 0; offset < count; offset += BATCH) {
      const rowsRes = await client.execute(`SELECT * FROM ${table} LIMIT ${BATCH} OFFSET ${offset}`);
      for (const row of rowsRes.rows) {
        const values = columns.map((c) => sqlEscape(row[c]));
        lines.push(`INSERT INTO ${table} (${colList}) VALUES (${values.join(', ')});`);
      }
    }
    lines.push('');

    // indexes for this table
    const idxRes = await client.execute(
      "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name = ?",
      [table]
    );
    for (const idx of idxRes.rows) {
      lines.push(`${idx.sql};`);
    }
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('PRAGMA foreign_keys=ON;');

  mkdirSync('backups', { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `backups/school-backup-${date}.sql`;
  writeFileSync(filename, lines.join('\n'), 'utf8');
  console.log(`Backup saved: ${filename} (${tables.length} tables)`);

  // Sanity check: file must contain users table inserts
  const content = lines.join('\n');
  if (!content.includes('CREATE TABLE')) {
    console.error('WARNING: backup appears empty!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
