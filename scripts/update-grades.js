const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join('C:/Users/fathy/OneDrive/Desktop/lapo/school/school-management-system/data/school.db'));

const rows = db.prepare("SELECT id, class_name, grade FROM classes ORDER BY id").all();
console.log('Before:', JSON.stringify(rows, null, 2));

db.prepare("UPDATE classes SET grade = ? WHERE id = ?").run('المتوسطة', 1);
db.prepare("UPDATE classes SET grade = ? WHERE id = ?").run('المتوسطة', 2);
db.prepare("UPDATE classes SET grade = ? WHERE id = ?").run('المتوسطة', 3);
db.prepare("UPDATE classes SET grade = ? WHERE id = ?").run('المتوسطة', 4);
db.prepare("UPDATE classes SET grade = ? WHERE id = ?").run('الثانوية', 5);

const after = db.prepare("SELECT id, class_name, grade FROM classes ORDER BY id").all();
console.log('After:', JSON.stringify(after, null, 2));
db.close();
