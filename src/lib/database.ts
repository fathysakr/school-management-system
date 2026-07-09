import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import os from 'os';

function findDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  let srcPath = '';
  let dir = process.cwd();
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      srcPath = path.join(dir, 'data', 'school.db');
      const dataDir = path.join(dir, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!srcPath) {
    srcPath = path.join(process.cwd(), 'data', 'school.db');
    const fbDir = path.dirname(srcPath);
    if (!fs.existsSync(fbDir)) fs.mkdirSync(fbDir, { recursive: true });
  }
  if (fs.existsSync(srcPath)) {
    try {
      const dir = path.dirname(srcPath);
      const probe = path.join(dir, '.wtest_' + Date.now());
      fs.writeFileSync(probe, '');
      fs.unlinkSync(probe);
      return srcPath;
    } catch {}
  }
  const tmpDir = path.join(os.tmpdir(), 'school-data');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, 'school.db');
  if (fs.existsSync(srcPath) && !fs.existsSync(tmpPath)) {
    fs.copyFileSync(srcPath, tmpPath);
  } else if (!fs.existsSync(srcPath) && !fs.existsSync(tmpPath)) {
    fs.writeFileSync(tmpPath, '');
  }
  return tmpPath;
}

function toFileUrl(dbPath: string): string {
  const normalized = dbPath.replace(/\\/g, '/');
  const forUrl = normalized.replace(/^([A-Za-z]:)/, '/$1');
  return 'file://' + forUrl;
}

export type DbResult = {
  get(...args: any[]): Promise<any>;
  all(...args: any[]): Promise<any[]>;
  run(...args: any[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
};

export interface DbAdapter {
  prepare(sql: string): DbResult;
  exec(sql: string): Promise<void>;
  transaction(fn: (...args: any[]) => any): (...args: any[]) => Promise<any>;
  close(): void;
}

function createBetterSqlite3Adapter(bsql: any): DbAdapter {
  return {
    prepare(sql: string) {
      const stmt = bsql.prepare(sql);
      return {
        get: (...args: any[]) => Promise.resolve(stmt.get(...args)),
        all: (...args: any[]) => Promise.resolve(stmt.all(...args)),
        run: (...args: any[]) => Promise.resolve(stmt.run(...args)),
      };
    },
    exec: (sql: string) => { bsql.exec(sql); return Promise.resolve(); },
    transaction(fn: (...args: any[]) => any) {
      return async (...args: any[]) => {
        bsql.exec('BEGIN');
        try {
          const result = await fn(...args);
          bsql.exec('COMMIT');
          return result;
        } catch (e) {
          try { bsql.exec('ROLLBACK'); } catch {}
          throw e;
        }
      };
    },
    close: () => bsql.close(),
  };
}

function createTursoAdapter() {
  const client = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_DB_TOKEN,
  });
  return createLibsqlAdapter(client);
}

function createLibsqlAdapter(client: any): DbAdapter {
  return {
    prepare(sql: string) {
      return {
        get: async (...args: any[]) => {
          const result = await client.execute({ sql, args });
          return result.rows[0] || null;
        },
        all: async (...args: any[]) => {
          const result = await client.execute({ sql, args });
          return result.rows;
        },
        run: async (...args: any[]) => {
          const result = await client.execute({ sql, args });
          return { changes: Number(result.rowsAffected), lastInsertRowid: Number(result.lastInsertRowid || 0) };
        },
      };
    },
    exec: async (sql: string) => { await client.execute(sql); },
    transaction(fn: (...args: any[]) => any) {
      return async (...args: any[]) => {
        let began = false;
        try { await client.execute('BEGIN'); began = true; } catch {}
        try {
          const result = await fn(...args);
          if (began) await client.execute('COMMIT');
          return result;
        } catch (e) {
          if (began) { try { await client.execute('ROLLBACK'); } catch {} }
          throw e;
        }
      };
    },
    close: () => { client.close(); },
  };
}

function applyMigrations(bsql: any) {
  function colExists(table: string, column: string): boolean {
    const row = bsql.prepare(
      `SELECT COUNT(*) as cnt FROM pragma_table_info('${table.replace(/'/g, "''")}') WHERE name = ?`
    ).get(column) as any;
    return row.cnt > 0;
  }

  bsql.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    (bsql.prepare('SELECT name FROM _migrations').all() as any[]).map(r => r.name)
  );

  const migrations: { name: string; sql: string }[] = [
    {
      name: '001_initial_schema',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher')),
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS teachers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id TEXT UNIQUE NOT NULL,
          user_id INTEGER UNIQUE NOT NULL,
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
        );
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
          parent_phones TEXT DEFAULT '[]',
          photo_url TEXT,
          enrollment_date DATE,
          school TEXT DEFAULT 'middle',
          semester TEXT DEFAULT '',
          grade TEXT DEFAULT '',
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
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
        );
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
        );
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          class_id INTEGER NOT NULL,
          attendance_date DATE NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'escape')),
          remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, class_id, attendance_date),
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        );
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
        );
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
        );
        CREATE TABLE IF NOT EXISTS leave_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'personal', 'emergency', 'annual')),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          reason TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          approved_by INTEGER,
          approved_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
        );
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
        );
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
        );
      `
    },
    {
      name: '002_drop_teacher_gender',
      sql: colExists('teachers', 'gender')
        ? `CREATE TABLE IF NOT EXISTS teachers_new (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             teacher_id TEXT UNIQUE NOT NULL,
             user_id INTEGER UNIQUE NOT NULL,
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
           );
           INSERT INTO teachers_new SELECT id, teacher_id, user_id, first_name, last_name, date_of_birth, email, phone, address, specialization, photo_url, status, created_at, updated_at FROM teachers;
           DROP TABLE teachers;
           ALTER TABLE teachers_new RENAME TO teachers;`
        : 'SELECT 1'
    },
    {
      name: '003_drop_student_gender',
      sql: colExists('students', 'gender')
        ? `CREATE TABLE IF NOT EXISTS students_new (
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
             parent_phones TEXT DEFAULT '[]',
             photo_url TEXT,
             enrollment_date DATE,
             school TEXT DEFAULT 'middle',
             semester TEXT DEFAULT '',
             grade TEXT DEFAULT '',
             status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
           );
           INSERT INTO students_new SELECT id, student_id, user_id, first_name, last_name, date_of_birth, email, phone, address, parent_email, parent_phone, parent_phones, photo_url, enrollment_date, school, semester, '', status, created_at, updated_at FROM students;
           DROP TABLE students;
           ALTER TABLE students_new RENAME TO students;`
        : 'SELECT 1'
    },
    {
      name: '004_add_parent_phones',
      sql: colExists('students', 'parent_phones')
        ? 'SELECT 1'
        : `ALTER TABLE students ADD COLUMN parent_phones TEXT DEFAULT '[]'`
    },
    {
      name: '005_add_school_to_teachers',
      sql: colExists('teachers', 'school')
        ? 'SELECT 1'
        : `ALTER TABLE teachers ADD COLUMN school TEXT DEFAULT 'middle' CHECK (school IN ('middle', 'high'))`
    },
    {
      name: '006_add_school_to_students',
      sql: colExists('students', 'school')
        ? 'SELECT 1'
        : `ALTER TABLE students ADD COLUMN school TEXT DEFAULT 'middle' CHECK (school IN ('middle', 'high'))`
    },
    {
      name: '007_add_counselor_roles',
      sql: (() => {
        try {
          bsql.prepare("INSERT INTO users (email, password, role) VALUES ('__test_counselor__', '__test__', 'middle_counselor')").run();
          bsql.prepare("DELETE FROM users WHERE email = '__test_counselor__'").run();
          return 'SELECT 1';
        } catch {
          return `
            PRAGMA foreign_keys = OFF;
            DROP TABLE IF EXISTS users_new;
            CREATE TABLE users_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              password TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor')),
              status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users_new SELECT * FROM users;
            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
            PRAGMA foreign_keys = ON;
          `;
        }
      })()
    },
    {
      name: '008_nullable_teacher_user_id',
      sql: (() => {
        const info = bsql.prepare("PRAGMA table_info('teachers')").all() as any[];
        const userCol = info.find((c: any) => c.name === 'user_id');
        if (userCol && userCol.notnull === 0) return 'SELECT 1';
        return `
          PRAGMA foreign_keys = OFF;
          DROP TABLE IF EXISTS teachers_new;
          CREATE TABLE teachers_new (
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
            school TEXT DEFAULT 'middle' CHECK (school IN ('middle', 'high')),
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
          INSERT INTO teachers_new SELECT id, teacher_id, user_id, first_name, last_name, date_of_birth, email, phone, address, specialization, photo_url, school, status, created_at, updated_at FROM teachers;
          DROP TABLE teachers;
          ALTER TABLE teachers_new RENAME TO teachers;
          PRAGMA foreign_keys = ON;
        `;
      })()
    },
    {
      name: '009_custom_permissions_principal_roles',
      sql: (() => {
        try {
          bsql.prepare("SELECT custom_permissions FROM users LIMIT 1").get();
          return 'SELECT 1';
        } catch {
          return `ALTER TABLE users ADD COLUMN custom_permissions TEXT DEFAULT NULL;`;
        }
      })()
    },
    {
      name: '010_principal_roles',
      sql: (() => {
        try {
          bsql.prepare("SELECT 1 FROM users WHERE role = 'middle_principal' LIMIT 1").get();
          return 'SELECT 1';
        } catch {
          return `
            PRAGMA foreign_keys = OFF;
            CREATE TABLE IF NOT EXISTS users_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              password TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal')),
              status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
              custom_permissions TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users_new SELECT id, email, password, role, status, custom_permissions, created_at, updated_at FROM users;
            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
            PRAGMA foreign_keys = ON;
          `;
        }
      })()
    },
    {
      name: '011_subjects',
      sql: (() => {
        try {
          bsql.prepare("SELECT id FROM subjects LIMIT 1").get();
          return 'SELECT 1';
        } catch {
          return `
            CREATE TABLE IF NOT EXISTS subjects (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              school TEXT NOT NULL CHECK (school IN ('middle', 'high')),
              sessions_per_week INTEGER NOT NULL DEFAULT 3,
              grade TEXT,
              teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
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
          `;
        }
      })()
    },
    {
      name: '012_substitutions',
      sql: `
        CREATE TABLE IF NOT EXISTS substitutions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATE NOT NULL,
          absent_teacher_id INTEGER NOT NULL,
          substitute_teacher_id INTEGER,
          schedule_id INTEGER NOT NULL,
          subject TEXT NOT NULL,
          class_id INTEGER NOT NULL,
          day_of_week TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          reason TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (absent_teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
          FOREIGN KEY (substitute_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
      `
    },
    {
      name: '025_counseling_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS counseling_programs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          domain TEXT NOT NULL CHECK (domain IN ('academic', 'psychological', 'guidance', 'community')),
          description TEXT,
          goals TEXT,
          target_group TEXT,
          start_date DATE,
          end_date DATE,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS counseling_attendance_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
          report_type TEXT NOT NULL CHECK (report_type IN ('absence', 'behavior', 'academic', 'general')),
          description TEXT NOT NULL,
          actions_taken TEXT,
          follow_up TEXT,
          status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
          counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS counseling_cases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
          case_type TEXT NOT NULL CHECK (case_type IN ('academic', 'behavioral', 'psychological', 'social', 'career')),
          title TEXT NOT NULL,
          background TEXT,
          analysis TEXT,
          intervention TEXT,
          outcome TEXT,
          recommendations TEXT,
          status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'referred')),
          counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS counseling_behavior_contracts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          terms TEXT NOT NULL,
          start_date DATE DEFAULT CURRENT_DATE,
          end_date DATE,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'breached', 'cancelled')),
          student_signed INTEGER DEFAULT 0,
          parent_signed INTEGER DEFAULT 0,
          counselor_signed INTEGER DEFAULT 0,
          counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS counseling_behavior_issues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
          issue_type TEXT NOT NULL CHECK (issue_type IN ('violence', 'bullying', 'disruption', 'cyber', 'absence', 'other')),
          description TEXT NOT NULL,
          severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          actions_taken TEXT,
          status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
          counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `
    },
    {
      name: '013_notifications',
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('urgent', 'info', 'warning')),
          link TEXT,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: '014_user_teacher_id',
      sql: (() => {
        if (colExists('users', 'teacher_id')) return 'SELECT 1';
        return `
          ALTER TABLE users ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL;
          UPDATE users SET teacher_id = (SELECT id FROM teachers WHERE teachers.user_id = users.id) WHERE EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id = users.id);
        `;
      })()
    },
    {
      name: '015_subject_grade',
      sql: (() => {
        if (colExists('subjects', 'grade')) return 'SELECT 1';
        return `
          ALTER TABLE subjects ADD COLUMN grade TEXT;
          INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES
            ('رياضيات','high',5,'الصف الأول الثانوي'),('انجليزي','high',4,'الصف الأول الثانوي'),('كفايات لغوية','high',3,'الصف الأول الثانوي'),('علم بيئة','high',2,'الصف الأول الثانوي'),('فيزياء','high',3,'الصف الأول الثانوي'),('بدنية','high',2,'الصف الأول الثانوي'),('نفسية','high',2,'الصف الأول الثانوي'),('تقنية رقمية','high',2,'الصف الأول الثانوي'),
            ('رياضيات','high',5,'الصف الثاني الثانوي'),('حديث','high',2,'الصف الثاني الثانوي'),('توحيد','high',2,'الصف الثاني الثانوي'),('كيمياء','high',3,'الصف الثاني الثانوي'),('أحياء','high',3,'الصف الثاني الثانوي'),('انجليزي','high',4,'الصف الثاني الثانوي'),('تقنية رقمية','high',2,'الصف الثاني الثانوي'),
            ('رياضيات','high',5,'الصف الثالث الثانوي'),('انجليزي','high',4,'الصف الثالث الثانوي'),('فيزياء','high',3,'الصف الثالث الثانوي'),('علم الأرض','high',2,'الصف الثالث الثانوي'),('المهارات الحياتية','high',2,'الصف الثالث الثانوي'),('الدراسات الادبية','high',2,'الصف الثالث الثانوي'),('الدراسات النفسية','high',2,'الصف الثالث الثانوي'),('فقه','high',2,'الصف الثالث الثانوي'),('جغرافيا','high',2,'الصف الثالث الثانوي'),('بدنية','high',2,'الصف الثالث الثانوي');
        `;
      })()
    },
    {
      name: '016_subject_teacher_id',
      sql: (() => {
        if (colExists('subjects', 'teacher_id')) return 'SELECT 1';
        return `ALTER TABLE subjects ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL;`;
      })()
    },
    {
      name: '017_classes_teacher_id_nullable',
      sql: (() => {
        const cols = bsql.prepare("PRAGMA table_info(classes)").all() as any[];
        const teacherCol = cols.find((c: any) => c.name === 'teacher_id');
        if (teacherCol && teacherCol.notnull === 0) return 'SELECT 1';
        return `
          PRAGMA foreign_keys=OFF;
          CREATE TABLE IF NOT EXISTS classes_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT NOT NULL,
            grade TEXT NOT NULL,
            section TEXT,
            teacher_id INTEGER,
            room_number TEXT,
            capacity INTEGER DEFAULT 30,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(class_name, grade, section),
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
          );
          INSERT INTO classes_new SELECT * FROM classes;
          DROP TABLE classes;
          ALTER TABLE classes_new RENAME TO classes;
          PRAGMA foreign_keys=ON;
        `;
      })()
    },
    {
      name: '018_add_monitor_admin_staff_roles',
      sql: (() => {
        try {
          bsql.prepare("INSERT INTO users (email, password, role) VALUES ('__test__', '__test__', 'middle_monitor')").run();
          bsql.prepare("DELETE FROM users WHERE email = '__test__'").run();
          return 'SELECT 1';
        } catch {
          return `
            PRAGMA foreign_keys = OFF;
            DROP TABLE IF EXISTS users_new;
            CREATE TABLE users_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              password TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal', 'middle_monitor', 'high_monitor', 'middle_admin_staff', 'high_admin_staff')),
              status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
              custom_permissions TEXT,
              teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users_new SELECT * FROM users;
            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
            PRAGMA foreign_keys = ON;
          `;
        }
      })()
    },
    {
      name: '019_management_positions',
      sql: `
        CREATE TABLE IF NOT EXISTS management_positions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          school TEXT NOT NULL CHECK (school IN ('middle', 'high')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS management_position_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          position_id INTEGER NOT NULL REFERENCES management_positions(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(position_id, user_id)
        );
      `
    },
    {
      name: '020_parents',
      sql: `
        CREATE TABLE IF NOT EXISTS parents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `
    },
    {
      name: '021_add_semester',
      sql: colExists('students', 'semester')
        ? 'SELECT 1'
        : `ALTER TABLE students ADD COLUMN semester TEXT DEFAULT ''`
    },
    {
      name: '022_subject_classes',
      sql: (() => {
        try {
          bsql.prepare("SELECT id FROM subject_classes LIMIT 1").get();
          return 'SELECT 1';
        } catch { return `CREATE TABLE IF NOT EXISTS subject_classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          sessions_per_week INTEGER NOT NULL DEFAULT 0,
          UNIQUE(subject_id, class_id)
        )`; }
      })()
    },
    {
      name: '023_attendance_period',
      sql: (() => {
        if (colExists('attendance', 'period')) return 'SELECT 1';
        return `
          PRAGMA foreign_keys=OFF;
          CREATE TABLE IF NOT EXISTS attendance_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            class_id INTEGER NOT NULL,
            attendance_date DATE NOT NULL,
            period INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'escape')),
            remarks TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, class_id, attendance_date, period),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
          );
          INSERT INTO attendance_new (id, student_id, class_id, attendance_date, period, status, remarks, created_at, updated_at)
            SELECT id, student_id, class_id, attendance_date, 1, status, remarks, created_at, updated_at FROM attendance;
          DROP TABLE attendance;
          ALTER TABLE attendance_new RENAME TO attendance;
          CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
          CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
          PRAGMA foreign_keys=ON;
        `;
      })()
    },
    {
      name: '024_period_times',
      sql: `
        CREATE TABLE IF NOT EXISTS period_times (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period_number INTEGER NOT NULL UNIQUE,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL
        );
        INSERT OR IGNORE INTO period_times (period_number, start_time, end_time) VALUES
          (1, '07:15', '08:00'),
          (2, '08:00', '08:45'),
          (3, '09:15', '10:00'),
          (4, '10:00', '10:45'),
          (5, '10:45', '11:30'),
          (6, '11:30', '12:15'),
          (7, '14:00', '14:45');
      `
    },
  ];

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    bsql.exec(migration.sql);
    bsql.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(migration.name);
  }

  // Ensure seed teacher records and user accounts exist
  if (!bsql.prepare("SELECT id FROM teachers WHERE email = 'middle.teacher@school.com'").get()) {
    bsql.prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?,?,?,?,?,?)").run('T-MID-SEED', 'أحمد', 'المعلم', 'middle.teacher@school.com', 'middle', 'active');
  }
  if (!bsql.prepare("SELECT id FROM teachers WHERE email = 'high.teacher@school.com'").get()) {
    bsql.prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?,?,?,?,?,?)").run('T-HIGH-SEED', 'محمد', 'المعلم', 'high.teacher@school.com', 'high', 'active');
  }
  // Pre-hashed teacher123 so applyMigrations stays sync
  const seedTeacherPass = '$2a$10$UZGKNrF.yoZ9WFCtmKBcIuG57hHQFwhd1WX2HUWeB3lH3qxVlO2b6';
  const seedTeacherAccounts: { email: string; role: string }[] = [
    { email: 'middle.teacher@school.com', role: 'middle_teacher' },
    { email: 'high.teacher@school.com', role: 'high_teacher' },
  ];
  for (const { email, role } of seedTeacherAccounts) {
    const t = bsql.prepare("SELECT id FROM teachers WHERE email = ?").get(email) as any;
    if (!t) continue;
    const existing = bsql.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
    let uid: number;
    if (!existing) {
      const r = bsql.prepare("INSERT INTO users (email, password, role, teacher_id) VALUES (?,?,?,?)").run(email, seedTeacherPass, role, t.id);
      uid = r.lastInsertRowid as number;
    } else {
      uid = existing.id;
    }
    bsql.prepare("UPDATE teachers SET user_id = ? WHERE id = ?").run(uid, t.id);
    bsql.prepare("UPDATE users SET teacher_id = ? WHERE id = ?").run(t.id, uid);
  }

  // Seed classes if empty
  const classCnt = (bsql.prepare("SELECT COUNT(*) as cnt FROM classes WHERE status = 'active'").get() as any)?.cnt;
  bsql.pragma('foreign_keys = OFF');
  if (!classCnt) {
    bsql.prepare(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ` +
      `('1/أ','الصف الأول الثانوي','أ','101',30,'active'),('1/ب','الصف الأول الثانوي','ب','102',30,'active'),('1/ت','الصف الأول الثانوي','ت','103',30,'active'),('1/ث','الصف الأول الثانوي','ث','104',30,'active'),('1/ج','الصف الأول الثانوي','ج','105',30,'active'),('1/ح','الصف الأول الثانوي','ح','106',30,'active'),('1/خ','الصف الأول الثانوي','خ','107',30,'active'),` +
      `('2/أ','الصف الثاني الثانوي','أ','201',30,'active'),('2/ب','الصف الثاني الثانوي','ب','202',30,'active'),('2/ت','الصف الثاني الثانوي','ت','203',30,'active'),('2/ث','الصف الثاني الثانوي','ث','204',30,'active'),('2/ج','الصف الثاني الثانوي','ج','205',30,'active'),('2/ح','الصف الثاني الثانوي','ح','206',30,'active'),('2/خ','الصف الثاني الثانوي','خ','207',30,'active'),` +
      `('3/أ','الصف الثالث الثانوي','أ','301',30,'active'),('3/ب','الصف الثالث الثانوي','ب','302',30,'active'),('3/ت','الصف الثالث الثانوي','ت','303',30,'active'),('3/ث','الصف الثالث الثانوي','ث','304',30,'active'),('3/ج','الصف الثالث الثانوي','ج','305',30,'active'),('3/ح','الصف الثالث الثانوي','ح','306',30,'active'),` +
      `('1/أ','الصف الأول المتوسط','أ','401',30,'active'),('1/ب','الصف الأول المتوسط','ب','402',30,'active'),('1/ت','الصف الأول المتوسط','ت','403',30,'active'),('1/ث','الصف الأول المتوسط','ث','404',30,'active'),('1/ج','الصف الأول المتوسط','ج','405',30,'active'),('1/ح','الصف الأول المتوسط','ح','406',30,'active'),('1/خ','الصف الأول المتوسط','خ','407',30,'active'),` +
      `('2/أ','الصف الثاني المتوسط','أ','501',30,'active'),('2/ب','الصف الثاني المتوسط','ب','502',30,'active'),('2/ت','الصف الثاني المتوسط','ت','503',30,'active'),('2/ث','الصف الثاني المتوسط','ث','504',30,'active'),('2/ج','الصف الثاني المتوسط','ج','505',30,'active'),('2/ح','الصف الثاني المتوسط','ح','506',30,'active'),('2/خ','الصف الثاني المتوسط','خ','507',30,'active'),` +
      `('3/أ','الصف الثالث المتوسط','أ','601',30,'active'),('3/ب','الصف الثالث المتوسط','ب','602',30,'active'),('3/ت','الصف الثالث المتوسط','ت','603',30,'active'),('3/ث','الصف الثالث المتوسط','ث','604',30,'active'),('3/ج','الصف الثالث المتوسط','ج','605',30,'active'),('3/ح','الصف الثالث المتوسط','ح','606',30,'active')`).run();
    bsql.pragma('foreign_keys = ON');
  }

  // Seed management positions
  const posCnt = (bsql.prepare("SELECT COUNT(*) as cnt FROM management_positions").get() as any)?.cnt;
  if (!posCnt) {
    bsql.prepare("INSERT INTO management_positions (title, school) VALUES (?,?)").run('وكيل المرحلة', 'middle');
    bsql.prepare("INSERT INTO management_positions (title, school) VALUES (?,?)").run('وكيل المرحلة', 'high');
  }

  // Auto-assign وكيل المرحلة to management staff if no assignments exist
  const assignCnt = (bsql.prepare("SELECT COUNT(*) as cnt FROM management_position_assignments").get() as any)?.cnt;
  if (!assignCnt) {
    const midPos = bsql.prepare("SELECT id FROM management_positions WHERE title = 'وكيل المرحلة' AND school = 'middle'").get() as any;
    const hiPos = bsql.prepare("SELECT id FROM management_positions WHERE title = 'وكيل المرحلة' AND school = 'high'").get() as any;
    const mgmtUsers = bsql.prepare("SELECT id, role FROM users WHERE role NOT IN ('admin', 'middle_teacher', 'high_teacher')").all() as any[];
    for (const u of mgmtUsers) {
      const pos = u.role.includes('high') ? hiPos : midPos;
      if (pos) bsql.prepare("INSERT OR IGNORE INTO management_position_assignments (position_id, user_id) VALUES (?,?)").run(pos.id, u.id);
    }
  }

  // Performance indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school)',
    'CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status)',
    'CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_teachers_teacher_id ON teachers(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)',
    'CREATE INDEX IF NOT EXISTS idx_students_school ON students(school)',
    'CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade)',
    'CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status)',
    'CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date)',
    'CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_grades_class_id ON grades(class_id)',
    'CREATE INDEX IF NOT EXISTS idx_teacher_reports_teacher_id ON teacher_reports(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_teacher_reports_student_id ON teacher_reports(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_teacher_reports_class_id ON teacher_reports(class_id)',
    'CREATE INDEX IF NOT EXISTS idx_schedules_class_id ON schedules(class_id)',
    'CREATE INDEX IF NOT EXISTS idx_schedules_teacher_id ON schedules(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day_of_week)',
    'CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)',
    'CREATE INDEX IF NOT EXISTS idx_substitutions_date ON substitutions(date)',
    'CREATE INDEX IF NOT EXISTS idx_substitutions_absent ON substitutions(absent_teacher_id)',
  ];
  for (const idx of indexes) {
    try { bsql.exec(idx); } catch {}
  }

  bsql.pragma('foreign_keys = ON');
}

function createMockAdapter(): DbAdapter {
  console.warn('[DB] Using mock adapter (build-only)');
  return {
    prepare() {
      return {
        get: async () => null,
        all: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    },
    exec: async () => {},
    transaction(fn: (...args: any[]) => any) {
      return async (...args: any[]) => fn(...args);
    },
    close: () => {},
  };
}

function createLocalLibsqlAdapter(): DbAdapter {
  let realClient: any = null;
  let realAdapter: DbAdapter | null = null;
  let initPromise: Promise<void> | null = null;

  async function ensureInit() {
    if (realAdapter) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const dbPath = findDbPath();
      realClient = createClient({ url: toFileUrl(dbPath) });
      await realClient.execute('SELECT 1 as ok');
      realAdapter = createLibsqlAdapter(realClient);
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
    return initPromise;
  }

  function ensureAdapter(): DbAdapter {
    if (!realAdapter) throw new Error('Local libsql adapter not initialized');
    return realAdapter;
  }

  return {
    prepare(sql: string) {
      return {
        get: async (...args: any[]) => {
          await ensureInit();
          return ensureAdapter().prepare(sql).get(...args);
        },
        all: async (...args: any[]) => {
          await ensureInit();
          return ensureAdapter().prepare(sql).all(...args);
        },
        run: async (...args: any[]) => {
          await ensureInit();
          return ensureAdapter().prepare(sql).run(...args);
        },
      };
    },
    exec: async (sql: string) => {
      await ensureInit();
      return ensureAdapter().exec(sql);
    },
    transaction(fn: (...args: any[]) => any) {
      return async (...args: any[]) => {
        await ensureInit();
        return ensureAdapter().transaction(fn)(...args);
      };
    },
    close: () => { if (realClient) realClient.close(); },
  };
}

function initDb(): DbAdapter {
  if (process.env.TURSO_DB_URL && process.env.TURSO_DB_TOKEN) {
    return createTursoAdapter();
  }
  // Try better-sqlite3 first (fastest, but may be blocked by App Control on Windows)
  try {
    const Database = require('better-sqlite3');
    const dbPath = findDbPath();
    const bsql = new Database(dbPath);
    bsql.pragma('foreign_keys = ON');
    const adapter = createBetterSqlite3Adapter(bsql);
    applyMigrations(bsql);
    return adapter;
  } catch (e: any) {
    console.warn('[DB] better-sqlite3 unavailable:', e?.message || e);
  }
  // Fall back to @libsql/client with local file (uses native addon not blocked by App Control)
  try {
    const adapter = createLocalLibsqlAdapter();
    usingLocalLibsql = true;
    console.warn('[DB] Using @libsql/client local file adapter');
    return adapter;
  } catch (e: any) {
    console.warn('[DB] @libsql/client local adapter failed:', e?.message || e);
  }
  console.warn('[DB] All database backends failed, using mock adapter');
  return createMockAdapter();
}

let tursoReady = false;
let tursoReadyPromise: Promise<void> | null = null;
let usingLocalLibsql = false;
let localLibsqlReady = false;
let localLibsqlReadyPromise: Promise<void> | null = null;

let db: DbAdapter = initDb();

async function ensureTursoReady() {
  if (tursoReady) return;
  if (process.env.TURSO_DB_URL && process.env.TURSO_DB_TOKEN) {
    if (tursoReadyPromise) return tursoReadyPromise;
    const p = _ensureTursoReady().then(() => {
      tursoReady = true;
    }).catch(() => {});
    tursoReadyPromise = p;
    return p;
  }
  if (usingLocalLibsql && !localLibsqlReady) {
    if (localLibsqlReadyPromise) return localLibsqlReadyPromise;
    localLibsqlReadyPromise = _ensureTursoReady().then(() => {
      localLibsqlReady = true;
    }).catch(() => {});
    return localLibsqlReadyPromise;
  }
}

async function _ensureTursoReady() {
  try {
    // Performance pragmas (wrap each in try-catch for read-only FS like Vercel)
    try { await db.exec(`PRAGMA journal_mode=WAL`); } catch {}
    try { await db.exec(`PRAGMA cache_size=-20000`); } catch {}
    try { await db.exec(`PRAGMA synchronous=NORMAL`); } catch {}

    // Detect read-only FS: if _init_done can't be created, skip all heavy init
    try { await db.exec(`CREATE TABLE IF NOT EXISTS _init_done (flag INTEGER PRIMARY KEY)`); } catch {
      // _init_done table can't be created (read-only FS) — skip table creation & seed
      return;
    }

    // Ensure period_times exists (no-op if already created)
    try { await db.exec(`CREATE TABLE IF NOT EXISTS period_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_number INTEGER NOT NULL UNIQUE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    )`); } catch {}
    try { await db.exec(`INSERT OR IGNORE INTO period_times (period_number, start_time, end_time) VALUES
      (1, '07:15', '08:00'), (2, '08:00', '08:45'), (3, '09:15', '10:00'),
      (4, '10:00', '10:45'), (5, '10:45', '11:30'), (6, '11:30', '12:15'),
      (7, '14:00', '14:45')`); } catch {}

    const done = await db.prepare("SELECT 1 FROM _init_done WHERE flag = 1").get().catch(() => null) as any;
    if (done) { return; }

    await db.exec(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      title TEXT NOT NULL, message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('urgent','info','warning')),
      link TEXT, is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS substitutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL,
      absent_teacher_id INTEGER NOT NULL, substitute_teacher_id INTEGER,
      schedule_id INTEGER NOT NULL, subject TEXT NOT NULL,
      class_id INTEGER NOT NULL, day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, reason TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
      created_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      school TEXT NOT NULL CHECK (school IN ('middle', 'high')),
      sessions_per_week INTEGER NOT NULL DEFAULT 3,
      grade TEXT,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    try { await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`); } catch {}
    try { await db.exec(`ALTER TABLE subjects ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL`); } catch {}
    await db.exec(`CREATE TABLE IF NOT EXISTS management_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      school TEXT NOT NULL CHECK (school IN ('middle', 'high')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS management_position_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position_id INTEGER NOT NULL REFERENCES management_positions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(position_id, user_id)
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.exec(`PRAGMA foreign_keys=OFF`);
    await db.exec(`CREATE TABLE IF NOT EXISTS teachers (
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
      school TEXT DEFAULT 'middle' CHECK (school IN ('middle', 'high')),
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','middle_supervisor','high_supervisor','middle_teacher','high_teacher','middle_counselor','high_counselor','middle_principal','high_principal','middle_monitor','high_monitor','middle_admin_staff','high_admin_staff')),
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      custom_permissions TEXT,
      teacher_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      parent_email TEXT,
      parent_phone TEXT,
      parent_phones TEXT DEFAULT '[]',
      photo_url TEXT,
      enrollment_date DATE,
      semester TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      school TEXT DEFAULT 'middle' CHECK (school IN ('middle', 'high')),
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      enrollment_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'graduated')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_id)
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      period INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'escape')),
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_id, attendance_date, period)
    )`);

    // Migrate existing attendance tables that lack period column
    try {
      const attCols = await db.prepare("PRAGMA table_info(attendance)").all() as any[];
      const periodCol = attCols.find((c: any) => c.name === 'period');
      if (!periodCol) {
        await db.exec(`DROP TABLE IF EXISTS attendance_old`);
        await db.exec(`PRAGMA foreign_keys=OFF`);
        await db.exec(`CREATE TABLE attendance_old AS SELECT * FROM attendance`);
        await db.exec(`DROP TABLE IF EXISTS attendance`);
        await db.exec(`CREATE TABLE attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          attendance_date DATE NOT NULL,
          period INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'escape')),
          remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, class_id, attendance_date, period)
        )`);
        await db.exec(`INSERT OR IGNORE INTO attendance (id, student_id, class_id, attendance_date, period, status, remarks, created_at, updated_at)
          SELECT id, student_id, class_id, attendance_date, 1, status, remarks, created_at, updated_at FROM attendance_old`);
        await db.exec(`DROP TABLE IF EXISTS attendance_old`);
        await db.exec(`PRAGMA foreign_keys=ON`);
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_t_attendance_class_id ON attendance(class_id)`);
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_t_attendance_date ON attendance(attendance_date)`);
      }
    } catch {}

    await db.exec(`CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      assessment_type TEXT NOT NULL CHECK (assessment_type IN ('test', 'quiz', 'assignment', 'midterm', 'final')),
      score REAL NOT NULL,
      total_score REAL DEFAULT 100,
      weight REAL DEFAULT 1,
      assessment_date DATE,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'teachers', 'students', 'parents', 'class')),
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      published_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'personal', 'emergency', 'annual')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS teacher_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL CHECK (report_type IN ('activity', 'positive', 'behavioral', 'academic_deficiency')),
      title TEXT,
      content TEXT NOT NULL,
      date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      day_of_week TEXT NOT NULL CHECK (day_of_week IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room_number TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.exec(`PRAGMA foreign_keys=ON`);

    // Counseling tables (always attempt to create, even if _init_done already ran)
    try { await db.exec(`CREATE TABLE IF NOT EXISTS counseling_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      domain TEXT NOT NULL CHECK (domain IN ('academic','psychological','guidance','community')),
      description TEXT, goals TEXT, target_group TEXT,
      start_date DATE, end_date DATE,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch {}
    try { await db.exec(`CREATE TABLE IF NOT EXISTS counseling_attendance_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      report_type TEXT NOT NULL CHECK (report_type IN ('absence','behavior','academic','general')),
      description TEXT NOT NULL, actions_taken TEXT, follow_up TEXT,
      status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
      counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch {}
    try { await db.exec(`CREATE TABLE IF NOT EXISTS counseling_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      case_type TEXT NOT NULL CHECK (case_type IN ('academic','behavioral','psychological','social','career')),
      title TEXT NOT NULL, background TEXT, analysis TEXT,
      intervention TEXT, outcome TEXT, recommendations TEXT,
      status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','referred')),
      counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch {}
    try { await db.exec(`CREATE TABLE IF NOT EXISTS counseling_behavior_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      title TEXT NOT NULL, terms TEXT NOT NULL,
      start_date DATE DEFAULT CURRENT_DATE, end_date DATE,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','breached','cancelled')),
      student_signed INTEGER DEFAULT 0, parent_signed INTEGER DEFAULT 0,
      counselor_signed INTEGER DEFAULT 0,
      counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch {}
    try { await db.exec(`CREATE TABLE IF NOT EXISTS counseling_behavior_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      issue_type TEXT NOT NULL CHECK (issue_type IN ('violence','bullying','disruption','cyber','absence','other')),
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
      actions_taken TEXT,
      status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
      counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch {}

    try { await db.exec(`ALTER TABLE users ADD COLUMN teacher_id INTEGER`); } catch {}
    try { await db.exec(`UPDATE users SET teacher_id = (SELECT id FROM teachers WHERE teachers.user_id = users.id) WHERE EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id = users.id)`); } catch {}

    try { await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`); } catch {}
    try { await db.exec(`ALTER TABLE subjects ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL`); } catch {}

    try { await db.exec(`ALTER TABLE students ADD COLUMN semester TEXT DEFAULT ''`); } catch {}
    try { await db.exec(`ALTER TABLE students ADD COLUMN parent_phones TEXT DEFAULT '[]'`); } catch {}
    try { await db.exec(`ALTER TABLE students ADD COLUMN school TEXT DEFAULT 'middle'`); } catch {}
    try { await db.exec(`ALTER TABLE students ADD COLUMN grade TEXT DEFAULT ''`); } catch {}

    try {
      await db.exec(`CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_name TEXT NOT NULL,
        grade TEXT NOT NULL,
        section TEXT,
        teacher_id INTEGER,
        room_number TEXT,
        capacity INTEGER DEFAULT 30,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(class_name, grade, section)
      )`);
    } catch {}

    try {
      const cols = await db.prepare("PRAGMA table_info(classes)").all() as any[];
      const teacherCol = cols.find((c: any) => c.name === 'teacher_id');
      if (!teacherCol || teacherCol.notnull !== 0) {
        await db.exec(`DROP TABLE IF EXISTS classes_new`);
        await db.exec(`PRAGMA foreign_keys=OFF`);
        await db.exec(`CREATE TABLE classes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_name TEXT NOT NULL,
          grade TEXT NOT NULL,
          section TEXT,
          teacher_id INTEGER,
          room_number TEXT,
          capacity INTEGER DEFAULT 30,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(class_name, grade, section),
          FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
        )`);
        await db.exec(`INSERT OR IGNORE INTO classes_new SELECT * FROM classes`);
        await db.exec(`DROP TABLE IF EXISTS classes`);
        await db.exec(`ALTER TABLE classes_new RENAME TO classes`);
        await db.exec(`PRAGMA foreign_keys=ON`);
      }
    } catch {}

    const subCnt = (await db.prepare("SELECT COUNT(*) as cnt FROM subjects").get() as any)?.cnt;
    if (!subCnt) {
      await db.exec(`INSERT INTO subjects (name, school, sessions_per_week) VALUES ('القرآن','middle',3),('التوحيد','middle',2),('الفقه','middle',2),('الحديث','middle',2),('اللغة العربية','middle',5),('الرياضيات','middle',5),('العلوم','middle',4),('الاجتماعيات','middle',3),('اللغة الإنجليزية','middle',4),('الحاسب الآلي','middle',2),('التربية البدنية','middle',2),('التربية الفنية','middle',2)`);
      await db.exec(`INSERT INTO subjects (name, school, sessions_per_week) VALUES ('القرآن','high',2),('التوحيد','high',2),('الفقه','high',2),('الحديث','high',1),('اللغة العربية','high',5),('الرياضيات','high',5),('الفيزياء','high',3),('الكيمياء','high',3),('الأحياء','high',3),('اللغة الإنجليزية','high',4),('الحاسب الآلي','high',2),('التربية البدنية','high',2),('التربية الفنية','high',1),('الاجتماعيات','high',2)`);
    }

    const gradeSubCnt = (await db.prepare("SELECT COUNT(*) as cnt FROM subjects WHERE grade IS NOT NULL").get() as any)?.cnt;
    if (!gradeSubCnt) {
      await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','high',5,'الصف الأول الثانوي'),('انجليزي','high',4,'الصف الأول الثانوي'),('كفايات لغوية','high',3,'الصف الأول الثانوي'),('علم بيئة','high',2,'الصف الأول الثانوي'),('فيزياء','high',3,'الصف الأول الثانوي'),('بدنية','high',2,'الصف الأول الثانوي'),('نفسية','high',2,'الصف الأول الثانوي'),('تقنية رقمية','high',2,'الصف الأول الثانوي')`);
      await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','high',5,'الصف الثاني الثانوي'),('حديث','high',2,'الصف الثاني الثانوي'),('توحيد','high',2,'الصف الثاني الثانوي'),('كيمياء','high',3,'الصف الثاني الثانوي'),('أحياء','high',3,'الصف الثاني الثانوي'),('انجليزي','high',4,'الصف الثاني الثانوي'),('تقنية رقمية','high',2,'الصف الثاني الثانوي')`);
      await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','high',5,'الصف الثالث الثانوي'),('انجليزي','high',4,'الصف الثالث الثانوي'),('فيزياء','high',3,'الصف الثالث الثانوي'),('علم الأرض','high',2,'الصف الثالث الثانوي'),('المهارات الحياتية','high',2,'الصف الثالث الثانوي'),('الدراسات الادبية','high',2,'الصف الثالث الثانوي'),('الدراسات النفسية','high',2,'الصف الثالث الثانوي'),('فقه','high',2,'الصف الثالث الثانوي'),('جغرافيا','high',2,'الصف الثالث الثانوي'),('بدنية','high',2,'الصف الثالث الثانوي')`);
      await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','middle',5,'الصف الأول المتوسط'),('علوم','middle',4,'الصف الأول المتوسط'),('انجليزي','middle',4,'الصف الأول المتوسط'),('لغة عربية','middle',5,'الصف الأول المتوسط'),('اجتماعيات','middle',3,'الصف الأول المتوسط'),('قرآن','middle',3,'الصف الأول المتوسط'),('توحيد','middle',2,'الصف الأول المتوسط'),('فقه','middle',2,'الصف الأول المتوسط'),('حديث','middle',2,'الصف الأول المتوسط'),('حاسب آلي','middle',2,'الصف الأول المتوسط'),('بدنية','middle',2,'الصف الأول المتوسط'),('فنية','middle',2,'الصف الأول المتوسط')`);
      await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','middle',5,'الصف الثاني المتوسط'),('علوم','middle',4,'الصف الثاني المتوسط'),('انجليزي','middle',4,'الصف الثاني المتوسط'),('لغة عربية','middle',5,'الصف الثاني المتوسط'),('اجتماعيات','middle',3,'الصف الثاني المتوسط'),('قرآن','middle',3,'الصف الثاني المتوسط'),('توحيد','middle',2,'الصف الثاني المتوسط'),('فقه','middle',2,'الصف الثاني المتوسط'),('حديث','middle',2,'الصف الثاني المتوسط'),('حاسب آلي','middle',2,'الصف الثاني المتوسط'),('بدنية','middle',2,'الصف الثاني المتوسط'),('فنية','middle',2,'الصف الثاني المتوسط')`);
      await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','middle',5,'الصف الثالث المتوسط'),('علوم','middle',4,'الصف الثالث المتوسط'),('انجليزي','middle',4,'الصف الثالث المتوسط'),('لغة عربية','middle',5,'الصف الثالث المتوسط'),('اجتماعيات','middle',3,'الصف الثالث المتوسط'),('قرآن','middle',3,'الصف الثالث المتوسط'),('توحيد','middle',2,'الصف الثالث المتوسط'),('فقه','middle',2,'الصف الثالث المتوسط'),('حديث','middle',2,'الصف الثالث المتوسط'),('حاسب آلي','middle',2,'الصف الثالث المتوسط'),('بدنية','middle',2,'الصف الثالث المتوسط'),('فنية','middle',2,'الصف الثالث المتوسط')`);
    }

    // Ensure seed teacher records exist before class seed
    const midSeedTeacher = await db.prepare("SELECT id FROM teachers WHERE email = 'middle.teacher@school.com'").get() as any;
    if (!midSeedTeacher) {
      await db.prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?,?,?,?,?,?)").run('T-MID-SEED', 'أحمد', 'المعلم', 'middle.teacher@school.com', 'middle', 'active');
    }
    const highSeedTeacher = await db.prepare("SELECT id FROM teachers WHERE email = 'high.teacher@school.com'").get() as any;
    if (!highSeedTeacher) {
      await db.prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?,?,?,?,?,?)").run('T-HIGH-SEED', 'محمد', 'المعلم', 'high.teacher@school.com', 'high', 'active');
    }

    await db.exec(`PRAGMA foreign_keys=OFF`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ('1/أ','الصف الأول الثانوي','أ','101',30,'active'),('1/ب','الصف الأول الثانوي','ب','102',30,'active'),('1/ت','الصف الأول الثانوي','ت','103',30,'active'),('1/ث','الصف الأول الثانوي','ث','104',30,'active'),('1/ج','الصف الأول الثانوي','ج','105',30,'active'),('1/ح','الصف الأول الثانوي','ح','106',30,'active'),('1/خ','الصف الأول الثانوي','خ','107',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ('2/أ','الصف الثاني الثانوي','أ','201',30,'active'),('2/ب','الصف الثاني الثانوي','ب','202',30,'active'),('2/ت','الصف الثاني الثانوي','ت','203',30,'active'),('2/ث','الصف الثاني الثانوي','ث','204',30,'active'),('2/ج','الصف الثاني الثانوي','ج','205',30,'active'),('2/ح','الصف الثاني الثانوي','ح','206',30,'active'),('2/خ','الصف الثاني الثانوي','خ','207',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ('3/أ','الصف الثالث الثانوي','أ','301',30,'active'),('3/ب','الصف الثالث الثانوي','ب','302',30,'active'),('3/ت','الصف الثالث الثانوي','ت','303',30,'active'),('3/ث','الصف الثالث الثانوي','ث','304',30,'active'),('3/ج','الصف الثالث الثانوي','ج','305',30,'active'),('3/ح','الصف الثالث الثانوي','ح','306',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ('1/أ','الصف الأول المتوسط','أ','401',30,'active'),('1/ب','الصف الأول المتوسط','ب','402',30,'active'),('1/ت','الصف الأول المتوسط','ت','403',30,'active'),('1/ث','الصف الأول المتوسط','ث','404',30,'active'),('1/ج','الصف الأول المتوسط','ج','405',30,'active'),('1/ح','الصف الأول المتوسط','ح','406',30,'active'),('1/خ','الصف الأول المتوسط','خ','407',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ('2/أ','الصف الثاني المتوسط','أ','501',30,'active'),('2/ب','الصف الثاني المتوسط','ب','502',30,'active'),('2/ت','الصف الثاني المتوسط','ت','503',30,'active'),('2/ث','الصف الثاني المتوسط','ث','504',30,'active'),('2/ج','الصف الثاني المتوسط','ج','505',30,'active'),('2/ح','الصف الثاني المتوسط','ح','506',30,'active'),('2/خ','الصف الثاني المتوسط','خ','507',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, room_number, capacity, status) VALUES ('3/أ','الصف الثالث المتوسط','أ','601',30,'active'),('3/ب','الصف الثالث المتوسط','ب','602',30,'active'),('3/ت','الصف الثالث المتوسط','ت','603',30,'active'),('3/ث','الصف الثالث المتوسط','ث','604',30,'active'),('3/ج','الصف الثالث المتوسط','ج','605',30,'active'),('3/ح','الصف الثالث المتوسط','ح','606',30,'active')`);
    await db.exec(`PRAGMA foreign_keys=ON`);

    try { await db.exec(`CREATE TABLE IF NOT EXISTS subject_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      sessions_per_week INTEGER NOT NULL DEFAULT 0,
      UNIQUE(subject_id, class_id)
    )`); } catch {}

    try { await db.exec(`CREATE TABLE IF NOT EXISTS period_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_number INTEGER NOT NULL UNIQUE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    )`); } catch {}
    await db.exec(`INSERT OR IGNORE INTO period_times (period_number, start_time, end_time) VALUES
      (1, '07:15', '08:00'),
      (2, '08:00', '08:45'),
      (3, '09:15', '10:00'),
      (4, '10:00', '10:45'),
      (5, '10:45', '11:30'),
      (6, '11:30', '12:15'),
      (7, '14:00', '14:45')`);

    const seedAdminEmail = process.env.ADMIN_EMAIL || 'admin@school.com';
    const seedAdminPass = process.env.ADMIN_PASSWORD ? await bcrypt.hash(process.env.ADMIN_PASSWORD, 10) : await bcrypt.hash('admin123', 10);
    const seedTeacherPass = process.env.TEACHER_PASSWORD ? await bcrypt.hash(process.env.TEACHER_PASSWORD, 10) : await bcrypt.hash('teacher123', 10);
    const users: [string, string, string][] = [
      [seedAdminEmail, seedAdminPass, 'admin'],
      ['middle.teacher@school.com', seedTeacherPass, 'middle_teacher'],
      ['high.teacher@school.com', seedTeacherPass, 'high_teacher'],
    ];
    try {
      await db.prepare("INSERT INTO users (email, password, role) VALUES ('__test_monitor__', '__test__', 'middle_monitor')").run();
      await db.prepare("DELETE FROM users WHERE email = '__test_monitor__'").run();
    } catch {
      await db.exec(`DROP TABLE IF EXISTS users_new`);
      await db.exec(`PRAGMA foreign_keys=OFF`);
      await db.exec(`CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal', 'middle_monitor', 'high_monitor', 'middle_admin_staff', 'high_admin_staff')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        custom_permissions TEXT,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.exec(`INSERT OR IGNORE INTO users_new (id, email, password, role, status, custom_permissions, teacher_id, created_at, updated_at) SELECT id, email, password, role, status, custom_permissions, teacher_id, created_at, updated_at FROM users`);
      await db.exec(`DROP TABLE IF EXISTS users`);
      await db.exec(`ALTER TABLE users_new RENAME TO users`);
      await db.exec(`PRAGMA foreign_keys=ON`);
    }

    for (const [email, hash, role] of users) {
      const existing = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE email = ?").get(email) as any;
      if (!existing?.cnt) {
        await db.prepare("INSERT INTO users (email, password, role) VALUES (?,?,?)").run(email, hash, role);
      }
    }

    // Link seed teacher user accounts to their teacher records
    for (const email of ['middle.teacher@school.com', 'high.teacher@school.com']) {
      const u = await db.prepare("SELECT id FROM users WHERE email = ? AND teacher_id IS NULL").get(email) as any;
      if (u) {
        const t = await db.prepare("SELECT id FROM teachers WHERE email = ?").get(email) as any;
        if (t) {
          await db.prepare("UPDATE teachers SET user_id = ? WHERE id = ?").run(u.id, t.id);
          await db.prepare("UPDATE users SET teacher_id = ? WHERE id = ?").run(t.id, u.id);
        }
      }
    }

    // Seed management positions
    const posCnt = (await db.prepare("SELECT COUNT(*) as cnt FROM management_positions").get() as any)?.cnt;
    if (!posCnt) {
      await db.prepare("INSERT INTO management_positions (title, school) VALUES (?,?)").run('وكيل المرحلة', 'middle');
      await db.prepare("INSERT INTO management_positions (title, school) VALUES (?,?)").run('وكيل المرحلة', 'high');
    }

    // Auto-assign وكيل المرحلة to management staff if no assignments exist
    const assignCnt = (await db.prepare("SELECT COUNT(*) as cnt FROM management_position_assignments").get() as any)?.cnt;
    if (!assignCnt) {
      const midPos = await db.prepare("SELECT id FROM management_positions WHERE title = 'وكيل المرحلة' AND school = 'middle'").get() as any;
      const hiPos = await db.prepare("SELECT id FROM management_positions WHERE title = 'وكيل المرحلة' AND school = 'high'").get() as any;
      const mgmtUsers = await db.prepare("SELECT id, role FROM users WHERE role NOT IN ('admin', 'middle_teacher', 'high_teacher')").all() as any[];
      for (const u of mgmtUsers) {
        const pos = u.role.includes('high') ? hiPos : midPos;
        if (pos) await db.prepare("INSERT OR IGNORE INTO management_position_assignments (position_id, user_id) VALUES (?,?)").run(pos.id, u.id);
      }
    }

    // Performance indexes
    const idxCmds = [
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school)',
      'CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status)',
      'CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_teachers_teacher_id ON teachers(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)',
      'CREATE INDEX IF NOT EXISTS idx_students_school ON students(school)',
      'CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade)',
      'CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status)',
      'CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date)',
      'CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_grades_class_id ON grades(class_id)',
      'CREATE INDEX IF NOT EXISTS idx_teacher_reports_teacher_id ON teacher_reports(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_teacher_reports_student_id ON teacher_reports(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_teacher_reports_class_id ON teacher_reports(class_id)',
      'CREATE INDEX IF NOT EXISTS idx_schedules_class_id ON schedules(class_id)',
      'CREATE INDEX IF NOT EXISTS idx_schedules_teacher_id ON schedules(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day_of_week)',
      'CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)',
      'CREATE INDEX IF NOT EXISTS idx_substitutions_date ON substitutions(date)',
      'CREATE INDEX IF NOT EXISTS idx_substitutions_absent ON substitutions(absent_teacher_id)',
    ];
    for (const cmd of idxCmds) {
      try { await db.exec(cmd); } catch (e: any) { console.error('Index creation error:', e?.message); }
    }
    await db.prepare("INSERT OR IGNORE INTO _init_done (flag) VALUES (1)").run();
    tursoReady = true;
  } catch (e: any) {
    console.error('_ensureTursoReady failed:', e?.message, e?.stack);
  }
}

export async function getOrCreateTeacher(user: { id: number; email: string; role: string }): Promise<number | null> {
  let teacher = await db.prepare('SELECT COALESCE(u.teacher_id, t.id) as id FROM users u LEFT JOIN teachers t ON t.user_id = u.id WHERE u.id = ?').get(user.id) as any;
  if (!teacher?.id) {
    teacher = await db.prepare('SELECT id FROM teachers WHERE email = ?').get(user.email) as any;
  }
  if (!teacher?.id) {
    try {
      const name = user.email.includes('@') ? user.email.split('@')[0] : user.email;
      const school = user.role.startsWith('middle_') ? 'middle' : 'high';
      const tid = `${school === 'middle' ? 'M' : 'H'}-${name.toUpperCase()}`;
      const r = await db.prepare('INSERT INTO teachers (teacher_id, user_id, first_name, last_name, email, school, status) VALUES (?,?,?,?,?,?,?)').run(tid, user.id, name, name, user.email, school, 'active');
      await db.prepare('UPDATE users SET teacher_id = ? WHERE id = ?').run(Number(r.lastInsertRowid), user.id);
      teacher = { id: Number(r.lastInsertRowid) };
    } catch (e) {
      console.error('Failed to auto-create teacher record:', e);
      return null;
    }
  }
  return teacher.id;
}

export function getDbStatus() {
  let dbPath = '';
  try { dbPath = findDbPath(); } catch {}
  let writable = false;
  try { fs.accessSync(dbPath, fs.constants.W_OK); writable = true; } catch {}
  let adapterName = 'unknown';
  try {
    require.resolve('better-sqlite3');
    adapterName = 'better-sqlite3';
  } catch {
    try {
      require.resolve('@libsql/client');
      adapterName = '@libsql/client';
    } catch {
      adapterName = 'mock';
    }
  }
  return {
    adapter: adapterName,
    usingLocalLibsql,
    localLibsqlReady,
    tursoReady,
    dbPath,
    writable,
  };
}

export default db;
export { ensureTursoReady };
