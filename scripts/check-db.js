const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'school.db');
const db = new Database(dbPath);

const integrity = db.pragma('integrity_check');
console.log('Integrity:', JSON.stringify(integrity));

const fk = db.pragma('foreign_key_check');
console.log('Foreign keys:', fk.length === 0 ? 'OK - no violations' : JSON.stringify(fk));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

for (const t of tables) {
  if (t.name !== '_migrations' && t.name !== 'sqlite_sequence') {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
    console.log('  ' + t.name + ': ' + cnt.c + ' rows');
  }
}

const migrations = db.prepare('SELECT * FROM _migrations ORDER BY id').all();
console.log('Migrations:', migrations.map(m => m.name).join(', '));

const roles = db.prepare('SELECT DISTINCT role FROM users').all();
console.log('Roles:', roles.map(r => r.role).join(', '));
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
console.log('Users: ' + userCount.c);

db.close();
console.log('Database check complete');
