import { createClient } from '@libsql/client';

const db = createClient({
  url: 'https://school-db-fathysakr.aws-ap-south-1.turso.io',
  authToken: process.env.TURSO_DB_TOKEN || ''
});

async function main() {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      school TEXT NOT NULL CHECK (school IN ('middle', 'high')),
      sessions_per_week INTEGER NOT NULL DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const existing = await db.execute("SELECT COUNT(*) as cnt FROM subjects");
    if (existing.rows[0].cnt === 0) {
      await db.batch([
        "INSERT INTO subjects (name, school, sessions_per_week) VALUES ('القرآن', 'middle', 3), ('التوحيد', 'middle', 2), ('الفقه', 'middle', 2), ('الحديث', 'middle', 2), ('اللغة العربية', 'middle', 5), ('الرياضيات', 'middle', 5), ('العلوم', 'middle', 4), ('الاجتماعيات', 'middle', 3), ('اللغة الإنجليزية', 'middle', 4), ('الحاسب الآلي', 'middle', 2), ('التربية البدنية', 'middle', 2), ('التربية الفنية', 'middle', 2)",
        "INSERT INTO subjects (name, school, sessions_per_week) VALUES ('القرآن', 'high', 2), ('التوحيد', 'high', 2), ('الفقه', 'high', 2), ('الحديث', 'high', 1), ('اللغة العربية', 'high', 5), ('الرياضيات', 'high', 5), ('الفيزياء', 'high', 3), ('الكيمياء', 'high', 3), ('الأحياء', 'high', 3), ('اللغة الإنجليزية', 'high', 4), ('الحاسب الآلي', 'high', 2), ('التربية البدنية', 'high', 2), ('التربية الفنية', 'high', 1), ('الاجتماعيات', 'high', 2)"
      ]);
      console.log('Subjects seeded successfully');
    } else {
      console.log('Subjects already exist:', existing.rows[0].cnt);
    }

    const verify = await db.execute("SELECT * FROM subjects");
    console.log('Total subjects:', verify.rows.length);
    for (const r of verify.rows) {
      console.log(`  - ${r.name} (${r.school}) - ${r.sessions_per_week} جلسات/أسبوع`);
    }
  } catch(e) {
    console.error('Error:', e);
  }
}

main();
