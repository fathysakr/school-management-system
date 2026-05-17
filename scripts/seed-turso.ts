import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const url = process.env.TURSO_DB_URL;
const token = process.env.TURSO_DB_TOKEN;

if (!url || !token) { console.error('Set TURSO_DB_URL and TURSO_DB_TOKEN'); process.exit(1); }

const db = createClient({ url, authToken: token });
const sql = (q: string, a: any[] = []) => db.execute({ sql: q, args: a });

async function seed() {
  console.log('Seeding data...');
  const hash = (p: string) => bcrypt.hash(p, 10);

  // --- USERS ---
  const users = [
    { email: 'admin@school.com', password: await hash('admin123'), role: 'admin' },
    { email: 'middle.sup@school.com', password: await hash('sup123'), role: 'middle_supervisor' },
    { email: 'high.sup@school.com', password: await hash('sup123'), role: 'high_supervisor' },
    { email: 'm.teacher1@school.com', password: await hash('teacher123'), role: 'middle_teacher' },
    { email: 'm.teacher2@school.com', password: await hash('teacher123'), role: 'middle_teacher' },
    { email: 'h.teacher1@school.com', password: await hash('teacher123'), role: 'high_teacher' },
    { email: 'h.teacher2@school.com', password: await hash('teacher123'), role: 'high_teacher' },
    { email: 'm.counselor@school.com', password: await hash('counselor123'), role: 'middle_counselor' },
    { email: 'h.counselor@school.com', password: await hash('counselor123'), role: 'high_counselor' },
    { email: 'm.principal@school.com', password: await hash('principal123'), role: 'middle_principal' },
    { email: 'h.principal@school.com', password: await hash('principal123'), role: 'high_principal' },
  ];
  for (const u of users) {
    const exist = await sql('SELECT id FROM users WHERE email = ?', [u.email]);
    if (exist.rows.length === 0) {
      await sql("INSERT INTO users (email, password, role, status) VALUES (?, ?, ?, 'active')", [u.email, u.password, u.role]);
      console.log(`  User: ${u.email} / ${u.role}`);
    }
  }

  // --- TEACHERS ---
  const teachers = [
    { tid: 'TCH001', first: 'أحمد', last: 'السعيد', spec: 'رياضيات', school: 'middle', email: 'ahmed@school.com', phone: '0123456789' },
    { tid: 'TCH002', first: 'محمد', last: 'علي', spec: 'علوم', school: 'middle', email: 'mohamed@school.com', phone: '0123456790' },
    { tid: 'TCH003', first: 'سارة', last: 'خالد', spec: 'لغة عربية', school: 'high', email: 'sara@school.com', phone: '0123456791' },
    { tid: 'TCH004', first: 'نورة', last: 'عبدالله', spec: 'لغة إنجليزية', school: 'high', email: 'noura@school.com', phone: '0123456792' },
  ];
  for (const t of teachers) {
    const exist = await sql('SELECT id FROM teachers WHERE teacher_id = ?', [t.tid]);
    if (exist.rows.length === 0) {
      await sql("INSERT INTO teachers (teacher_id, first_name, last_name, email, phone, specialization, school, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
        [t.tid, t.first, t.last, t.email, t.phone, t.spec, t.school]);
      console.log(`  Teacher: ${t.first} ${t.last} (${t.school})`);
    }
  }

  // --- CLASSES ---
  const classes = [
    { name: 'الأول المتوسط', grade: 'المتوسطة', section: 'أ', teacher: 'TCH001' },
    { name: 'الأول المتوسط', grade: 'المتوسطة', section: 'ب', teacher: 'TCH002' },
    { name: 'الثاني المتوسط', grade: 'المتوسطة', section: 'أ', teacher: 'TCH001' },
    { name: 'الأول الثانوي', grade: 'الثانوية', section: 'أ', teacher: 'TCH003' },
    { name: 'الأول الثانوي', grade: 'الثانوية', section: 'ب', teacher: 'TCH004' },
    { name: 'الثاني الثانوي', grade: 'الثانوية', section: 'أ', teacher: 'TCH003' },
  ];
  const classIds: any[] = [];
  for (const c of classes) {
    const exist = await sql('SELECT id FROM classes WHERE class_name = ? AND grade = ? AND section = ?', [c.name, c.grade, c.section]);
    if (exist.rows.length === 0) {
      const t = await sql('SELECT id FROM teachers WHERE teacher_id = ?', [c.teacher]);
      if (t.rows.length > 0) {
        const r = await sql("INSERT INTO classes (class_name, grade, section, teacher_id, capacity, status) VALUES (?, ?, ?, ?, 30, 'active')",
          [c.name, c.grade, c.section, t.rows[0].id]);
        classIds.push(r.lastInsertRowid);
        console.log(`  Class: ${c.name} ${c.section} (${c.grade})`);
      }
    }
  }

  // Get actual class IDs
  const classRows = await sql('SELECT id, class_name, grade FROM classes');
  const classList = classRows.rows;

  // --- STUDENTS ---
  const firstNames = ['ياسر', 'عمر', 'خالد', 'فهد', 'ناصر', 'سعود', 'بدر', 'تركي', 'ماجد', 'هاني', 'ليلى', 'مريم', 'هدى', 'أمل', 'نور', 'دانة', 'رنا', 'سارة', 'مها', 'عائشة'];
  const lastNames = ['القحطاني', 'العتيبي', 'الزهراني', 'الدوسري', 'الشمري', 'المطيري', 'الغامدي', 'الجهني', 'القرني', 'السلمي'];
  const studentIds: any[] = [];
  for (let i = 0; i < 30; i++) {
    const sid = `STU${String(i + 1).padStart(4, '0')}`;
    const exist = await sql('SELECT id FROM students WHERE student_id = ?', [sid]);
    if (exist.rows.length === 0) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const school = i < 15 ? 'middle' : 'high';
      const year = school === 'middle' ? 2012 : 2008;
      await sql("INSERT INTO students (student_id, first_name, last_name, date_of_birth, email, phone, school, enrollment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), 'active')",
        [sid, fn, ln, `${year}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`, `${sid}@school.com`, `05${String(50000000 + i).substring(0, 8)}`, school]);
      const s = await sql('SELECT id FROM students WHERE student_id = ?', [sid]);
      studentIds.push(s.rows[0].id);
      console.log(`  Student: ${fn} ${ln} (${school})`);
    }
  }

  // --- ENROLLMENTS ---
  for (const sid of studentIds) {
    // Find matching class by school
    const student = await sql('SELECT school FROM students WHERE id = ?', [sid]);
    const school = student.rows[0]?.school || 'middle';
    const matchingClasses = classList.filter((c: any) =>
      (school === 'middle' && c.grade === 'المتوسطة') ||
      (school === 'high' && c.grade === 'الثانوية')
    );
    if (matchingClasses.length > 0) {
      const cid = matchingClasses[Math.floor(Math.random() * matchingClasses.length)].id;
      const exist = await sql('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?', [sid, cid]);
      if (exist.rows.length === 0) {
        await sql("INSERT INTO enrollments (student_id, class_id, status) VALUES (?, ?, 'active')", [sid, cid]);
      }
    }
  }
  console.log('  Enrollments created');

  // --- ATTENDANCE ---
  const dates = ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-06', '2026-04-07', '2026-04-08'];
  const statuses = ['present', 'present', 'present', 'present', 'absent', 'late', 'excused'];
  for (const date of dates) {
    const activeEnroll = await sql("SELECT student_id, class_id FROM enrollments WHERE status = 'active'");
    for (const e of activeEnroll.rows) {
      const exist = await sql('SELECT id FROM attendance WHERE student_id = ? AND class_id = ? AND attendance_date = ?', [e.student_id, e.class_id, date]);
      if (exist.rows.length === 0) {
        const st = statuses[Math.floor(Math.random() * statuses.length)];
        await sql("INSERT INTO attendance (student_id, class_id, attendance_date, status) VALUES (?, ?, ?, ?)", [e.student_id, e.class_id, date, st]);
      }
    }
  }
  console.log('  Attendance created');

  // --- GRADES ---
  const subjects = ['رياضيات', 'علوم', 'لغة عربية', 'لغة إنجليزية', 'تاريخ', 'جغرافيا'];
  const types = ['quiz', 'test', 'assignment', 'midterm', 'final'];
  const activeE = await sql("SELECT student_id, class_id FROM enrollments WHERE status = 'active'");
  for (const e of activeE.rows) {
    for (let g = 0; g < 3; g++) {
      const subj = subjects[Math.floor(Math.random() * subjects.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      await sql("INSERT INTO grades (student_id, class_id, subject, assessment_type, score, total_score, assessment_date) VALUES (?, ?, ?, ?, ?, 100, date('now'))",
        [e.student_id, e.class_id, subj, type, Math.floor(Math.random() * 50) + 50]);
    }
  }
  console.log('  Grades created');

  // --- SCHEDULES ---
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
  const periods = [
    { start: '07:30', end: '08:15' }, { start: '08:15', end: '09:00' },
    { start: '09:15', end: '10:00' }, { start: '10:00', end: '10:45' },
    { start: '11:00', end: '11:45' }, { start: '11:45', end: '12:30' },
  ];
  for (const cls of classList) {
    const t = await sql('SELECT teacher_id FROM classes WHERE id = ?', [cls.id]);
    const teacherId = t.rows[0]?.teacher_id;
    if (!teacherId) continue;
    for (let d = 0; d < 5; d++) {
      const period = periods[d % periods.length];
      const exist = await sql('SELECT id FROM schedules WHERE class_id = ? AND day_of_week = ? AND start_time = ?', [cls.id, days[d], period.start]);
      if (exist.rows.length === 0) {
        await sql("INSERT INTO schedules (class_id, teacher_id, subject, day_of_week, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [cls.id, teacherId, subjects[d % subjects.length], days[d], period.start, period.end, 'active']);
      }
    }
  }
  console.log('  Schedules created');

  // --- ANNOUNCEMENTS ---
  const adminUser = await sql("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const adminId = adminUser.rows[0]?.id;
  if (adminId) {
    await sql("INSERT INTO announcements (title, content, target_audience, created_by, status) VALUES (?, ?, 'all', ?, 'active')",
      ['بداية الفصل الدراسي الثاني', 'نرحب بجميع الطلاب والمعلمين في الفصل الدراسي الثاني', adminId]);
    await sql("INSERT INTO announcements (title, content, target_audience, created_by, status) VALUES (?, ?, 'teachers', ?, 'active')",
      ['اجتماع المعلمين', 'يرجى حضور اجتماع المعلمين يوم الأحد القادم في قاعة الاجتماعات', adminId]);
    console.log('  Announcements created');
  }

  // --- TEACHER REPORTS ---
  const reportTypes = ['activity', 'positive', 'behavioral', 'academic_deficiency'];
  const enrolls = await sql("SELECT e.student_id, e.class_id FROM enrollments e WHERE e.status = 'active' LIMIT 10");
  for (const e of enrolls.rows) {
    const tch = await sql('SELECT teacher_id FROM classes WHERE id = ?', [e.class_id]);
    const tid = tch.rows[0]?.teacher_id;
    if (tid) {
      await sql("INSERT INTO teacher_reports (teacher_id, student_id, class_id, report_type, title, content, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [tid, e.student_id, e.class_id, reportTypes[Math.floor(Math.random() * reportTypes.length)], 'تقرير', 'مشاركة جيدة في الفصل', new Date().toISOString().split('T')[0], 'active']);
    }
  }
  console.log('  Teacher reports created');

  console.log('Seed completed successfully!');
}

seed().catch(console.error);
