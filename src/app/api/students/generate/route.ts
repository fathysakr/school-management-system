import { NextRequest, NextResponse } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

const FIRST_NAMES = ['أحمد', 'محمد', 'عبدالله', 'عمر', 'خالد', 'فيصل', 'نواف', 'عبدالعزيز', 'سعود', 'ماجد', 'بدر', 'تركي', 'فهد', 'سلطان', 'نايف', 'مشعل', 'عبدالرحمن', 'راشد', 'سعد', 'إبراهيم'];
const LAST_NAMES = ['القحطاني', 'الدوسري', 'الغامدي', 'العتيبي', 'المطيري', 'الزهراني', 'الشهري', 'العنزي', 'الحربي', 'الجهني', 'الشمري', 'الخالدي', 'الظفيري', 'السبيعي', 'البلوي', 'الثقفي', 'البقمي', 'الهاجري', 'القرني', 'الغامدي'];

export async function POST(req: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!hasPermission(user.role, 'students:create')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 });

    const body = await req.json();
    const count = Math.min(200, Math.max(1, parseInt(body.count) || 30));
    const school = body.school || 'all';

    const classes = await db.prepare(
      school === 'all'
        ? "SELECT id, class_name, grade FROM classes WHERE status = 'active'"
        : "SELECT id, class_name, grade FROM classes WHERE status = 'active' AND grade LIKE ?"
    ).all(...(school === 'all' ? [] : [`%${school === 'middle' ? 'متوسط' : 'ثانوي'}%`])) as any[];

    const created: number[] = [];
    const ts = Date.now();

    for (let i = 0; i < count; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const sid = `STU${ts}${i}`;
      const cls = classes.length > 0 ? classes[Math.floor(Math.random() * classes.length)] : null;
      const schoolStage = cls ? (cls.grade?.includes('متوسط') ? 'middle' : 'high') : (school === 'all' ? (i % 2 === 0 ? 'middle' : 'high') : school);

      const dob = new Date(Date.now() - (14 + Math.floor(Math.random() * 4)) * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = await db.prepare(
        `INSERT INTO students (student_id, first_name, last_name, date_of_birth, email, phone, school, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(sid, firstName, lastName, dob, `${sid}@example.com`, `05${Math.floor(10000000 + Math.random() * 90000000)}`, schoolStage);
      const studentId = result.lastInsertRowid as number;

      if (cls && studentId) {
        const existing = await db.prepare(
          'SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = ?'
        ).get(studentId, cls.id, 'active') as any;
        if (!existing) {
          await db.prepare(
            "INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, date('now'), 'active')"
          ).run(studentId, cls.id);
        }
      }
      created.push(studentId as number);
    }

    return NextResponse.json({ success: true, created: created.length, count, message: `تم إنشاء ${created.length} طالب` });
  } catch (e) {
    console.error('Generate students error:', e); return NextResponse.json({ error: 'فشل إنشاء الطلاب' }, { status: 500 });
  }
}
