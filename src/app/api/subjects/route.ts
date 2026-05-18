import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, serverError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
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
    console.error('Get subjects error:', error);
    return serverError('Failed to fetch subjects');
  }
}
