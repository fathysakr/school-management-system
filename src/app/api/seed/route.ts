import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized } from '@/lib/auth';

const HIGH_CLASSES = [
  { grade: 'الصف الأول الثانوي', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], roomStart: 101 },
  { grade: 'الصف الثاني الثانوي', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], roomStart: 201 },
  { grade: 'الصف الثالث الثانوي', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح'], roomStart: 301 },
];

const MIDDLE_CLASSES = [
  { grade: 'الصف الأول المتوسط', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], roomStart: 401 },
  { grade: 'الصف الثاني المتوسط', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], roomStart: 501 },
  { grade: 'الصف الثالث المتوسط', sections: ['أ', 'ب', 'ت', 'ث', 'ج', 'ح'], roomStart: 601 },
];

const GRADE_SUBJECTS: Record<string, string[]> = {
  'الصف الأول الثانوي': ['رياضيات', 'انجليزي', 'كفايات لغوية', 'علم بيئة', 'فيزياء', 'بدنية', 'نفسية', 'تقنية رقمية'],
  'الصف الثاني الثانوي': ['رياضيات', 'حديث', 'توحيد', 'كيمياء', 'أحياء', 'انجليزي', 'تقنية رقمية'],
  'الصف الثالث الثانوي': ['رياضيات', 'انجليزي', 'فيزياء', 'علم الأرض', 'المهارات الحياتية', 'الدراسات الادبية', 'الدراسات النفسية', 'فقه', 'جغرافيا', 'بدنية'],
  'الصف الأول المتوسط': ['رياضيات', 'علوم', 'انجليزي', 'لغة عربية', 'اجتماعيات', 'قرآن', 'توحيد', 'فقه', 'حديث', 'حاسب آلي', 'بدنية', 'فنية'],
  'الصف الثاني المتوسط': ['رياضيات', 'علوم', 'انجليزي', 'لغة عربية', 'اجتماعيات', 'قرآن', 'توحيد', 'فقه', 'حديث', 'حاسب آلي', 'بدنية', 'فنية'],
  'الصف الثالث المتوسط': ['رياضيات', 'علوم', 'انجليزي', 'لغة عربية', 'اجتماعيات', 'قرآن', 'توحيد', 'فقه', 'حديث', 'حاسب آلي', 'بدنية', 'فنية'],
};

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();
    const results: string[] = [];

    try { await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`); results.push('تم إضافة عمود grade'); } catch { results.push('عمود grade موجود'); }

    let totalSubjects = 0;
    await db.exec("DELETE FROM subjects WHERE grade IS NOT NULL");
    for (const [grade, subjects] of Object.entries(GRADE_SUBJECTS)) {
      const school = grade.includes('ثانوي') ? 'high' : 'middle';
      for (const name of subjects) {
        const existing = await db.prepare('SELECT id FROM subjects WHERE name = ? AND school = ? AND grade = ?').get(name, school, grade) as any;
        if (!existing) {
          await db.prepare('INSERT INTO subjects (name, school, sessions_per_week, grade) VALUES (?, ?, ?, ?)').run(name, school, 3, grade);
          totalSubjects++;
        }
      }
    }
    results.push(`تمت إضافة ${totalSubjects} مادة دراسية`);

    await db.exec("DELETE FROM classes WHERE grade LIKE '%ثانوي%' OR grade LIKE '%متوسط%'");
    results.push('تم حذف الفصول القديمة');

    let totalClasses = 0;
    for (const clsDef of [...HIGH_CLASSES, ...MIDDLE_CLASSES]) {
      const { grade, sections, roomStart } = clsDef;
      const school = grade.includes('ثانوي') ? 'high' : 'middle';
      let teacher = await db.prepare("SELECT id FROM teachers WHERE school = ? AND status = 'active' LIMIT 1").get(school) as any;
      if (!teacher) {
        const label = school === 'high' ? 'الثانوية' : 'المتوسطة';
        const email = school === 'high' ? 'high.sup@school.com' : 'middle.sup@school.com';
        const tr = await db.prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?, ?, ?, ?, ?, ?)").run(`T-${school.toUpperCase()}-001`, 'مشرف', `المرحلة ${label}`, email, school, 'active');
        teacher = { id: tr.lastInsertRowid };
      }
      const prefix = grade.includes('الأول') ? '1' : grade.includes('الثاني') ? '2' : '3';
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const fullName = `${prefix}/${section}`;
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
