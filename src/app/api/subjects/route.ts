import db from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school');
    const grade = searchParams.get('grade');
    let sql = 'SELECT * FROM subjects';
    const params: string[] = [];
    const clauses: string[] = [];
    if (school) { clauses.push('school = ?'); params.push(school); }
    if (grade) { clauses.push('grade = ?'); params.push(grade); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY name';
    const subjects = await db.prepare(sql).all(...params);
    return Response.json({ subjects });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
