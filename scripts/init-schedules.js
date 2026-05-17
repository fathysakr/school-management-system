const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'school.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

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

// Insert sample schedule data
const classes = db.prepare('SELECT id FROM classes').all();
const teachers = db.prepare('SELECT id FROM teachers').all();

if (classes.length > 0 && teachers.length > 0) {
  const subjects = ['الرياضيات', 'العلوم', 'اللغة العربية', 'اللغة الإنجليزية', 'التاريخ', 'الجغرافيا'];
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
  const timeSlots = [
    { start: '08:00', end: '08:50' },
    { start: '09:00', end: '09:50' },
    { start: '10:00', end: '10:50' },
    { start: '11:00', end: '11:50' },
    { start: '12:00', end: '12:50' },
  ];

  const insertSchedule = db.prepare(
    'INSERT OR IGNORE INTO schedules (class_id, teacher_id, subject, day_of_week, start_time, end_time, room_number, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const cls of classes) {
    for (const day of days) {
      const slotIdx = days.indexOf(day) % timeSlots.length;
      const timeSlot = timeSlots[slotIdx];
      const teacherIdx = classes.indexOf(cls) % teachers.length;
      const subjectIdx = (classes.indexOf(cls) + days.indexOf(day)) % subjects.length;

      insertSchedule.run(
        cls.id,
        teachers[teacherIdx].id,
        subjects[subjectIdx],
        day,
        timeSlot.start,
        timeSlot.end,
        `قاعة ${100 + classes.indexOf(cls)}`,
        'active'
      );
    }
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM schedules').get();
  console.log(`${count.c} schedule entries created`);
}

db.close();
console.log('Schedule table initialized');
