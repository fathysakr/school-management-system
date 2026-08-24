import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { sanitizeString } from '@/lib/validation';
import { parseSchedulePdf } from '@/lib/pdf-schedule-parser';

const SCHOOL_MAP: Record<string, string> = { '1': 'middle', '2': 'middle', '3': 'high' };

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:create')) return forbidden();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('الملف مطلوب');
    if (!file.name.toLowerCase().endsWith('.pdf')) return badRequest('يرجى رفع ملف PDF');

    const schoolParam = (formData.get('school') as string) || 'middle';
    if (!['middle', 'high'].includes(schoolParam)) return badRequest('المرحلة غير صحيحة');
    const clearExisting = formData.get('clear_existing') === 'true';
    const pageMappingRaw = formData.get('page_mapping') as string | null;
    let pageMapping: Record<string, number> = {};
    if (pageMappingRaw) {
      try { pageMapping = JSON.parse(pageMappingRaw); } catch { return badRequest('page_mapping غير صالح'); }
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const ptRows = await db.prepare('SELECT period_number, start_time, end_time FROM period_times ORDER BY period_number').all() as any[];
    const periodTimes = ptRows.map((r: any) => ({ start: r.start_time, end: r.end_time }));
    const parsed = await parseSchedulePdf(buffer, periodTimes, false);

    // Teacher-card PDFs carry the real class codes inside every cell,
    // so page mapping is meaningless there and must be ignored.
    const teacherMode = parsed.mode === 'teacher';
    const pageMappingEff = teacherMode ? {} : pageMapping;
    const hasMapping = !teacherMode && Object.keys(pageMapping).length > 0;

    // Override classId based on pageMapping if provided
    if (hasMapping) {
      for (const entry of parsed.entries) {
        const mapped = pageMappingEff[entry.classId];
        if (mapped !== undefined) entry.classId = String(mapped);
      }
    }

    const [existingTeachers, existingClasses, existingSubjects] = await Promise.all([
      db.prepare('SELECT id, first_name, last_name FROM teachers WHERE status = ?').all('active'),
      db.prepare('SELECT id, class_name, grade, section FROM classes WHERE status = ?').all('active'),
      db.prepare('SELECT id, name, school, grade FROM subjects').all(),
    ]) as [any[], any[], any[]];

    const teacherByName = new Map<string, number>();
    for (const t of existingTeachers) {
      const key = `${t.first_name} ${t.last_name}`.trim();
      teacherByName.set(key, t.id);
    }

    // Primary lookup: numeric class_name ("1-5") as printed on teacher cards.
    const classByName = new Map<string, number>();
    for (const c of existingClasses) {
      if (c.class_name) classByName.set(String(c.class_name).trim(), c.id);
    }

    // Legacy fallback: "grade-section" composite key
    const classByKey = new Map<string, number>();
    for (const c of existingClasses) {
      const key = `${c.grade}-${c.section || c.class_name}`;
      classByKey.set(key, c.id);
    }

    const resolveClass = (classId: string): number | undefined =>
      classByName.get(classId.trim()) ?? classByKey.get(classId);

    // Normalize Arabic for matching: strip diacritics/tatweel, unify alef, drop the
    // definite article from every token so "اللغة العربية" matches "لغة عربية"
    const normalizeForMatch = (s: string): string =>
      s.normalize('NFKC')
        .replace(/[\u0640\u064B-\u065F]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((t) => t.replace(/^ال/, ''))
        .filter(Boolean)
        .join(' ');

    interface SubjectCandidate { id: number; name: string; tokens: Set<string> }
    const subjectsBySchool = new Map<string, SubjectCandidate[]>();
    for (const s of existingSubjects) {
      const norm = normalizeForMatch(s.name || '');
      if (!norm) continue;
      const arr = subjectsBySchool.get(s.school) || [];
      arr.push({ id: s.id, name: s.name, tokens: new Set(norm.split(' ')) });
      subjectsBySchool.set(s.school, arr);
    }

    const createdTeachers: number[] = [];
    const createdClasses: number[] = [];
    const createdSubjects: number[] = [];
    let insertedSchedules = 0;
    let skippedExisting = 0;

    if (clearExisting) {
      const forcedStageClear = (process.env.NEXT_PUBLIC_SCHOOL_STAGE || '').trim();
      if (teacherMode && (forcedStageClear === 'middle' || forcedStageClear === 'high')) {
        // Stage-locked deployment: this import defines the whole timetable,
        // so stale rows from earlier cross-stage imports must go too.
        await db.prepare('DELETE FROM schedules').run();
      } else {
        const classIds = new Set<number>();
        if (hasMapping) {
          // Use the mapped class IDs
          for (const val of Object.values(pageMapping)) {
            const id = Number(val);
            if (!isNaN(id)) classIds.add(id);
          }
        } else {
          for (const cls of parsed.classes) {
            const existingId = resolveClass(cls.classId);
            if (existingId) classIds.add(existingId);
          }
        }
        if (classIds.size > 0) {
          const ids = Array.from(classIds);
          const placeholders = ids.map(() => '?').join(',');
          await db.prepare(`DELETE FROM schedules WHERE class_id IN (${placeholders})`).run(...ids);
        }
      }
    }

    const getOrCreateTeacher = async (fullName: string): Promise<number> => {
      const existing = teacherByName.get(fullName);
      if (existing) return existing;

      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(' ') || 'غير محدد';
      const tid = `PDF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const result = await db.prepare(
        'INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(tid, sanitizeString(firstName), sanitizeString(lastName), null, schoolParam, 'active');

      const id = Number(result.lastInsertRowid);
      teacherByName.set(fullName, id);
      createdTeachers.push(id);
      return id;
    };

    const getOrCreateClass = async (classId: string, grade: string): Promise<number> => {
      const existing = resolveClass(classId);
      if (existing) return existing;

      // Store the numeric code as class_name so future imports resolve directly
      const result = await db.prepare(
        'INSERT INTO classes (class_name, grade, section, status) VALUES (?, ?, ?, ?)'
      ).run(classId.trim(), grade || '', null, 'active');

      const id = Number(result.lastInsertRowid);
      classByName.set(classId.trim(), id);
      createdClasses.push(id);
      return id;
    };

    const resolveSubject = (name: string, school: string): SubjectCandidate | null => {
      const norm = normalizeForMatch(name);
      if (!norm) return null;
      const cands = subjectsBySchool.get(school) || [];

      // 1) exact normalized match
      const exact = cands.find((c) => [...c.tokens].join(' ') === norm);
      if (exact) return exact;

      // 2) token-subset match: every PDF token appears in the site subject,
      //    prefer the smallest candidate (closest name)
      const pdfTokens = new Set(norm.split(' '));
      let best: SubjectCandidate | null = null;
      for (const c of cands) {
        const contains = [...pdfTokens].every((t) => c.tokens.has(t));
        if (!contains) continue;
        if (!best || c.tokens.size < best.tokens.size) best = c;
      }
      return best;
    };

    const getOrCreateSubject = async (name: string, school: string): Promise<SubjectCandidate> => {
      const resolved = resolveSubject(name, school);
      if (resolved) return resolved;

      const result = await db.prepare(
        'INSERT INTO subjects (name, school, grade, sessions_per_week) VALUES (?, ?, ?, ?)'
      ).run(sanitizeString(name), school, '', 3);

      const cand: SubjectCandidate = {
        id: Number(result.lastInsertRowid),
        name: sanitizeString(name),
        tokens: new Set(normalizeForMatch(name).split(' ')),
      };
      const arr = subjectsBySchool.get(school) || [];
      arr.push(cand);
      subjectsBySchool.set(school, arr);
      createdSubjects.push(cand.id);
      return cand;
    };

    const insertSchedule = db.prepare(
      `INSERT INTO schedules (class_id, teacher_id, subject, day_of_week, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    );

    const linkSubjectClass = db.prepare(
      'INSERT OR IGNORE INTO subject_classes (subject_id, class_id, sessions_per_week) VALUES (?, ?, ?)'
    );

    const teacherSubjects = new Map<number, Map<string, { sessions: Set<string>; classes: Set<number> }>>();
    const processedPairs = new Set<string>();

    if (hasMapping) {
      // When pageMapping is provided, entries already have DB class_id as their classId
      // Group entries by their mapped classId directly
      const entriesByClass = new Map<string, typeof parsed.entries>();
      for (const entry of parsed.entries) {
        const arr = entriesByClass.get(entry.classId) || [];
        arr.push(entry);
        entriesByClass.set(entry.classId, arr);
      }

      for (const [dbClassIdStr, classEntries] of entriesByClass) {
        const dbClassId = parseInt(dbClassIdStr);
        if (isNaN(dbClassId)) continue;

        for (const entry of classEntries) {
          const teacherId = await getOrCreateTeacher(entry.teacher);
          const school = SCHOOL_MAP[entry.classId] || schoolParam;
          const subj = await getOrCreateSubject(entry.subject, school);

          const pairKey = `${subj.id}:${dbClassId}`;
          if (!processedPairs.has(pairKey)) {
            await linkSubjectClass.run(subj.id, dbClassId, 3);
            processedPairs.add(pairKey);
          }

          if (!clearExisting) {
            const existing = await db.prepare(
              'SELECT id FROM schedules WHERE class_id = ? AND day_of_week = ? AND start_time = ? AND status = ?'
            ).get(dbClassId, entry.day, entry.startTime, 'active') as any;
            if (existing) { skippedExisting++; continue; }
          }

          await insertSchedule.run(dbClassId, teacherId, sanitizeString(subj.name), entry.day, entry.startTime, entry.endTime);
          insertedSchedules++;

          let subMap = teacherSubjects.get(teacherId);
          if (!subMap) { subMap = new Map(); teacherSubjects.set(teacherId, subMap); }
          let subData = subMap.get(subj.name);
          if (!subData) { subData = { sessions: new Set(), classes: new Set() }; subMap.set(entry.subject, subData); }
          subData.sessions.add(`${entry.day}-${entry.startTime}`);
          subData.classes.add(dbClassId);
        }
      }
    } else {
      for (const cls of parsed.classes) {
        const grade = cls.grade;
        const school = SCHOOL_MAP[grade] || schoolParam;
          const dbClassId = await getOrCreateClass(cls.classId, grade);

        for (const entry of parsed.entries.filter(e => e.classId === cls.classId)) {
          const teacherId = await getOrCreateTeacher(entry.teacher);
          const subj = await getOrCreateSubject(entry.subject, school);

          const pairKey = `${subj.id}:${dbClassId}`;
          if (!processedPairs.has(pairKey)) {
            await linkSubjectClass.run(subj.id, dbClassId, 3);
            processedPairs.add(pairKey);
          }

          if (!clearExisting) {
            const existing = await db.prepare(
              'SELECT id FROM schedules WHERE class_id = ? AND day_of_week = ? AND start_time = ? AND status = ?'
            ).get(dbClassId, entry.day, entry.startTime, 'active') as any;
            if (existing) { skippedExisting++; continue; }
          }

          await insertSchedule.run(dbClassId, teacherId, sanitizeString(subj.name), entry.day, entry.startTime, entry.endTime);
          insertedSchedules++;

          let subMap = teacherSubjects.get(teacherId);
          if (!subMap) { subMap = new Map(); teacherSubjects.set(teacherId, subMap); }
          let subData = subMap.get(subj.name);
          if (!subData) { subData = { sessions: new Set(), classes: new Set() }; subMap.set(subj.name, subData); }
          subData.sessions.add(`${entry.day}-${entry.startTime}`);
          subData.classes.add(dbClassId);
        }
      }
    }

    const updateSpec = db.prepare('UPDATE teachers SET specialization = ? WHERE id = ?');
    for (const [tid, subMap] of teacherSubjects) {
      const arr: any[] = [];
      for (const [subName, data] of subMap) {
        arr.push({ n: subName, s: data.sessions.size, classes: Array.from(data.classes) });
      }
      if (arr.length > 0) updateSpec.run(JSON.stringify(arr), tid);
    }

    // ---- Sync المواد الدراسية with the imported schedule ----
    // Every lesson row carries the canonical subject name + the teacher who
    // teaches it. Subjects that no lesson references have no teacher and are
    // removed; scheduled subjects get their primary (most lessons) teacher.
    const schedRows = await db.prepare('SELECT subject, teacher_id FROM schedules').all() as any[];
    const usage = new Map<string, Map<number, number>>();
    for (const r of schedRows) {
      const name = String(r.subject || '').trim();
      if (!name) continue;
      let tmap = usage.get(name);
      if (!tmap) { tmap = new Map(); usage.set(name, tmap); }
      const tid = Number(r.teacher_id);
      if (!isNaN(tid)) tmap.set(tid, (tmap.get(tid) || 0) + 1);
    }

    let removedSubjects = 0;
    let syncedSubjectTeachers = 0;
    const schoolSubjects = await db.prepare(
      'SELECT id, name, teacher_id FROM subjects ORDER BY id ASC'
    ).all() as any[];

    // group subject rows by normalized name so variants/duplicates
    // (e.g. رياضيات vs الرياضيات, per-grade copies) collapse onto one row
    const groups = new Map<string, any[]>();
    for (const s of schoolSubjects) {
      const key = normalizeForMatch(String(s.name || ''));
      let g = groups.get(key);
      if (!g) { g = []; groups.set(key, g); }
      g.push(s);
    }

    const delSubject = async (id: number) => {
      await db.prepare('DELETE FROM subject_classes WHERE subject_id = ?').run(id);
      await db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
    };

    for (const [, rows] of groups) {
      const normKey = normalizeForMatch(String(rows[0].name || ''));
      const exactRow = rows.find(r => usage.has(String(r.name || '').trim()));
      const tmap = (exactRow ? usage.get(String(exactRow.name).trim()) : undefined) || undefined;
      const nUsage = new Map<string, Map<number, number>>();
      for (const [k, v] of usage) {
        const nk = normalizeForMatch(k);
        const cur = nUsage.get(nk);
        if (cur) { for (const [tid, n] of v) cur.set(tid, (cur.get(tid) || 0) + n); }
        else nUsage.set(nk, new Map(v));
      }
      const resolved = tmap || nUsage.get(normKey);
      if (!resolved || resolved.size === 0) {
        for (const r of rows) await delSubject(r.id);
        removedSubjects += rows.length;
        continue;
      }
      const keeper = exactRow || rows[0];
      let bestTid = -1;
      let bestN = -1;
      for (const [tid, n] of resolved) {
        if (n > bestN) { bestN = n; bestTid = tid; }
      }
      if (bestTid !== -1 && Number(keeper.teacher_id) !== bestTid) {
        await db.prepare('UPDATE subjects SET teacher_id = ? WHERE id = ?').run(bestTid, keeper.id);
        syncedSubjectTeachers++;
      }
      for (const r of rows) {
        if (r.id !== keeper.id) { await delSubject(r.id); removedSubjects++; }
      }
    }

    return success({
      message: 'تم استيراد الجدول بنجاح',
      mode: parsed.mode,
      summary: {
        classes: hasMapping ? new Set(Object.values(pageMapping)).size : parsed.classes.length,
        created_classes: createdClasses.length,
        teachers: parsed.teachers.length,
        created_teachers: createdTeachers.length,
        subjects: parsed.subjects.length,
        created_subjects: createdSubjects.length,
        schedules: insertedSchedules,
        skipped_existing: skippedExisting,
        synced_subject_teachers: syncedSubjectTeachers,
        removed_subjects: removedSubjects,
      },
    });
  } catch (error: any) {
    console.error('Upload PDF schedule error:', error);
    const msg = error.message || 'فشل استيراد الجدول من PDF';
    const debugData = error.debugData || null;
    let fullMsg = msg;
    if (debugData) {
      fullMsg += ` (pages: ${debugData.numPages}, items per page: [${(debugData.itemsPerPage || []).join(',')}])`;
      fullMsg += `\n\n--- النص الكامل ---\n${(debugData.textSample || '').substring(0, 5000)}`;
    }
    return Response.json({
      error: fullMsg,
      stack: (error.stack || '').split('\n').slice(0, 10).join('\n'),
      debug: debugData,
    }, { status: 400 });
  }
}
