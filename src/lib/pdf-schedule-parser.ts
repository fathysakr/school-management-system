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
  mode: 'class' | 'teacher';
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
  mode?: 'class' | 'teacher';
  title?: string;
  classes?: string[];
}

export interface PdfPreview {
  numPages: number;
  mode: 'class' | 'teacher';
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

interface TextItem { str: string; x: number; y: number; w: number }

const AR_DIGITS = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const FA_DIGITS = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';

function toLatinDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    const ai = AR_DIGITS.indexOf(ch);
    if (ai >= 0) { out += String(ai); continue; }
    const fi = FA_DIGITS.indexOf(ch);
    if (fi >= 0) { out += String(fi); continue; }
    out += ch;
  }
  return out;
}

const TIME_RE = /^\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*$/;
const CLASS_CODE_RE = /^(\d{1,2})-(\d{1,2})$/;

/**
 * Finds the period-number header row: a horizontal cluster of lone digits 1..9.
 * Each digit anchors one period column (RTL layouts included).
 */
function periodColumns(items: TextItem[]): { p: number; cx: number }[] {
  const cands = items
    .map((i) => ({ s: toLatinDigits(i.str).trim(), x: i.x, y: i.y, w: i.w }))
    .filter((i) => /^[1-9]$/.test(i.s));

  const rows: (typeof cands)[] = [];
  for (const c of [...cands].sort((a, b) => b.y - a.y)) {
    const r = rows.find((rr) => Math.abs(rr[0].y - c.y) <= 3);
    if (r) r.push(c); else rows.push([c]);
  }

  let best: Map<number, { p: number; cx: number }> | null = null;
  for (const r of rows) {
    const uniq = new Map<number, { p: number; cx: number }>();
    for (const c of r) {
      const p = parseInt(c.s, 10);
      if (!uniq.has(p)) uniq.set(p, { p, cx: c.x + c.w / 2 });
    }
    if (!best || uniq.size > best.size) best = uniq;
  }
  return best ? Array.from(best.values()).sort((a, b) => b.p - a.p) : [];
}

/** Title line at the very top of the page (teacher name on teacher cards). */
function topTitle(items: TextItem[]): string {
  if (!items.length) return '';
  const maxY = Math.max(...items.map((i) => i.y));
  const cands = items.filter((i) => maxY - i.y <= 25)
    .filter((i) => !TIME_RE.test(toLatinDigits(i.str))
      && !DAY_MAP[i.str.trim()]
      && !isNoiseText(i.str)
      && i.str.trim().length > 2);
  cands.sort((a, b) => b.str.trim().length - a.str.trim().length);
  return (cands[0]?.str || '').trim();
}

/** True when the page is a per-teacher card: many day rows + time axis + period header. */
function detectTeacherLayout(items: TextItem[]): boolean {
  const days = items.filter((i) => DAY_MAP[i.str.trim()]);
  if (days.length < 4) return false;
  const yrows = new Set(days.map((i) => Math.round(i.y / 20)));
  if (yrows.size < 4) return false;
  if (!items.some((i) => TIME_RE.test(toLatinDigits(i.str)))) return false;
  return periodColumns(items).length >= 5;
}

/**
 * Extract entries from a per-teacher card page.
 *
 * Page anatomy (aSc "teacher card"):
 *   - teacher name at the very top
 *   - period header digits (6..1) + time ranges
 *   - day label rows; ABOVE each label sit its cell rows:
 *       subject line(s), class code ("1-5"), optionally an alternating 2nd subject
 *
 * Strategy: cluster all cell text into horizontal ROWS first, then attach every
 * row to its NEAREST day anchor. Fixed-radius bands fail here because the next
 * day's cells sit ~46px above the current day's label while spacing is ~91px.
 */
async function extractTeacherEntriesFromPage(
  items: TextItem[],
  teacher: string,
  times: { start: string; end: string }[],
): Promise<ParsedEntry[]> {
  const out: ParsedEntry[] = [];
  const pcols = periodColumns(items);
  if (!pcols.length) return out;

  const dayAnchors = items
    .filter((i) => DAY_MAP[i.str.trim()])
    .map((i) => ({ day: DAY_MAP[i.str.trim()], y: i.y }))
    .sort((a, b) => b.y - a.y);
  if (!dayAnchors.length) return out;

  const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  const GROUP_TAG_RE = /^[A-Z]\d{0,2}$/;

  const pool = items.filter((i) => {
    const s = i.str.trim();
    if (!s) return false;
    if (DAY_MAP[s]) return false;
    const latin = toLatinDigits(s);
    if (TIME_RE.test(latin)) return false;
    if (/^[1-9]$/.test(latin)) return false;
    if (DATE_RE.test(latin)) return false;
    if (isNoiseText(s)) return false;
    if (/Timetables|إنشاء/.test(s)) return false;
    return true;
  });

  // Cluster into horizontal rows (vertical gap > 12 starts a new row)
  const sortedPool = [...pool].sort((a, b) => b.y - a.y);
  const rows: TextItem[][] = [];
  let curRow: TextItem[] = [];
  for (const it of sortedPool) {
    if (!curRow.length || Math.abs(curRow[curRow.length - 1].y - it.y) <= 12) {
      curRow.push(it);
    } else {
      rows.push(curRow);
      curRow = [it];
    }
  }
  if (curRow.length) rows.push(curRow);

  // Attach each row to its day using OFFSET WINDOWS, not nearest distance.
  // Within a day (label at y=L): class-code row sits at ~L+4, subject rows at ~L+45.
  // Nearest-anchor fails because a subject row is ~45px from BOTH its own label
  // and the neighbouring one (day pitch ~91px). Windows are mutually exclusive.
  const byDay = new Map<string, TextItem[]>();
  const CODE_WIN: [number, number] = [2, 16];
  const SUBJ_WIN: [number, number] = [26, 88];
  for (const row of rows) {
    const ry = row.reduce((sum, i) => sum + i.y, 0) / row.length;
    let codeHit: { day: string; score: number } | null = null;
    let subjHit: { day: string; score: number } | null = null;
    for (const d of dayAnchors) {
      const off = ry - d.y;
      const cDist = Math.min(Math.abs(off - CODE_WIN[0]), Math.abs(off - CODE_WIN[1]));
      const sDist = Math.min(Math.abs(off - SUBJ_WIN[0]), Math.abs(off - SUBJ_WIN[1]));
      if (off >= CODE_WIN[0] && off <= CODE_WIN[1] && (!codeHit || cDist < codeHit.score)) {
        codeHit = { day: d.day, score: cDist };
      }
      if (off >= SUBJ_WIN[0] && off <= SUBJ_WIN[1] && (!subjHit || sDist < subjHit.score)) {
        subjHit = { day: d.day, score: sDist };
      }
    }
    // A code-row match wins over a subject-row match (mutually exclusive anyway)
    const hit = codeHit || subjHit;
    if (!hit) continue;
    const arr = byDay.get(hit.day) || [];
    arr.push(...row);
    byDay.set(hit.day, arr);
  }

  for (const [day, dayItems] of byDay) {
    // Bucket into period columns by horizontal center
    const byPeriod = new Map<number, TextItem[]>();
    for (const it of dayItems) {
      const cx = it.x + it.w / 2;
      let bestCol: { p: number; cx: number } | null = null;
      let bestDist = Infinity;
      for (const pc of pcols) {
        const dist = Math.abs(cx - pc.cx);
        if (dist < bestDist) { bestDist = dist; bestCol = pc; }
      }
      if (!bestCol || bestDist > 62) continue;
      const arr = byPeriod.get(bestCol.p) || [];
      arr.push(it);
      byPeriod.set(bestCol.p, arr);
    }

    for (const [p, list] of byPeriod) {
      if (p < 1 || p > times.length) continue;

      const sorted = [...list].sort((a, b) => b.y - a.y);
      const bands: string[] = [];
      let curBand: TextItem[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i - 1].y - sorted[i].y) > 15) {
          bands.push(curBand.map((x) => x.str.trim()).join(' ').trim());
          curBand = [sorted[i]];
        } else {
          curBand.push(sorted[i]);
        }
      }
      if (curBand.length) bands.push(curBand.map((x) => x.str.trim()).join(' ').trim());
      const texts = bands.filter(Boolean);
      if (!texts.length) continue;
      // An orphan class-code with no subject line carries no lesson info
      if (texts.length === 1 && CLASS_CODE_RE.test(toLatinDigits(texts[0]).replace(/\s+/g, ''))) continue;

      // Locate the class-code band anywhere in the cell
      let codeIdx = -1;
      let classCode = '';
      for (let bi = 0; bi < texts.length; bi++) {
        const cm = CLASS_CODE_RE.exec(toLatinDigits(texts[bi]).replace(/\s+/g, ''));
        if (cm && texts.length > 1) { codeIdx = bi; classCode = `${cm[1]}-${cm[2]}`; break; }
      }

      // Subject(s): bands above the code (primary), bands below (alternating week)
      const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
      const above = texts.slice(0, codeIdx >= 0 ? codeIdx : texts.length)
        .filter((t) => !GROUP_TAG_RE.test(toLatinDigits(t.replace(/\s/g, ''))));
      const below = texts.slice(codeIdx + 1)
        .filter((t) => !GROUP_TAG_RE.test(toLatinDigits(t.replace(/\s/g, ''))));
      const subject = clean(above.join(' ')) || clean(below.join(' '));

      if (!subject) continue;
      if (isNoiseText(subject)) continue;
      // Every real lesson on a teacher card is tied to a class — skip orphans
      if (!classCode) continue;

      out.push({
        classId: classCode,
        day,
        period: p,
        startTime: times[p - 1].start,
        endTime: times[p - 1].end,
        subject,
        teacher,
      });
    }
  }
  return out;
}

function autoDetectClassId(fullText: string): string {
  const lines = fullText.split('\n');
  let fallback = '';
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;
    const match = line.match(/\b(\d+)\s*[-\u2013]\s*(\d+)\b/);
    if (!match) continue;
    const a = match[1], b = match[2];
    if (a.length === 4 && b.length === 4) continue;
    const near = [line, lines[li - 1], lines[li + 1]].filter(Boolean).join(' ');
    if (near.includes('\u0627\u0644\u0635\u0641') || near.includes('\u0627\u0644\u0641\u0635\u0644') || near.includes('\u0634\u0639\u0628\u0629')) {
      return `${a}-${b}`;
    }
    if (!fallback) fallback = `${a}-${b}`;
  }
  return fallback;
}

async function extractEntriesFromPage(
  items: TextItem[],
  classIdLine: string,
  times: { start: string; end: string }[],
): Promise<ParsedEntry[]> {
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
    const bandItems = items.filter((item) => Math.abs(item.y - dayInfo.y) <= 55);

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

      const textBands = bands.map((b) => b.filter((s) => !/^\d+$/.test(s) && !/^[\u0660-\u0669]+$/.test(s) && !DAY_MAP[s] && !s.includes(':') && s !== '-' && s !== '\u2013' && !isNoiseText(s)).join(' ').trim()).filter(Boolean);

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
  const modes: ('class' | 'teacher')[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items.map((item: any) => ({
      str: normalizeArabic(item.str || ''),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
      w: item.width || 0,
    }));

    const isTeacher = detectTeacherLayout(items);
    modes.push(isTeacher ? 'teacher' : 'class');

    let entries: ParsedEntry[];
    let title: string | undefined;
    let classNames: string[] | undefined;
    if (isTeacher) {
      title = topTitle(items);
      entries = await extractTeacherEntriesFromPage(items, title, times);
      classNames = [...new Set(entries.map((e) => e.classId).filter(Boolean))];
    } else {
      entries = await extractEntriesFromPage(items, '', times);
    }

    const pageSubjects = [...new Set(entries.map((e) => e.subject))];
    const pageTeachers = [...new Set(entries.map((e) => e.teacher).filter(Boolean))];
    pageSubjects.forEach((s) => allSubjects.add(s));
    pageTeachers.forEach((t) => allTeachers.add(t));

    pages.push({
      pageIndex: pageNum,
      entryCount: entries.length,
      subjects: pageSubjects,
      teachers: pageTeachers,
      mode: isTeacher ? 'teacher' : 'class',
      title,
      classes: classNames,
    });

    if (page.cleanup) await page.cleanup();
  }

  const overallMode: 'class' | 'teacher' = modes.filter((m) => m === 'teacher').length >= modes.length / 2 ? 'teacher' : 'class';

  const numPages = doc.numPages;
  await doc.destroy();

  return {
    numPages,
    mode: overallMode,
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
  let teacherPages = 0;
  let totalPages = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: TextItem[] = content.items.map((item: any) => ({
      str: normalizeArabic(item.str || ''),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
      w: item.width || 0,
    }));

    const fullText = items.map((i) => i.str).join('\n');
    totalPages++;

    if (detectTeacherLayout(items)) {
      teacherPages++;
      const teacherName = topTitle(items) || `\u0645\u0639\u0644\u0645 \u0635\u0641\u062D\u0629 ${pageNum}`;
      if (teacherName) teachersSet.add(teacherName);

      const pageEntries = await extractTeacherEntriesFromPage(items, teacherName, times);
      for (const e of pageEntries) {
        subjectsSet.add(e.subject);
        entries.push(e);
        if (e.classId && !classesMap.has(e.classId)) {
          const parts = e.classId.split('-');
          classesMap.set(e.classId, { grade: parts[0] || '0', section: parts[1] || '' });
        }
      }
    } else {
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

    if (page.cleanup) await page.cleanup();
  }

  if (entries.length === 0) {
    const allPagesText: string[] = [];
    const itemsPerPage: number[] = [];
    for (let pn = 1; pn <= Math.min(doc.numPages, 3); pn++) {
      const pg = await doc.getPage(pn);
      const ct = await pg.getTextContent();
      itemsPerPage.push(ct.items.length);
      const lines = ct.items.map((i: any) => `[x:${i.transform?.[4]?.toFixed()},y:${i.transform?.[5]?.toFixed()}] ${i.str || ''}`);
      allPagesText.push(`--- \u0627\u0644\u0635\u0641\u062D\u0629 ${pn} (${ct.items.length} \u0639\u0646\u0635\u0631) ---\n` + lines.join('\n'));
    }
    const textSample = allPagesText.join('\n\n');
    const err: any = new Error('\u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u062F\u0648\u0644 \u0645\u0646 PDF');
    err.debugData = { numPages: doc.numPages, itemsPerPage, textSample };
    await doc.destroy();
    throw err;
  }

  const mode: 'class' | 'teacher' = teacherPages >= totalPages / 2 ? 'teacher' : 'class';
  await doc.destroy();

  return {
    mode,
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
