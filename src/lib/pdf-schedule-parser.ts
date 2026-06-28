import { PDFParse } from 'pdf-parse';

export interface ParsedEntry {
  classId: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
}

export interface ParsedSchedule {
  classes: { classId: string; grade: string; section: string }[];
  subjects: string[];
  teachers: string[];
  entries: ParsedEntry[];
}

const DAY_MAP: Record<string, string> = {
  'احد': 'sunday', 'اثنين': 'monday', 'ثلاثاء': 'tuesday',
  'اربعاء': 'wednesday', 'خميس': 'thursday',
};

const PERIOD_TIMES: { start: string; end: string }[] = [
  { start: '07:15', end: '08:00' },
  { start: '08:00', end: '08:45' },
  { start: '09:15', end: '10:00' },
  { start: '10:00', end: '10:45' },
  { start: '10:45', end: '11:30' },
  { start: '11:30', end: '12:15' },
  { start: '14:00', end: '14:45' },
];

function normalizeArabic(text: string): string {
  return text.normalize('NFKC').replace(/\u06CC/g, '\u064A');
}

function parseCell(cell: string): { subject: string; teacher: string } | null {
  const lines = cell.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) return null;

  if (lines.length === 2) {
    return { subject: lines[0].trim(), teacher: lines[1].trim() };
  }

  if (lines.length === 3) {
    if (/^\d+$/.test(lines[1].trim())) {
      return { subject: lines[0].trim(), teacher: lines[2].trim() };
    }
    return { subject: lines[0].trim() + ' ' + lines[1].trim(), teacher: lines[2].trim() };
  }

  return { subject: lines[0].trim(), teacher: lines[lines.length - 1].trim() };
}

export async function parseSchedulePdf(buffer: Uint8Array): Promise<ParsedSchedule> {
  const instance = new PDFParse(buffer);
  await (instance as any).load();

  const [tablesResult, textResult] = await Promise.all([
    instance.getTable(),
    instance.getText(),
  ]) as any;

  const pages = tablesResult?.pages;
  if (!pages?.length) throw new Error('لم يتم العثور على جداول في ملف PDF');

  const textPages = textResult?.pages || [];

  const entries: ParsedEntry[] = [];
  const subjectsSet = new Set<string>();
  const teachersSet = new Set<string>();
  const classesMap = new Map<string, { grade: string; section: string }>();

  const classIdByNum = new Map<number, string>();
  for (const tp of textPages) {
      const lines = normalizeArabic(tp.text).split('\n').filter((l: string) => l.trim());
    const last = lines[lines.length - 1]?.trim();
    if (last && /^\d+-\d+$/.test(last)) {
      classIdByNum.set(tp.num, last);
    }
  }

  for (const page of pages) {
    const t = page.tables?.[0];
    if (!t || t.length < 6) continue;

    const classId = classIdByNum.get(page.num);
    if (!classId) continue;

    const [grade, section] = classId.split('-');
    if (!classesMap.has(classId)) classesMap.set(classId, { grade, section });

    for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
      const row = t[dayIdx];
      if (!row || row.length < 8) continue;

      const dayLabel = normalizeArabic(row[row.length - 1]?.trim() || '');
      const day = DAY_MAP[dayLabel];
      if (!day) continue;

      for (let colIdx = 0; colIdx < 7; colIdx++) {
        const cell = normalizeArabic(row[colIdx] || '');
        const periodNum = 7 - colIdx;
        const periodIdx = periodNum - 1;
        if (periodIdx < 0 || periodIdx >= PERIOD_TIMES.length) continue;

        const parsed = parseCell(cell);
        if (!parsed) continue;

        subjectsSet.add(parsed.subject);
        teachersSet.add(parsed.teacher);
        entries.push({
          classId,
          day,
          period: periodNum,
          startTime: PERIOD_TIMES[periodIdx].start,
          endTime: PERIOD_TIMES[periodIdx].end,
          subject: parsed.subject,
          teacher: parsed.teacher,
        });
      }
    }
  }

  if (entries.length === 0) throw new Error('لم يتم استخراج أي بيانات جدول من PDF');

  return {
    classes: Array.from(classesMap.entries()).map(([classId, info]) => ({
      classId,
      grade: info.grade,
      section: info.section,
    })),
    subjects: Array.from(subjectsSet).sort(),
    teachers: Array.from(teachersSet).sort(),
    entries,
  };
}
