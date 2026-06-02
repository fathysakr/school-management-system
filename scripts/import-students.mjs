import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'Data');
const outputDir = path.join(__dirname, '..');

const sectionMap = { '1':'أ','2':'ب','3':'ت','4':'ث','5':'ج','6':'ح','7':'خ' };
const arabicNums = { 'أ':1,'ب':2,'ت':3,'ث':4,'ج':5,'ح':6,'خ':7 };

function gradeFromFile(filename) {
  if (filename.includes('أول')) return { en: 'الصف الأول الثانوي', prefix: '1' };
  if (filename.includes('ثاني')) return { en: 'الصف الثاني الثانوي', prefix: '2' };
  if (filename.includes('ثالث')) return { en: 'الصف الثالث الثانوي', prefix: '3' };
  return { en: '', prefix: '' };
}

function splitName(full) {
  full = full.trim();
  const idx = full.indexOf(' ');
  if (idx > 0) return { first_name: full.substring(0, idx).trim(), last_name: full.substring(idx + 1).trim() };
  return { first_name: full, last_name: '' };
}

const files = ['أول ثانوي.xlsx', 'ثاني ثانوي.xlsx'];
const allStudents = [];
const allEnrollments = [];
let totalStudents = 0;

for (const file of files) {
  const wb = XLSX.readFile(path.join(dataDir, file));
  const gradeInfo = gradeFromFile(file);
  const school = 'high';

  for (const sheetName of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    if (data.length < 19) continue;

    // Find header row with م/الفصل/اسم الطالب/رقم الطالب
    let headerRow = -1;
    for (let r = 0; r < data.length; r++) {
      if (String(data[r][23] || '').trim() === 'م') { headerRow = r; break; }
    }
    if (headerRow < 0) continue;

    for (let r = headerRow + 1; r < data.length; r++) {
      const row = data[r];
      const studentId = String(row[21] || '').trim();
      const fullName = String(row[5] || '').trim();
      const sectionRaw = String(row[4] || '').trim();
      if (!studentId || !fullName) continue;

      const { first_name, last_name } = splitName(fullName);
      const sectionLetter = sectionMap[sectionRaw] || sectionRaw;
      const className = `${gradeInfo.prefix}/${sectionLetter}`;

      allStudents.push({
        student_id: studentId,
        first_name,
        last_name,
        date_of_birth: '2007-01-01',
        email: '',
        phone: '',
        address: '',
        parent_phone: '',
        parent_email: '',
        enrollment_date: '2024-09-01',
        school,
        semester: 'الفصل الثاني',
        grade: gradeInfo.en,
        class_name: className,
      });
      totalStudents++;
    }
  }
}

// Generate output: summary + SQL insert file
let output = `# Import Summary
Total students: ${totalStudents}
School: High School (ثانوية)
Semester: الفصل الثاني

## Students per class
`;

const classGroups = {};
for (const s of allStudents) {
  const key = `${s.class_name} (${s.grade})`;
  if (!classGroups[key]) classGroups[key] = [];
  classGroups[key].push(s);
}
for (const [cls, students] of Object.entries(classGroups)) {
  output += `\n### ${cls} — ${students.length} students\n`;
  for (const s of students) {
    output += `  ${s.student_id}  |  ${s.first_name} ${s.last_name}\n`;
  }
}

// Generate SQL for Turso (can be run via Turso CLI or web UI)
let sqlScript = `-- Import students & enrollments for ثانوية صفوة الرواد\n`;
sqlScript += `-- Grade: الصف الأول الثانوي + الصف الثاني الثانوي\n`;
sqlScript += `-- Semester: الفصل الثاني\n\n`;

// First, ensure classes exist
const createdClasses = new Set();
for (const s of allStudents) {
  const key = `${s.grade}|${s.class_name}`;
  if (createdClasses.has(key)) continue;
  createdClasses.add(key);
  const sectionLetter = s.class_name.split('/')[1];
  sqlScript += `INSERT OR IGNORE INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status, school) VALUES ('${s.class_name}', '${s.grade}', '${sectionLetter}', NULL, '', 40, 'active', 'high');\n`;
}
sqlScript += '\n';

for (const s of allStudents) {
  sqlScript += `INSERT OR IGNORE INTO students (student_id, first_name, last_name, date_of_birth, enrollment_date, school, semester, status) VALUES ('${s.student_id}', '${s.first_name}', '${s.last_name}', '${s.date_of_birth}', '${s.enrollment_date}', '${s.school}', '${s.semester}', 'active');\n`;
}
sqlScript += '\n';

for (const s of allStudents) {
  sqlScript += `INSERT OR IGNORE INTO enrollments (student_id, class_id, enrollment_date, status) SELECT s.id, c.id, '${s.enrollment_date}', 'active' FROM students s JOIN classes c ON c.class_name = '${s.class_name}' AND c.grade = '${s.grade}' WHERE s.student_id = '${s.student_id}';\n`;
}

// Also generate the simplified 3-column Excel for web import
const xlsxRows = allStudents.map(s => [s.student_id, `${s.first_name} ${s.last_name}`, s.semester]);
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['رقم الطالب', 'اسم الطالب', 'فصل الطالب'], ...xlsxRows]);
XLSX.utils.book_append_sheet(wb, ws, 'Students');
const xlsxPath = path.join(outputDir, 'للرفع.xlsx');
XLSX.writeFile(wb, xlsxPath);

// Save summary
const summaryPath = path.join(outputDir, 'import-summary.txt');
const sqlPath = path.join(outputDir, 'import-turso.sql');
fs.writeFileSync(summaryPath, output);
fs.writeFileSync(sqlPath, sqlScript);

console.log(`\n=== ✅ تم بنجاح ===`);
console.log(`إجمالي الطلاب: ${totalStudents}`);
console.log(`\nملخص الفصول:`);
for (const [cls, students] of Object.entries(classGroups).sort()) {
  console.log(`  ${cls}: ${students.length} طالب`);
}
console.log(`\nالملفات المولدة:`);
console.log(`  📄 للتوزيع اليدوي: ${summaryPath}`);
console.log(`  📄 SQL لـ Turso: ${sqlPath}`);
console.log(`  📊 للرفع عبر الواجهة: ${xlsxPath}`);
