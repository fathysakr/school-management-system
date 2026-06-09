import { NextRequest, NextResponse } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        school TEXT NOT NULL CHECK (school IN ('middle', 'high')),
        sessions_per_week INTEGER NOT NULL DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`); } catch {}
    try { await db.exec(`ALTER TABLE subjects ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL`); } catch {}

    await db.exec(`CREATE TABLE IF NOT EXISTS subject_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      sessions_per_week INTEGER NOT NULL DEFAULT 0,
      UNIQUE(subject_id, class_id)
    )`);

    const existing = await db.prepare("SELECT COUNT(*) as cnt FROM subjects").get();
    if ((existing as any).cnt === 0) {
      await db.exec(`
        INSERT INTO subjects (name, school, sessions_per_week) VALUES
          ('القرآن', 'middle', 3),
          ('التوحيد', 'middle', 2),
          ('الفقه', 'middle', 2),
          ('الحديث', 'middle', 2),
          ('اللغة العربية', 'middle', 5),
          ('الرياضيات', 'middle', 5),
          ('العلوم', 'middle', 4),
          ('الاجتماعيات', 'middle', 3),
          ('اللغة الإنجليزية', 'middle', 4),
          ('الحاسب الآلي', 'middle', 2),
          ('التربية البدنية', 'middle', 2),
          ('التربية الفنية', 'middle', 2);
      `);
      await db.exec(`
        INSERT INTO subjects (name, school, sessions_per_week) VALUES
          ('القرآن', 'high', 2),
          ('التوحيد', 'high', 2),
          ('الفقه', 'high', 2),
          ('الحديث', 'high', 1),
          ('اللغة العربية', 'high', 5),
          ('الرياضيات', 'high', 5),
          ('الفيزياء', 'high', 3),
          ('الكيمياء', 'high', 3),
          ('الأحياء', 'high', 3),
          ('اللغة الإنجليزية', 'high', 4),
          ('الحاسب الآلي', 'high', 2),
          ('التربية البدنية', 'high', 2),
          ('التربية الفنية', 'high', 1),
          ('الاجتماعيات', 'high', 2);
      `);
    }

    const verify = await db.prepare("SELECT COUNT(*) as cnt, school FROM subjects GROUP BY school").all();
    return NextResponse.json({ success: true, subjects: verify });
  } catch (err: unknown) {
    console.error('Migrate error:', err);
    return NextResponse.json({ error: 'فشلت عملية الترحيل' }, { status: 500 });
  }
}
