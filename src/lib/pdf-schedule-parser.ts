import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

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

interface TextItem {
  str: string;
  x: number;
  y: number;
}

function extractTextItems(ctx: { textContent: any }): TextItem[] {
  const items: TextItem[] = [];
  for (const item of (ctx.textContent?.items || []) as any[]) {
    const tx = item.transform;
    items.push({ str: normalizeArabic(item.str), x: tx[4], y: tx[5] });
  }
  return items.sort((a, b) => b.y - a.y || a.x - b.x);
}

function buildGrid(items: TextItem[], rowGap = 6, colGap = 10): string[][] {
  const rows: { y: number; cells: Map<number, string[]> }[] = [];
  for (const item of items) {
    let row = rows.find(r => Math.abs(r.y - item.y) < rowGap);
    if (!row) { row = { y: item.y, cells: new Map() }; rows.push(row); }
    let col = -1;
    for (const [cx] of row.cells) {
      if (Math.abs(item.x - cx) < colGap) { col = cx; break; }
    }
    if (col < 0) col = item.x;
    if (!row.cells.has(col)) row.cells.set(col, []);
    row.cells.get(col)!.push(item.str);
  }
  rows.sort((a, b) => b.y - a.y);
  const grid: string[][] = [];
  for (const row of rows) {
    const cols = Array.from(row.cells.entries()).sort(([a], [b]) => a - b);
    grid.push(cols.map(([, texts]) => texts.join(' ')));
  }
  return grid;
}

export async function parseSchedulePdf(buffer: Uint8Array): Promise<ParsedSchedule> {
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const entries: ParsedEntry[] = [];
  const subjectsSet = new Set<string>();
  const teachersSet = new Set<string>();
  const classesMap = new Map<string, { grade: string; section: string }>();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const items = extractTextItems({ textContent });
    const allText = items.map(it => it.str).join(' ');

    const classIdMatch = allText.match(/(\d+-\d+)\s*$/);
    if (!classIdMatch) { page.cleanup(); continue; }
    const classId = classIdMatch[1];
    const [grade, section] = classId.split('-');
    if (!classesMap.has(classId)) classesMap.set(classId, { grade, section });

    const grid = buildGrid(items);
    if (grid.length < 6) { page.cleanup(); continue; }

    const dayRows: { day: string; cells: string[] }[] = [];
    for (const row of grid) {
      const joined = row.join(' ');
      for (const [label, dayKey] of Object.entries(DAY_MAP)) {
        if (joined.includes(label)) {
          dayRows.push({ day: dayKey, cells: row });
          break;
        }
      }
    }

    for (const dr of dayRows) {
      const cells = dr.cells;
      const dayColIdx = cells.findIndex(c => Object.keys(DAY_MAP).some(k => c.includes(k)));
      let periodCells = cells;
      if (dayColIdx >= 0) {
        periodCells = cells.slice(0, dayColIdx);
      }
      for (let ci = 0; ci < periodCells.length; ci++) {
        const periodNum = periodCells.length - ci;
        const periodIdx = periodNum - 1;
        if (periodIdx < 0 || periodIdx >= PERIOD_TIMES.length) continue;
        const parsed = parseCell(periodCells[ci]);
        if (!parsed) continue;
        subjectsSet.add(parsed.subject);
        teachersSet.add(parsed.teacher);
        entries.push({
          classId,
          day: dr.day,
          period: periodNum,
          startTime: PERIOD_TIMES[periodIdx].start,
          endTime: PERIOD_TIMES[periodIdx].end,
          subject: parsed.subject,
          teacher: parsed.teacher,
        });
      }
    }
    page.cleanup();
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
