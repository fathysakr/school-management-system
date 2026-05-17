/**
 * Seed script: Generate realistic test data for the school management system.
 * Run: node scripts/seed-data.js
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'school.db');

// Ensure data directory exists
const fs = require('fs');
const dirPath = path.dirname(dbPath);
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT UNIQUE NOT NULL,
    user_id INTEGER UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,
    specialization TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    user_id INTEGER UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    photo_url TEXT,
    enrollment_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    section TEXT,
    teacher_id INTEGER NOT NULL,
    room_number TEXT,
    capacity INTEGER DEFAULT 30,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_name, grade, section),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'graduated')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, class_id, attendance_date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('test', 'quiz', 'assignment', 'midterm', 'final')),
    score REAL NOT NULL,
    total_score REAL DEFAULT 100,
    weight REAL DEFAULT 1,
    assessment_date DATE,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'teachers', 'students', 'parents', 'class')),
    class_id INTEGER,
    created_by INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    published_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room_number TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS teacher_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('activity', 'positive', 'behavioral', 'academic_deficiency')),
    title TEXT,
    content TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  )
`);

console.log('✓ Database schema initialized');

const SALT = bcrypt.genSaltSync(10);
const hash = (pw) => bcrypt.hashSync(pw, SALT);

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 1. Create users
const adminUsers = [
  { email: 'admin@school.com', password: hash('admin123'), role: 'admin', status: 'active' },
];

const middleSupervisors = [
  { email: 'middle.sup@school.com', password: hash('sup123'), role: 'middle_supervisor', status: 'active' },
];

const highSupervisors = [
  { email: 'high.sup@school.com', password: hash('sup123'), role: 'high_supervisor', status: 'active' },
];

const counselorUsers = [
  { email: 'middle.counselor@school.com', password: hash('counselor123'), role: 'middle_counselor', status: 'active' },
  { email: 'high.counselor@school.com', password: hash('counselor123'), role: 'high_counselor', status: 'active' },
];

const teacherUsers = [
  { email: 'ahmed.hassan@school.com', password: hash('teacher123'), role: 'middle_teacher', status: 'active' },
  { email: 'khalid.ali@school.com', password: hash('teacher123'), role: 'middle_teacher', status: 'active' },
  { email: 'omar.khalil@school.com', password: hash('teacher123'), role: 'middle_teacher', status: 'active' },
  { email: 'nasser.mahmoud@school.com', password: hash('teacher123'), role: 'high_teacher', status: 'active' },
  { email: 'youssef.ibrahim@school.com', password: hash('teacher123'), role: 'high_teacher', status: 'active' },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (email, password, role, status) VALUES (?, ?, ?, ?)'
);

const allUserRows = [...adminUsers, ...middleSupervisors, ...highSupervisors, ...counselorUsers, ...teacherUsers];
for (const u of allUserRows) {
  insertUser.run(u.email, u.password, u.role, u.status);
}

const getUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
const adminUserId = getUserByEmail.get('admin@school.com').id;
const teacherUserIds = teacherUsers.map(u => getUserByEmail.get(u.email).id);

// 2. Create teachers
const teacherData = [
  { teacher_id: 'TCH001', first_name: 'أحمد', last_name: 'حسن', specialization: 'الرياضيات', phone: '01012345678', email: 'ahmed.hassan@school.com' },
  { teacher_id: 'TCH002', first_name: 'خالد', last_name: 'علي', specialization: 'العلوم', phone: '01123456789', email: 'khalid.ali@school.com' },
  { teacher_id: 'TCH003', first_name: 'عمر', last_name: 'خليل', specialization: 'اللغة العربية', phone: '01234567890', email: 'omar.khalil@school.com' },
  { teacher_id: 'TCH004', first_name: 'ناصر', last_name: 'محمود', specialization: 'اللغة الإنجليزية', phone: '01098765432', email: 'nasser.mahmoud@school.com' },
  { teacher_id: 'TCH005', first_name: 'يوسف', last_name: 'إبراهيم', specialization: 'التاريخ', phone: '01187654321', email: 'youssef.ibrahim@school.com' },
];

const insertTeacher = db.prepare(
  'INSERT OR IGNORE INTO teachers (teacher_id, user_id, first_name, last_name, specialization, phone, email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

const teacherIds = [];
for (let i = 0; i < teacherData.length; i++) {
  const t = teacherData[i];
  insertTeacher.run(t.teacher_id, teacherUserIds[i], t.first_name, t.last_name, t.specialization, t.phone, t.email, 'active');
  const row = db.prepare('SELECT id FROM teachers WHERE teacher_id = ?').get(t.teacher_id);
  teacherIds.push(row.id);
}

// 3. Create students (no user accounts for students)
const studentData = [
  { student_id: 'STU001', first_name: 'فيصل', last_name: 'آل سعود', parent_phone: '0500000001', parent_email: 'parent1@mail.com' },
  { student_id: 'STU002', first_name: 'سعود', last_name: 'العتيبي', parent_phone: '0500000002', parent_email: 'parent2@mail.com' },
  { student_id: 'STU003', first_name: 'عبدالله', last_name: 'القرني', parent_phone: '0500000003', parent_email: 'parent3@mail.com' },
  { student_id: 'STU004', first_name: 'محمد', last_name: 'الغامدي', parent_phone: '0500000004', parent_email: 'parent4@mail.com' },
  { student_id: 'STU005', first_name: 'أحمد', last_name: 'الزهراني', parent_phone: '0500000005', parent_email: 'parent5@mail.com' },
  { student_id: 'STU006', first_name: 'خالد', last_name: 'الدوسري', parent_phone: '0500000006', parent_email: 'parent6@mail.com' },
  { student_id: 'STU007', first_name: 'عمر', last_name: 'الشهري', parent_phone: '0500000007', parent_email: 'parent7@mail.com' },
  { student_id: 'STU008', first_name: 'عبدالرحمن', last_name: 'القحطاني', parent_phone: '0500000008', parent_email: 'parent8@mail.com' },
  { student_id: 'STU009', first_name: 'تركي', last_name: 'المطيري', parent_phone: '0500000009', parent_email: 'parent9@mail.com' },
  { student_id: 'STU010', first_name: 'بندر', last_name: 'الحربي', parent_phone: '0500000010', parent_email: 'parent10@mail.com' },
  { student_id: 'STU011', first_name: 'نايف', last_name: 'الشمري', parent_phone: '0500000011', parent_email: 'parent11@mail.com' },
  { student_id: 'STU012', first_name: 'مشعل', last_name: 'العنزي', parent_phone: '0500000012', parent_email: 'parent12@mail.com' },
  { student_id: 'STU013', first_name: 'يزيد', last_name: 'الجهني', parent_phone: '0500000013', parent_email: 'parent13@mail.com' },
  { student_id: 'STU014', first_name: 'هاشم', last_name: 'الثقفي', parent_phone: '0500000014', parent_email: 'parent14@mail.com' },
  { student_id: 'STU015', first_name: 'أسامة', last_name: 'البلوي', parent_phone: '0500000015', parent_email: 'parent15@mail.com' },
  { student_id: 'STU016', first_name: 'بدر', last_name: 'المالكي', parent_phone: '0500000016', parent_email: 'parent16@mail.com' },
  { student_id: 'STU017', first_name: 'ماجد', last_name: 'العمري', parent_phone: '0500000017', parent_email: 'parent17@mail.com' },
  { student_id: 'STU018', first_name: 'وليد', last_name: 'البقمي', parent_phone: '0500000018', parent_email: 'parent18@mail.com' },
  { student_id: 'STU019', first_name: 'فهد', last_name: 'السبيعي', parent_phone: '0500000019', parent_email: 'parent19@mail.com' },
  { student_id: 'STU020', first_name: 'سلطان', last_name: 'الزهراني', parent_phone: '0500000020', parent_email: 'parent20@mail.com' },
  { student_id: 'STU021', first_name: 'سعد', last_name: 'الحارثي', parent_phone: '0500000021', parent_email: 'parent21@mail.com' },
];

const insertStudent = db.prepare(
  'INSERT OR IGNORE INTO students (student_id, user_id, first_name, last_name, date_of_birth, parent_phone, parent_email, enrollment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

const studentIds = [];
for (let i = 0; i < studentData.length; i++) {
  const s = studentData[i];
  const dob = `2008-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`;
  insertStudent.run(s.student_id, null, s.first_name, s.last_name, dob, s.parent_phone, s.parent_email, '2025-09-01', 'active');
  const row = db.prepare('SELECT id FROM students WHERE student_id = ?').get(s.student_id);
  studentIds.push(row.id);
}

// 4. Create classes
const classes = [
  { class_name: 'الأول أ', grade: 'المتوسطة', section: 'أ', teacher_id: teacherIds[0], room_number: '101', capacity: 30 },
  { class_name: 'الأول ب', grade: 'المتوسطة', section: 'ب', teacher_id: teacherIds[1], room_number: '102', capacity: 30 },
  { class_name: 'الثاني أ', grade: 'المتوسطة', section: 'أ', teacher_id: teacherIds[2], room_number: '201', capacity: 30 },
  { class_name: 'الثاني ب', grade: 'المتوسطة', section: 'ب', teacher_id: teacherIds[3], room_number: '202', capacity: 30 },
  { class_name: 'الثالث أ', grade: 'الثانوية', section: 'أ', teacher_id: teacherIds[4], room_number: '301', capacity: 30 },
];

const insertClass = db.prepare(
  'INSERT OR IGNORE INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const classIds = [];
for (const c of classes) {
  insertClass.run(c.class_name, c.grade, c.section, c.teacher_id, c.room_number, c.capacity, 'active');
  const row = db.prepare('SELECT id FROM classes WHERE class_name = ?').get(c.class_name);
  classIds.push(row.id);
}

// 5. Enroll students in classes
const insertEnrollment = db.prepare(
  'INSERT OR IGNORE INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, ?, ?)'
);

const shuffled = [...studentIds].sort(() => 0.5 - Math.random());
for (let i = 0; i < shuffled.length; i++) {
  const classIdx = i % classIds.length;
  insertEnrollment.run(shuffled[i], classIds[classIdx], '2025-09-01', 'active');
}

// 6. Create attendance records
const insertAttendance = db.prepare(
  'INSERT OR IGNORE INTO attendance (student_id, class_id, attendance_date, status, remarks) VALUES (?, ?, ?, ?, ?)'
);

const statuses = ['present', 'present', 'present', 'present', 'present', 'absent', 'late', 'excused'];
const today = new Date();

for (let d = 1; d <= 30; d++) {
  const date = new Date(today);
  date.setDate(date.getDate() - d);
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 5 || dayOfWeek === 6) continue;
  const dateStr = date.toISOString().split('T')[0];

  for (const cid of classIds) {
    const enrolled = db.prepare('SELECT student_id FROM enrollments WHERE class_id = ? AND status = ?').all(cid, 'active');
    for (const e of enrolled) {
      const status = pick(statuses);
      const remarks = status === 'absent' ? 'غياب بدون عذر' : status === 'late' ? 'تأخر 15 دقيقة' : status === 'excused' ? 'بعذر طبي' : '';
      insertAttendance.run(e.student_id, cid, dateStr, status, remarks || null);
    }
  }
}

// 7. Create grade records
const subjects = ['الرياضيات', 'العلوم', 'اللغة العربية', 'اللغة الإنجليزية', 'التاريخ', 'الجغرافيا'];
const assessmentTypes = ['test', 'quiz', 'assignment', 'midterm', 'final'];

const insertGrade = db.prepare(
  'INSERT INTO grades (student_id, class_id, subject, assessment_type, score, total_score, weight, assessment_date, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

for (const cid of classIds) {
  const enrolled = db.prepare('SELECT student_id FROM enrollments WHERE class_id = ? AND status = ?').all(cid, 'active');
  const classSubject = subjects[classIds.indexOf(cid) % subjects.length];
  const extraSubjects = subjects.filter(s => s !== classSubject).slice(0, 2);
  const allSubjects = [classSubject, ...extraSubjects];

  for (const e of enrolled) {
    for (const subj of allSubjects) {
      const asmtType = pick(assessmentTypes);
      const totalScore = asmtType === 'final' ? 100 : asmtType === 'midterm' ? 50 : 20;
      const scoreBase = asmtType === 'final' ? rand(50, 100) : asmtType === 'midterm' ? rand(25, 50) : rand(10, 20);
      const weight = asmtType === 'final' ? 3 : asmtType === 'midterm' ? 2 : 1;
      const assessmentDate = `2025-${String(rand(10, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`;
      insertGrade.run(e.student_id, cid, subj, asmtType, scoreBase, totalScore, weight, assessmentDate, null);
    }
  }
}

// 8. Create announcements
const insertAnnouncement = db.prepare(
  'INSERT OR IGNORE INTO announcements (title, content, target_audience, class_id, created_by, status, published_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const announcements = [
  { title: 'بداية العام الدراسي الجديد', content: 'نرحب بطلابنا وأولياء الأمور في بداية العام الدراسي الجديد. نتمنى للجميع عاماً دراسياً موفقاً.', target_audience: 'all' },
  { title: 'اجتماع أولياء الأمور', content: 'ندعو جميع أولياء الأمور لحضور الاجتماع المقرر يوم السبت القادم الساعة 10 صباحاً لمناقشة خطة العام الدراسي.', target_audience: 'parents' },
  { title: 'امتحانات منتصف الفصل', content: 'تبدأ امتحانات منتصف الفصل من يوم الأحد القادم. يرجى الاستعداد جيداً ومراجعة الجدول المرفق.', target_audience: 'students' },
  { title: 'اجتماع هيئة التدريس', content: 'اجتماع هيئة التدريس لمناقشة الخطة التعليمية للفصل الثاني يوم الاثنين الساعة 2 ظهراً.', target_audience: 'teachers' },
  { title: 'رحلة مدرسية', content: 'تنظم المدرسة رحلة تعليمية إلى المتحف القومي يوم الخميس القادم. الاشتراك اختياري والتكلفة 50 جنيه.', target_audience: 'class' },
];

for (const a of announcements) {
  const classId = a.target_audience === 'class' ? classIds[0] : null;
  insertAnnouncement.run(a.title, a.content, a.target_audience, classId, adminUserId, 'active', new Date().toISOString().split('T')[0]);
}

// 9. Create teacher reports
const insertReport = db.prepare(
  'INSERT INTO teacher_reports (teacher_id, student_id, class_id, report_type, title, content, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

const reportTemplates = {
  activity: [
    { title: 'تقرير نشاط صفي', content: 'الطالب مشارك بنشاط في الحصة الدراسية ويقوم بالواجبات المطلوبة.' },
    { title: 'تقرير نشاط لا صفي', content: 'شارك الطالب في النشاط الرياضي المدرسي وأظهر روح الفريق.' },
    { title: 'مشاركة في الإذاعة المدرسية', content: 'ألقى الطالب كلمة في الإذاعة المدرسية عن أهمية العلم.' },
    { title: 'نشاط بحثي', content: 'قدم الطالب بحثاً متميزاً في مادة العلوم وحصل على تقدير ممتاز.' },
  ],
  positive: [
    { title: 'تفوق دراسي', content: 'حصل الطالب على أعلى درجة في اختبار الرياضيات الشهري.' },
    { title: 'سلوك ممتاز', content: 'يتصف الطالب بالأخلاق الحسنة والتعاون مع زملائه.' },
    { title: 'انضباط', content: 'الطالب ملتزم بالحضور والانصراف في المواعيد المحددة.' },
    { title: 'مبادرة تطوعية', content: 'تطوع الطالب للمساعدة في تنظيم طابور الصباح.' },
  ],
  behavioral: [
    { title: 'سلوك غير لائق', content: 'لوحظ على الطالب سلوك غير لائق أثناء الفسحة.' },
    { title: 'عدم الالتزام بالزي المدرسي', content: 'الطالب لا يلتزم بالزي المدرسي النظامي.' },
    { title: 'إزعاج داخل الفصل', content: 'يقوم الطالب بإزعاج زملائه أثناء الحصة الدراسية.' },
    { title: 'تأخير متكرر', content: 'يتأخر الطالب عن الحصة الأولى بشكل متكرر.' },
  ],
  academic_deficiency: [
    { title: 'ضعف في التحصيل الدراسي', content: 'يعاني الطالب من ضعف في مادة الرياضيات ويحتاج إلى دعم إضافي.' },
    { title: 'تأخر في تسليم الواجبات', content: 'الطالب لا يسلم الواجبات المنزلية في الموعد المحدد.' },
    { title: 'ضعف في القراءة', content: 'مستوى القراءة لدى الطالب أقل من المستوى المطلوب للصف.' },
    { title: 'عدم التركيز في الحصة', content: 'الطالب مشتت التركيز ولا يتابع شرح الدرس.' },
  ],
};

const reportTypes = ['activity', 'positive', 'behavioral', 'academic_deficiency'];

for (const sid of studentIds) {
  const enrollment = db.prepare('SELECT class_id FROM enrollments WHERE student_id = ? AND status = ?').get(sid, 'active');
  if (!enrollment) continue;
  const classId = enrollment.class_id;
  // Pick a random teacher for this class
  const classInfo = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(classId);
  if (!classInfo) continue;
  const teacherId = classInfo.teacher_id;

  // Create 1-2 reports per student
  const numReports = rand(1, 2);
  for (let r = 0; r < numReports; r++) {
    const type = pick(reportTypes);
    const template = pick(reportTemplates[type]);
    const daysAgo = rand(1, 60);
    const reportDate = new Date(today);
    reportDate.setDate(reportDate.getDate() - daysAgo);
    const dateStr = reportDate.toISOString().split('T')[0];
    insertReport.run(teacherId, sid, classId, type, template.title, template.content, dateStr, 'active');
  }
}

console.log('✅ Seed data completed successfully!');
console.log(`- ${teacherUsers.length + middleSupervisors.length + highSupervisors.length + counselorUsers.length} staff users seeded`);
console.log(`- ${studentData.length} students seeded`);
console.log(`- ${classes.length} classes created`);
console.log(`- ${studentData.length} enrollments created`);

const attendanceCount = db.prepare('SELECT COUNT(*) as c FROM attendance').get();
console.log(`- ${attendanceCount.c} attendance records created`);

const gradeCount = db.prepare('SELECT COUNT(*) as c FROM grades').get();
console.log(`- ${gradeCount.c} grade records created`);

const annCount = db.prepare('SELECT COUNT(*) as c FROM announcements').get();
console.log(`- ${annCount.c} announcements created`);

console.log('\n📋 Login credentials:');
console.log('Admin: admin@school.com / admin123');
console.log('Middle Supervisor: middle.sup@school.com / sup123');
console.log('High Supervisor: high.sup@school.com / sup123');
console.log('Teachers: ahmed.hassan@school.com / teacher123 (and others)');
console.log('Middle Counselor: middle.counselor@school.com / counselor123');
console.log('High Counselor: high.counselor@school.com / counselor123');

db.close();
