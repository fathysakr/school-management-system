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

    // تعيين معلمين للمواد الأساسية
    const highBaseSubs = ['القرآن', 'التوحيد', 'الفقه', 'الحديث', 'اللغة العربية', 'الرياضيات', 'الفيزياء', 'الكيمياء', 'الأحياء', 'اللغة الإنجليزية', 'الحاسب الآلي', 'التربية البدنية', 'التربية الفنية', 'الاجتماعيات'];
    const midBaseSubs = ['القرآن', 'التوحيد', 'الفقه', 'الحديث', 'اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنجليزية', 'الحاسب الآلي', 'التربية البدنية', 'التربية الفنية', 'الاجتماعيات'];
    const allHighT = await db.prepare("SELECT id FROM teachers WHERE school = 'high' AND status = 'active'").all() as any[];
    const allMidT = await db.prepare("SELECT id FROM teachers WHERE school = 'middle' AND status = 'active'").all() as any[];

    for (let i = 0; i < highBaseSubs.length; i++) {
      if (allHighT[i]) {
        await db.prepare('UPDATE subjects SET teacher_id = ? WHERE name = ? AND school = ? AND grade IS NULL').run(allHighT[i].id, highBaseSubs[i], 'high');
      }
    }
    for (let i = 0; i < midBaseSubs.length; i++) {
      if (allMidT[i]) {
        await db.prepare('UPDATE subjects SET teacher_id = ? WHERE name = ? AND school = ? AND grade IS NULL').run(allMidT[i].id, midBaseSubs[i], 'middle');
      }
    }
    results.push('تم تعيين معلمين للمواد الأساسية');

    // تعيين معلمين للمواد حسب الصف
    const gradeSubjectList = [
      { grade: 'الصف الأول الثانوي', subjects: ['رياضيات', 'انجليزي', 'كفايات لغوية', 'علم بيئة', 'فيزياء', 'بدنية', 'نفسية', 'تقنية رقمية'], start: 8 },
      { grade: 'الصف الثاني الثانوي', subjects: ['رياضيات', 'حديث', 'توحيد', 'كيمياء', 'أحياء', 'انجليزي', 'تقنية رقمية'], start: 8 },
      { grade: 'الصف الثالث الثانوي', subjects: ['رياضيات', 'انجليزي', 'فيزياء', 'علم الأرض', 'المهارات الحياتية', 'الدراسات الادبية', 'الدراسات النفسية', 'فقه', 'جغرافيا', 'بدنية'], start: 8 },
    ];
    for (const { subjects, start } of gradeSubjectList) {
      for (let i = 0; i < subjects.length; i++) {
        const tIdx = (start + i) % allHighT.length;
        if (allHighT[tIdx]) {
          await db.prepare('UPDATE subjects SET teacher_id = ? WHERE name = ? AND grade LIKE ?').run(allHighT[tIdx].id, subjects[i], '%ثانوي%');
        }
      }
    }
    results.push('تم تعيين معلمين لمواد الثانوي');
    const midGradeSubjectList = [
      { grade: 'الصف الأول المتوسط', subjects: ['رياضيات', 'علوم', 'انجليزي', 'لغة عربية', 'اجتماعيات', 'قرآن', 'توحيد', 'فقه', 'حديث', 'حاسب آلي', 'بدنية', 'فنية'], start: 0 },
      { grade: 'الصف الثاني المتوسط', subjects: ['رياضيات', 'علوم', 'انجليزي', 'لغة عربية', 'اجتماعيات', 'قرآن', 'توحيد', 'فقه', 'حديث', 'حاسب آلي', 'بدنية', 'فنية'], start: 12 },
      { grade: 'الصف الثالث المتوسط', subjects: ['رياضيات', 'علوم', 'انجليزي', 'لغة عربية', 'اجتماعيات', 'قرآن', 'توحيد', 'فقه', 'حديث', 'حاسب آلي', 'بدنية', 'فنية'], start: 24 },
    ];
    for (const { subjects, start } of midGradeSubjectList) {
      for (let i = 0; i < subjects.length; i++) {
        const tIdx = (start + i) % allMidT.length;
        await db.prepare('UPDATE subjects SET teacher_id = ? WHERE name = ? AND grade LIKE ?').run(allMidT[tIdx].id, subjects[i], '%متوسط%');
      }
    }
    results.push('تم تعيين معلمين لمواد المتوسطة');

    // تعيين تخصصات للمعلمين (specialization) لتوليد الجدول
    const allTeachers = await db.prepare("SELECT id, school FROM teachers WHERE status = 'active'").all() as any[];
    for (const t of allTeachers) {
      const assigned = await db.prepare("SELECT name, sessions_per_week FROM subjects WHERE teacher_id = ? AND grade IS NULL").all(t.id) as any[];
      const gradeAssigned = await db.prepare("SELECT name, grade, sessions_per_week FROM subjects WHERE teacher_id = ? AND grade IS NOT NULL").all(t.id) as any[];
      if (assigned.length > 0 || gradeAssigned.length > 0) {
        const spec: any[] = [];
        for (const sub of assigned) {
          spec.push({ n: sub.name, s: sub.sessions_per_week || 3 });
        }
        // تجميع المواد حسب الاسم للصفوف المختلفة
        const gradeMap: Record<string, { n: string; s: number; classes: number[] }> = {};
        for (const gs of gradeAssigned) {
          const cls = await db.prepare("SELECT id FROM classes WHERE grade = ? AND status = 'active'").all(gs.grade) as any[];
          const key = gs.name;
          if (!gradeMap[key]) gradeMap[key] = { n: key, s: gs.sessions_per_week || 3, classes: [] };
          for (const c of cls) {
            if (!gradeMap[key].classes.includes(c.id)) gradeMap[key].classes.push(c.id);
          }
        }
        for (const g of Object.values(gradeMap)) {
          spec.push(g);
        }
        if (spec.length > 0) {
          await db.prepare('UPDATE teachers SET specialization = ? WHERE id = ?').run(JSON.stringify(spec), t.id);
        }
      }
    }
    results.push('تم تعيين التخصصات للمعلمين');

    return NextResponse.json({ success: true, results });
  } catch {
    return NextResponse.json({ success: false, error: 'فشلت عملية البذر' }, { status: 500 });
  }
}
