import { NextRequest, NextResponse } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
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
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();
    const results: string[] = [];

    try { await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`); results.push('تم إضافة عمود grade'); } catch { console.warn('Column grade already exists'); results.push('عمود grade موجود'); }

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
      const prefix = grade.includes('الأول') ? '1' : grade.includes('الثاني') ? '2' : '3';
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const fullName = `${prefix}/${section}`;
        const existing = await db.prepare('SELECT id FROM classes WHERE class_name = ? AND grade = ?').get(fullName, grade) as any;
        if (!existing) {
          await db.prepare(
            'INSERT INTO classes (class_name, grade, section, room_number, capacity, status) VALUES (?, ?, ?, ?, 30, ?)'
          ).run(fullName, grade, section, String(roomStart + i), 'active');
          totalClasses++;
        }
      }
    }
    results.push(`تم إنشاء ${totalClasses} فصل`);

    // إنشاء معلمين للمتوسطة
    const middleFirstNames = ['أحمد', 'محمد', 'خالد', 'عبدالله', 'علي', 'إبراهيم', 'عمر', 'فهد', 'ياسر', 'ناصر', 'سامي', 'ماجد', 'هاني', 'وائل', 'طارق', 'بسام', 'رامي', 'زياد', 'حسام', 'وليد', 'مروان', 'أيمن', 'جابر', 'جمال', 'سعيد', 'كمال', 'ناصر', 'هشام', 'أيمن', 'لؤي'];
    const middleLastNames = ['السيد', 'القحطاني', 'الزهراني', 'الغامدي', 'العتيبي', 'المطيري', 'الشمري', 'الدوسري', 'الحربي', 'الجهني', 'الثقفي', 'القرني', 'الشهراني', 'العنزي', 'العازمي', 'المالكي', 'البقمي', 'السبيعي', 'الزهراني', 'الشمراني', 'الغامدي', 'الحربي', 'العتيبي', 'القرني', 'الدوسري', 'الجهني', 'الثقفي', 'المطيري', 'العنزي', 'الشهري'];
    let middleTeacherCount = 0;
    for (let i = 0; i < 30; i++) {
      const fname = middleFirstNames[i];
      const lname = middleLastNames[i];
      const tid = `T-MID-${String(i + 1).padStart(3, '0')}`;
      const email = `teacher.middle${i + 1}@school.com`;
      const existing = await db.prepare('SELECT id FROM teachers WHERE teacher_id = ?').get(tid) as any;
      if (!existing) {
        await db.prepare('INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?, ?, ?, ?, ?, ?)').run(tid, fname, lname, email, 'middle', 'active');
        middleTeacherCount++;
      }
    }
    results.push(`تم إنشاء ${middleTeacherCount} معلم للمتوسطة`);

    return NextResponse.json({ success: true, results });
  } catch (e) {
    console.error('Seed error:', e); return NextResponse.json({ success: false, error: 'فشلت عملية البذر' }, { status: 500 });
  }
}
