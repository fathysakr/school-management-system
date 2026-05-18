import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

function findDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  let dir = process.cwd();
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const candidate = path.join(dir, 'data', 'school.db');
      const dataDir = path.join(dir, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = path.join(process.cwd(), 'data', 'school.db');
  const fbDir = path.dirname(fallback);
  if (!fs.existsSync(fbDir)) fs.mkdirSync(fbDir, { recursive: true });
  return fallback;
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

function createBetterSqlite3Adapter(bsql: Database.Database): DbAdapter {
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
          bsql.exec('ROLLBACK');
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
        await client.execute('BEGIN');
        try {
          const result = await fn(...args);
          await client.execute('COMMIT');
          return result;
        } catch (e) {
          await client.execute('ROLLBACK');
          throw e;
        }
      };
    },
    close: () => { client.close(); },
  };
}

function applyMigrations(bsql: Database.Database) {
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
          photo_url TEXT,
          enrollment_date DATE,
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
          status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
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
             photo_url TEXT,
             enrollment_date DATE,
             status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
           );
           INSERT INTO students_new SELECT id, student_id, user_id, first_name, last_name, date_of_birth, email, phone, address, parent_email, parent_phone, photo_url, enrollment_date, status, created_at, updated_at FROM students;
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
            ('رياضيات','high',5,'أول ثانوي'),('انجليزي','high',4,'أول ثانوي'),('كفايات لغوية','high',3,'أول ثانوي'),('علم بيئة','high',2,'أول ثانوي'),('فيزياء','high',3,'أول ثانوي'),('بدنية','high',2,'أول ثانوي'),('نفسية','high',2,'أول ثانوي'),('تقنية رقمية','high',2,'أول ثانوي'),
            ('رياضيات','high',5,'ثاني ثانوي'),('حديث','high',2,'ثاني ثانوي'),('توحيد','high',2,'ثاني ثانوي'),('كيمياء','high',3,'ثاني ثانوي'),('أحياء','high',3,'ثاني ثانوي'),('انجليزي','high',4,'ثاني ثانوي'),('تقنية رقمية','high',2,'ثاني ثانوي'),
            ('رياضيات','high',5,'ثالث ثانوي'),('انجليزي','high',4,'ثالث ثانوي'),('فيزياء','high',3,'ثالث ثانوي'),('علم الأرض','high',2,'ثالث ثانوي'),('المهارات الحياتية','high',2,'ثالث ثانوي'),('الدراسات الادبية','high',2,'ثالث ثانوي'),('الدراسات النفسية','high',2,'ثالث ثانوي'),('فقه','high',2,'ثالث ثانوي'),('جغرافيا','high',2,'ثالث ثانوي'),('بدنية','high',2,'ثالث ثانوي');
        `;
      })()
    },
  ];

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    bsql.exec(migration.sql);
    bsql.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(migration.name);
  }

  bsql.pragma('foreign_keys = ON');
}

let db: DbAdapter;
let tursoReady = false;

async function ensureTursoReady() {
  try {
    if (tursoReady) return;
    if (!process.env.TURSO_DB_URL || !process.env.TURSO_DB_TOKEN) return;
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.exec(`ALTER TABLE users ADD COLUMN teacher_id INTEGER`);
    await db.exec(`UPDATE users SET teacher_id = (SELECT id FROM teachers WHERE teachers.user_id = users.id) WHERE EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id = users.id)`);

    await db.exec(`ALTER TABLE subjects ADD COLUMN grade TEXT`);

    const subCnt = (await db.prepare("SELECT COUNT(*) as cnt FROM subjects").get() as any)?.cnt;
    if (!subCnt) {
      await db.exec(`INSERT INTO subjects (name, school, sessions_per_week) VALUES ('القرآن','middle',3),('التوحيد','middle',2),('الفقه','middle',2),('الحديث','middle',2),('اللغة العربية','middle',5),('الرياضيات','middle',5),('العلوم','middle',4),('الاجتماعيات','middle',3),('اللغة الإنجليزية','middle',4),('الحاسب الآلي','middle',2),('التربية البدنية','middle',2),('التربية الفنية','middle',2)`);
      await db.exec(`INSERT INTO subjects (name, school, sessions_per_week) VALUES ('القرآن','high',2),('التوحيد','high',2),('الفقه','high',2),('الحديث','high',1),('اللغة العربية','high',5),('الرياضيات','high',5),('الفيزياء','high',3),('الكيمياء','high',3),('الأحياء','high',3),('اللغة الإنجليزية','high',4),('الحاسب الآلي','high',2),('التربية البدنية','high',2),('التربية الفنية','high',1),('الاجتماعيات','high',2)`);
    }

    await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','high',5,'أول ثانوي'),('انجليزي','high',4,'أول ثانوي'),('كفايات لغوية','high',3,'أول ثانوي'),('علم بيئة','high',2,'أول ثانوي'),('فيزياء','high',3,'أول ثانوي'),('بدنية','high',2,'أول ثانوي'),('نفسية','high',2,'أول ثانوي'),('تقنية رقمية','high',2,'أول ثانوي')`);
    await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','high',5,'ثاني ثانوي'),('حديث','high',2,'ثاني ثانوي'),('توحيد','high',2,'ثاني ثانوي'),('كيمياء','high',3,'ثاني ثانوي'),('أحياء','high',3,'ثاني ثانوي'),('انجليزي','high',4,'ثاني ثانوي'),('تقنية رقمية','high',2,'ثاني ثانوي')`);
    await db.exec(`INSERT OR IGNORE INTO subjects (name, school, sessions_per_week, grade) VALUES ('رياضيات','high',5,'ثالث ثانوي'),('انجليزي','high',4,'ثالث ثانوي'),('فيزياء','high',3,'ثالث ثانوي'),('علم الأرض','high',2,'ثالث ثانوي'),('المهارات الحياتية','high',2,'ثالث ثانوي'),('الدراسات الادبية','high',2,'ثالث ثانوي'),('الدراسات النفسية','high',2,'ثالث ثانوي'),('فقه','high',2,'ثالث ثانوي'),('جغرافيا','high',2,'ثالث ثانوي'),('بدنية','high',2,'ثالث ثانوي')`);

    let hsTid = 1;
    const hsTeacher = await db.prepare("SELECT id FROM teachers WHERE school = 'high' AND status = 'active' LIMIT 1").get() as any;
    if (hsTeacher) { hsTid = hsTeacher.id; } else {
      const anyTeacher = await db.prepare("SELECT id FROM teachers LIMIT 1").get() as any;
      if (anyTeacher) hsTid = anyTeacher.id;
    }
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status) VALUES ('1/أ','أول ثانوي','أ',${hsTid},'101',30,'active'),('1/ب','أول ثانوي','ب',${hsTid},'102',30,'active'),('1/ت','أول ثانوي','ت',${hsTid},'103',30,'active'),('1/ث','أول ثانوي','ث',${hsTid},'104',30,'active'),('1/ج','أول ثانوي','ج',${hsTid},'105',30,'active'),('1/ح','أول ثانوي','ح',${hsTid},'106',30,'active'),('1/خ','أول ثانوي','خ',${hsTid},'107',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status) VALUES ('2/أ','ثاني ثانوي','أ',${hsTid},'201',30,'active'),('2/ب','ثاني ثانوي','ب',${hsTid},'202',30,'active'),('2/ت','ثاني ثانوي','ت',${hsTid},'203',30,'active'),('2/ث','ثاني ثانوي','ث',${hsTid},'204',30,'active'),('2/ج','ثاني ثانوي','ج',${hsTid},'205',30,'active'),('2/ح','ثاني ثانوي','ح',${hsTid},'206',30,'active'),('2/خ','ثاني ثانوي','خ',${hsTid},'207',30,'active')`);
    await db.exec(`INSERT OR IGNORE INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status) VALUES ('3/أ','ثالث ثانوي','أ',${hsTid},'301',30,'active'),('3/ب','ثالث ثانوي','ب',${hsTid},'302',30,'active'),('3/ت','ثالث ثانوي','ت',${hsTid},'303',30,'active'),('3/ث','ثالث ثانوي','ث',${hsTid},'304',30,'active'),('3/ج','ثالث ثانوي','ج',${hsTid},'305',30,'active'),('3/ح','ثالث ثانوي','ح',${hsTid},'306',30,'active')`);

    const h = { admin:'$2a$04$QpWlATKSbm.yJD5MRt7FquL2XIrvb0foaijQRZGJvEDpCyYlWLfsm', sup:'$2a$04$r/QVAk.Y1yaztIsEeKReaeXCofMmrRhQp74TAl6BsANhU6C8oQL9G', teacher:'$2a$04$M7Xfk/P1o.e6wOQYLZVrQ.DekRYrtV3JVOBZKxB6rVgJJ4J3nyK2u', counselor:'$2a$04$PPYZbxrtd2evEZVcCkE9suySMeMBTa9HLU3XyBWjrFSao4axlRpLy', principal:'$2a$04$2Iju6MqiTgXFRTo6D5hiXe6KGAQCD5r2zRz3hrraJMe7ilB7O7wdC' };
    const users: [string, string, string][] = [
      ['admin@school.com', h.admin, 'admin'],
      ['middle.sup@school.com', h.sup, 'middle_supervisor'],
      ['high.sup@school.com', h.sup, 'high_supervisor'],
      ['middle.teacher@school.com', h.teacher, 'middle_teacher'],
      ['high.teacher@school.com', h.teacher, 'high_teacher'],
      ['middle.counselor@school.com', h.counselor, 'middle_counselor'],
      ['high.counselor@school.com', h.counselor, 'high_counselor'],
      ['middle.principal@school.com', h.principal, 'middle_principal'],
      ['high.principal@school.com', h.principal, 'high_principal'],
    ];
    for (const [email, hash, role] of users) {
      const existing = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE email = ?").get(email) as any;
      if (!existing?.cnt) {
        await db.prepare("INSERT INTO users (email, password, role) VALUES (?,?,?)").run(email, hash, role);
      }
    }
    tursoReady = true;
  } catch {}
}

if (process.env.TURSO_DB_URL && process.env.TURSO_DB_TOKEN) {
  db = createTursoAdapter();
} else {
  const dbPath = findDbPath();
  const bsql = new Database(dbPath);
  bsql.pragma('foreign_keys = ON');
  db = createBetterSqlite3Adapter(bsql);
  applyMigrations(bsql);
}

export default db;
export { ensureTursoReady };
