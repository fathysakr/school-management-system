import { getPdfjs } from './pdf-init';

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

export interface PagePreview {
  pageIndex: number;
  entryCount: number;
  subjects: string[];
  teachers: string[];
}

export interface PdfPreview {
  numPages: number;
  pages: PagePreview[];
  subjects: string[];
  teachers: string[];
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

// Branding text injected by timetable generators (e.g. "aSc Timetables") must never leak into data
const NOISE_RE = /timetable|\basc\b/i;

export function isNoiseText(text: string): boolean {
  return NOISE_RE.test(text);
}

function normalizeArabic(text: string): string {
  return text.normalize('NFKC').replace(/\u06CC/g, '\u064A').replace(/\u0649/g, '\u064A');
}

function autoDetectClassId(fullText: string): string {
  const lines = fullText.split('\n');
  let fallback = '';
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;
    const match = line.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
    if (!match) continue;
    const a = match[1], b = match[2];
    if (a.length === 4 && b.length === 4) continue;
    const near = [line, lines[li - 1], lines[li + 1]].filter(Boolean).join(' ');
    if (near.includes('الصف') || near.includes('الفصل') || near.includes('شعبة')) {
      return `${a}-${b}`;
    }
    if (!fallback) fallback = `${a}-${b}`;
  }
  return fallback;
}

async function extractEntriesFromPage(items: { str: string; x: number; y: number }[], classIdLine: string, times: { start: string; end: string }[]): Promise<ParsedEntry[]> {
  const pageEntries: ParsedEntry[] = [];

  // Find day labels and their y positions
  const dayYPositions: { day: string; y: number }[] = [];
  for (const item of items) {
    const s = item.str.trim();
    if (DAY_MAP[s]) {
      dayYPositions.push({ day: DAY_MAP[s], y: item.y });
    }
  }
  if (dayYPositions.length === 0) return pageEntries;

  dayYPositions.sort((a, b) => b.y - a.y);

  for (const dayInfo of dayYPositions) {
    const bandItems = items.filter((item) => Math.abs(item.y - dayInfo.y) < 45);

    // Group items by x proximity into columns
    const colThreshold = 50;
    const columns: { x: number; items: typeof bandItems }[] = [];
    const assigned = new Array(bandItems.length).fill(false);

    for (let i = 0; i < bandItems.length; i++) {
      if (assigned[i]) continue;
      const item = bandItems[i];
      const cluster = [item];
      assigned[i] = true;

      for (let j = i + 1; j < bandItems.length; j++) {
        if (assigned[j]) continue;
        const other = bandItems[j];
        if (Math.abs(other.x - item.x) < colThreshold) {
          cluster.push(other);
          assigned[j] = true;
        }
      }

      columns.push({
        x: item.x,
        items: cluster.sort((a, b) => b.y - a.y),
      });
    }

    columns.sort((a, b) => a.x - b.x);

    // Remove day-name column
    const dataCols = columns.filter((c) => {
      return !c.items.some((i) => DAY_MAP[i.str.trim()]);
    });

    if (dataCols.length < 6) continue;

    for (let ci = 0; ci < dataCols.length; ci++) {
      const colItems = dataCols[ci].items;

      const periodNum = dataCols.length - ci;
      const periodIdx = periodNum - 1;
      if (periodIdx < 0 || periodIdx >= times.length) continue;

      // Group cell items by y into bands
      const sorted = [...colItems].sort((a, b) => b.y - a.y);
      const bands: string[][] = [];
      let currentBand: typeof sorted = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].y;
        const curr = sorted[i].y;
        if (Math.abs(prev - curr) > 15) {
          bands.push(currentBand.map((x) => x.str.trim()));
          currentBand = [sorted[i]];
        } else {
          currentBand.push(sorted[i]);
        }
      }
      if (currentBand.length > 0) bands.push(currentBand.map((x) => x.str.trim()));

      const textBands = bands.map((b) => b.filter((s) => !/^\d+$/.test(s) && !/^[\u0660-\u0669]+$/.test(s) && !DAY_MAP[s] && !s.includes(':') && s !== '-' && s !== '–' && !isNoiseText(s)).join(' ').trim()).filter(Boolean);

      if (textBands.length < 2) continue;

      const subject = textBands.slice(0, -1).join(' ');
      const teacher = textBands[textBands.length - 1];

      if (!subject || !teacher) continue;
      if (isNoiseText(subject) || isNoiseText(teacher)) continue;

      pageEntries.push({
        classId: classIdLine,
        day: dayInfo.day,
        period: periodNum,
        startTime: times[periodIdx].start,
        endTime: times[periodIdx].end,
        subject,
        teacher,
      });
    }
  }
  return pageEntries;
}

export async function previewPdfPages(buffer: Uint8Array, periodTimes?: { start: string; end: string }[]): Promise<PdfPreview> {
  const pdfjs: any = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: buffer });
  const times = periodTimes || PERIOD_TIMES;
  const pages: PagePreview[] = [];
  const allSubjects = new Set<string>();
  const allTeachers = new Set<string>();

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: { str: string; x: number; y: number }[] = content.items.map((item: any) => ({
      str: normalizeArabic(item.str || ''),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
    }));

    const entries = await extractEntriesFromPage(items, '', times);
    const pageSubjects = [...new Set(entries.map(e => e.subject))];
    const pageTeachers = [...new Set(entries.map(e => e.teacher))];
    pageSubjects.forEach(s => allSubjects.add(s));
    pageTeachers.forEach(t => allTeachers.add(t));

    pages.push({
      pageIndex: pageNum,
      entryCount: entries.length,
      subjects: pageSubjects,
      teachers: pageTeachers,
    });
  }

  await doc.destroy();

  return {
    numPages: doc.numPages,
    pages,
    subjects: [...allSubjects].sort(),
    teachers: [...allTeachers].sort(),
  };
}

export async function parseSchedulePdf(buffer: Uint8Array, periodTimes?: { start: string; end: string }[], forcePageClassId?: boolean): Promise<ParsedSchedule> {
  const pdfjs: any = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: buffer });

  const entries: ParsedEntry[] = [];
  const subjectsSet = new Set<string>();
  const teachersSet = new Set<string>();
  const classesMap = new Map<string, { grade: string; section: string }>();

  const times = periodTimes || PERIOD_TIMES;
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: { str: string; x: number; y: number }[] = content.items.map((item: any) => ({
      str: normalizeArabic(item.str || ''),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
    }));

    const fullText = items.map((i) => i.str).join('\n');

    let classIdLine = forcePageClassId ? `page-${pageNum}` : (autoDetectClassId(fullText) || `page-${pageNum}`);
    const [grade, section] = classIdLine.includes('-') ? classIdLine.split('-') : ['0', classIdLine];
    if (!classesMap.has(classIdLine)) classesMap.set(classIdLine, { grade, section });

    const pageEntries = await extractEntriesFromPage(items, classIdLine, times);
    for (const e of pageEntries) {
      subjectsSet.add(e.subject);
      teachersSet.add(e.teacher);
      entries.push(e);
    }
  }

  if (entries.length === 0) {
    const allPagesText: string[] = [];
    const itemsPerPage: number[] = [];
    for (let pn = 1; pn <= Math.min(doc.numPages, 3); pn++) {
      const pg = await doc.getPage(pn);
      const ct = await pg.getTextContent();
      itemsPerPage.push(ct.items.length);
      const lines = ct.items.map((i: any) => `[x:${i.transform?.[4]?.toFixed()},y:${i.transform?.[5]?.toFixed()}] ${i.str || ''}`);
      allPagesText.push(`--- الصفحة ${pn} (${ct.items.length} عنصر) ---\n` + lines.join('\n'));
    }
    const textSample = allPagesText.join('\n\n');
    await doc.destroy();
    const err: any = new Error('لم يتم استخراج أي بيانات جدول من PDF');
    err.debugData = { numPages: doc.numPages, itemsPerPage, textSample };
    throw err;
  }

  await doc.destroy();

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
