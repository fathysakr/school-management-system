import path from 'path';
import { pathToFileURL } from 'url';

const workerUrl = pathToFileURL(path.join(process.cwd(), 'src', 'lib', 'pdf.worker.mjs')).href;

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
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const entries: ParsedEntry[] = [];
  const subjectsSet = new Set<string>();
  const teachersSet = new Set<string>();
  const classesMap = new Map<string, { grade: string; section: string }>();

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const rawItems = content.items.map((item: any) => item.str || '').filter(Boolean);
    const fullText = normalizeArabic(rawItems.join('\n'));

    const lines = fullText.split('\n').filter((l: string) => l.trim());
    let classIdLine = '';
    for (const line of lines) {
      const match = line.trim().match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
      if (match) {
        classIdLine = `${match[1]}-${match[2]}`;
        break;
      }
    }

    if (!classIdLine) continue;
    const [grade, section] = classIdLine.split('-');
    if (!classesMap.has(classIdLine)) classesMap.set(classIdLine, { grade, section });

    const cellRows = content.items.reduce((acc: any[], item: any, idx: number, arr: any[]) => {
      if (idx > 0) {
        const prevY = arr[idx - 1].transform?.[5] || 0;
        const currY = item.transform?.[5] || 0;
        if (Math.abs(currY - prevY) > 5) acc.push([]);
      } else {
        acc.push([]);
      }
      acc[acc.length - 1].push(normalizeArabic(item.str || ''));
      return acc;
    }, [] as any[][]);

    const merged: string[][] = [];
    for (const row of cellRows) {
      if (row.length >= 6) {
        const joined = row.join('|');
        if (/\d/.test(joined) || /[اإأآ]/u.test(joined)) {
          merged.push(row);
        }
      }
    }

    if (merged.length > 5) {
      for (let dayIdx = 0; dayIdx < merged.length; dayIdx++) {
        const row = merged[dayIdx];
        const dayLabel = normalizeArabic(row[row.length - 1]?.trim() || '');
        const day = DAY_MAP[dayLabel];
        if (!day) continue;

        const dataCells = row.slice(0, row.length - 1);
        for (let ci = 0; ci < dataCells.length; ci++) {
          const periodNum = dataCells.length - ci;
          const periodIdx = periodNum - 1;
          if (periodIdx < 0 || periodIdx >= PERIOD_TIMES.length) continue;

          const parsed = parseCell(dataCells[ci]);
          if (!parsed) continue;

          subjectsSet.add(parsed.subject);
          teachersSet.add(parsed.teacher);
          entries.push({
            classId: classIdLine,
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
  }

  await doc.destroy();

  if (entries.length === 0) {
    const page1 = await doc.getPage(1);
    const c1 = await page1.getTextContent();
    const rawLines = c1.items.map((i: any) => `[x:${i.transform?.[4]?.toFixed()},y:${i.transform?.[5]?.toFixed()}] ${i.str || ''}`).slice(0, 100);
    const textSample = rawLines.join('\n');
    await doc.destroy();
    const err: any = new Error('لم يتم استخراج أي بيانات جدول من PDF');
    err.debugData = { numPages: doc.numPages, itemsPerPage: [c1.items.length], textSample };
    throw err;
  }

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
