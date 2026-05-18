import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, serverError } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

const HIGH_CLASSES = [
  { grade: 'أول ثانوي', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], roomStart: 101 },
  { grade: 'ثاني ثانوي', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], roomStart: 201 },
  { grade: 'ثالث ثانوي', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح'], roomStart: 301 },
];

const GRADE_SUBJECTS: Record<string, string[]> = {
  'أول ثانوي': ['رياضيات', 'انجليزي', 'كفايات لغوية', 'علم بيئة', 'فيزياء', 'بدنية', 'نفسية', 'تقنية رقمية'],
  'ثاني ثانوي': ['رياضيات', 'حديث', 'توحيد', 'كيمياء', 'أحياء', 'انجليزي', 'تقنية رقمية'],
  'ثالث ثانوي': ['رياضيات', 'انجليزي', 'فيزياء', 'علم الأرض', 'المهارات الحياتية', 'الدراسات الادبية', 'الدراسات النفسية', 'فقه', 'جغرافيا', 'بدنية'],
};

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'admin')) return unauthorized();
    const results: string[] = [];

    try { await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`); results.push('تم إضافة عمود grade'); } catch { results.push('عمود grade موجود'); }

    let totalSubjects = 0;
    for (const [grade, subjects] of Object.entries(GRADE_SUBJECTS)) {
      for (const name of subjects) {
        const existing = await db.prepare('SELECT id FROM subjects WHERE name = ? AND school = ? AND grade = ?').get(name, 'high', grade) as any;
        if (!existing) {
          await db.prepare('INSERT INTO subjects (name, school, sessions_per_week, grade) VALUES (?, ?, ?, ?)').run(name, 'high', 3, grade);
          totalSubjects++;
        }
      }
    }
    results.push(`تمت إضافة ${totalSubjects} مادة دراسية`);

    let teacher = await db.prepare("SELECT id FROM teachers WHERE school = 'high' AND status = 'active' LIMIT 1").get() as any;
    if (!teacher) {
      const tr = await db.prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?, ?, ?, ?, ?, ?)").run('T-HIGH-001', 'مشرف', 'المرحلة الثانوية', 'high.sup@school.com', 'high', 'active');
      teacher = { id: tr.lastInsertRowid };
      results.push('تم إنشاء معلم');
    }

    let totalClasses = 0;
    for (const { grade, sections, roomStart } of HIGH_CLASSES) {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const fullName = `${grade === 'أول ثانوي' ? '1' : grade === 'ثاني ثانوي' ? '2' : '3'}/${section}`;
        const existing = await db.prepare('SELECT id FROM classes WHERE class_name = ? AND grade = ?').get(fullName, grade) as any;
        if (!existing) {
          await db.prepare(
            'INSERT INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status) VALUES (?, ?, ?, ?, ?, 30, ?)'
          ).run(fullName, grade, section, teacher.id, String(roomStart + i), 'active');
          totalClasses++;
        }
      }
    }
    results.push(`تم إنشاء ${totalClasses} فصل`);

    return Response.json({ success: true, results });
  } catch (error: any) {
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
