import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, serverError } from '@/lib/auth';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, ShadingType } from 'docx';
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const SCHOOL_NAME = 'مدرسة صفوة الرواد الأهلية';
const ARABIC_FONT = 'Traditional Arabic';

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('ar-SA'); } catch { return d; }
}

function makeRun(text: string, opts: { bold?: boolean; size?: number; color?: string; font?: string } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, font: opts.font || ARABIC_FONT, size: opts.size || 20, color: opts.color });
}

function makePara(runs: TextRun[], opts: { align?: Align; spacing?: { before?: number; after?: number }; bidirectional?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: runs,
    alignment: opts.align,
    spacing: opts.spacing,
    bidirectional: opts.bidirectional,
  });
}

function cell(text: string, bold = false, shading?: string): TableCell {
  return new TableCell({
    children: [makePara([makeRun(text, { bold })], { align: AlignmentType.RIGHT, bidirectional: true })],
    width: { size: bold ? 25 : 75, type: WidthType.PERCENTAGE },
    shading: shading ? { type: ShadingType.CLEAR, color: shading, fill: shading } : undefined,
  });
}

function infoRow(label: string, value: string | null | undefined): TableRow {
  return new TableRow({ children: [cell(label, true, 'E8EAF6'), cell(value || '-')] });
}

function sectionHdr(text: string): Paragraph {
  return makePara([makeRun(text, { bold: true, size: 22, color: '1565C0' })], { align: AlignmentType.RIGHT, bidirectional: true, spacing: { before: 300, after: 200 } });
}

function bodyP(text: string | null | undefined): Paragraph {
  return makePara([makeRun(text || '-')], { align: AlignmentType.RIGHT, bidirectional: true, spacing: { after: 120 } });
}

function titleP(text: string): Paragraph {
  return makePara([makeRun(text, { bold: true, size: 28, color: '1A237E' })], { align: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 } });
}

function subtitleP(text: string): Paragraph {
  return makePara([makeRun(text, { size: 20, color: '666666' })], { align: AlignmentType.CENTER, bidirectional: true, spacing: { after: 400 } });
}

function sep(): Paragraph {
  return makePara([makeRun('─'.repeat(60), { size: 16, color: '1565C0' })], { align: AlignmentType.CENTER, spacing: { before: 200, after: 200 } });
}

function hdrFooter(text: string): Paragraph {
  return makePara([makeRun(text, { size: 16, color: '999999' })], { align: AlignmentType.CENTER, bidirectional: true });
}

function tableFromRows(rows: TableRow[]): Table {
  return new Table({ rows });
}

async function generateTeacherReportDoc(report: any): Promise<Document> {
  const typeLabels: Record<string, string> = {
    activity: 'تقرير نشاط', positive: 'تقرير إيجابي', behavioral: 'تقرير سلوكي', academic_deficiency: 'تقرير ضعف دراسي',
  };
  const doc = new Document({
    creator: SCHOOL_NAME,
    title: report.title || typeLabels[report.report_type] || 'تقرير',
    description: 'تقرير طلابي',
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: { default: new Header({ children: [hdrFooter(SCHOOL_NAME)] }) },
      children: [
        titleP(SCHOOL_NAME),
        subtitleP(report.title || typeLabels[report.report_type] || 'تقرير طلابي'),
        sep(),
        sectionHdr('معلومات التقرير'),
        tableFromRows([
          infoRow('نوع التقرير', typeLabels[report.report_type] || report.report_type),
          infoRow('العنوان', report.title),
          infoRow('التاريخ', formatDate(report.date)),
          infoRow('الحالة', report.status === 'active' ? 'نشط' : 'مؤرشف'),
        ]),
        sectionHdr('معلومات الطالب'),
        tableFromRows([
          infoRow('الاسم', `${report.student_first_name || ''} ${report.student_last_name || ''}`),
          infoRow('رقم الطالب', report.student_code),
          infoRow('الفصل', report.class_name),
        ]),
        sectionHdr('محتوى التقرير'),
        bodyP(report.content),
        sectionHdr('المعلم'),
        bodyP(`${report.teacher_first_name || ''} ${report.teacher_last_name || ''}`),
      ],
      footers: { default: new Footer({ children: [hdrFooter(`تم الإنشاء في: ${new Date().toLocaleDateString('ar-SA')}`)] }) },
    }],
  });
  return doc;
}

async function generateCounselingReportDoc(record: any, type: string): Promise<Document> {
  const typeLabels: Record<string, string> = {
    programs: 'خطة برنامج إرشادي', attendance_reports: 'تقرير غياب وسلوك', cases: 'دراسة حالة فردية',
    contracts: 'عقد سلوك', issues: 'مشكلة طلابية',
  };
  const domainLabels: Record<string, string> = {
    academic: 'أكاديمي', psychological: 'نفسي', guidance: 'توجيهي', community: 'اجتماعي', social: 'اجتماعي', career: 'مهني',
  };
  const caseTypeLabels: Record<string, string> = {
    academic: 'أكاديمية', behavioral: 'سلوكية', psychological: 'نفسية', social: 'اجتماعية', career: 'مهنية',
  };
  const reportTypeLabels: Record<string, string> = {
    absence: 'غياب', behavior: 'سلوك', academic: 'تحصيل دراسي', general: 'عام',
  };
  const issueTypeLabels: Record<string, string> = {
    violence: 'عنف', bullying: 'تنمر', disruption: 'إخلال بالنظام', cyber: 'استخدام غير آمن للإنترنت', absence: 'غياب', other: 'أخرى',
  };
  const statusLabels: Record<string, string> = {
    active: 'نشط', completed: 'مكتمل', cancelled: 'ملغي',
    open: 'مفتوح', in_progress: 'قيد المتابعة', resolved: 'تم الحل',
    closed: 'مغلق', breached: 'مخالف', referred: 'محول',
  };

  const children: (Paragraph | Table)[] = [
    titleP(SCHOOL_NAME),
    subtitleP(typeLabels[type] || 'تقرير إرشادي'),
    sep(),
    sectionHdr('معلومات أساسية'),
  ];

  const rows: TableRow[] = [];
  if (record.student_name) rows.push(infoRow('الطالب', `${record.student_name} (${record.student_code || ''})`));
  if (record.class_name) rows.push(infoRow('الفصل', record.class_name));
  if (record.counselor_email) rows.push(infoRow('المرشد', record.counselor_email));
  rows.push(infoRow('الحالة', statusLabels[record.status] || record.status));
  rows.push(infoRow('تاريخ الإضافة', formatDate(record.created_at)));
  children.push(tableFromRows(rows));
  children.push(sep());

  if (type === 'programs') {
    children.push(sectionHdr('بيانات البرنامج'));
    children.push(tableFromRows([
      infoRow('العنوان', record.title), infoRow('المجال', domainLabels[record.domain] || record.domain),
      infoRow('تاريخ البداية', formatDate(record.start_date)), infoRow('تاريخ النهاية', formatDate(record.end_date)),
      infoRow('الفئة المستهدفة', record.target_group),
    ]));
    if (record.description) { children.push(sectionHdr('الوصف')); children.push(bodyP(record.description)); }
    if (record.goals) { children.push(sectionHdr('الأهداف')); children.push(bodyP(record.goals)); }
  }

  if (type === 'cases') {
    children.push(sectionHdr('بيانات الحالة'));
    children.push(tableFromRows([
      infoRow('نوع الحالة', caseTypeLabels[record.case_type] || record.case_type),
      infoRow('العنوان', record.title),
    ]));
    if (record.background) { children.push(sectionHdr('الخلفية')); children.push(bodyP(record.background)); }
    if (record.analysis) { children.push(sectionHdr('التحليل')); children.push(bodyP(record.analysis)); }
    if (record.intervention) { children.push(sectionHdr('التدخل')); children.push(bodyP(record.intervention)); }
    if (record.outcome) { children.push(sectionHdr('النتيجة')); children.push(bodyP(record.outcome)); }
    if (record.recommendations) { children.push(sectionHdr('التوصيات')); children.push(bodyP(record.recommendations)); }
  }

  if (type === 'attendance_reports') {
    children.push(sectionHdr('بيانات التقرير'));
    children.push(tableFromRows([infoRow('نوع التقرير', reportTypeLabels[record.report_type] || record.report_type)]));
    children.push(sectionHdr('الوصف'));
    children.push(bodyP(record.description));
    if (record.actions_taken) { children.push(sectionHdr('الإجراءات المتخذة')); children.push(bodyP(record.actions_taken)); }
    if (record.follow_up) { children.push(sectionHdr('المتابعة')); children.push(bodyP(record.follow_up)); }
  }

  if (type === 'contracts') {
    children.push(sectionHdr('بيانات العقد'));
    children.push(tableFromRows([
      infoRow('العنوان', record.title), infoRow('تاريخ البداية', formatDate(record.start_date)),
      infoRow('تاريخ النهاية', formatDate(record.end_date)),
      infoRow('توقيع الطالب', record.student_signed ? 'تم' : 'لم يتم'),
      infoRow('توقيع ولي الأمر', record.parent_signed ? 'تم' : 'لم يتم'),
      infoRow('توقيع المرشد', record.counselor_signed ? 'تم' : 'لم يتم'),
    ]));
    children.push(sectionHdr('الشروط'));
    children.push(bodyP(record.terms));
  }

  if (type === 'issues') {
    children.push(sectionHdr('بيانات المشكلة'));
    children.push(tableFromRows([
      infoRow('نوع المشكلة', issueTypeLabels[record.issue_type] || record.issue_type),
      infoRow('مستوى الخطورة', record.severity === 'low' ? 'منخفض' : record.severity === 'medium' ? 'متوسط' : record.severity === 'high' ? 'عالي' : 'خطير'),
    ]));
    children.push(sectionHdr('الوصف'));
    children.push(bodyP(record.description));
    if (record.actions_taken) { children.push(sectionHdr('الإجراءات المتخذة')); children.push(bodyP(record.actions_taken)); }
  }

  return new Document({
    creator: SCHOOL_NAME,
    title: typeLabels[type] || 'تقرير إرشادي',
    description: 'تقرير إرشاد طلابي',
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: { default: new Header({ children: [hdrFooter(SCHOOL_NAME)] }) },
      children,
      footers: { default: new Footer({ children: [hdrFooter(`تم الإنشاء في: ${new Date().toLocaleDateString('ar-SA')}`)] }) },
    }],
  });
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { reportType, ids } = await request.json();

    if (!reportType || !ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest('نوع التقرير ومعرفات السجلات مطلوبة');
    }

    let doc: Document;

    if (reportType === 'teacher_report') {
      const report = await db.prepare(`
        SELECT tr.*, s.first_name as student_first_name, s.last_name as student_last_name, s.student_id as student_code,
               c.class_name, t.first_name as teacher_first_name, t.last_name as teacher_last_name
        FROM teacher_reports tr
        LEFT JOIN students s ON tr.student_id = s.id
        LEFT JOIN classes c ON tr.class_id = c.id
        LEFT JOIN teachers t ON tr.teacher_id = t.id
        WHERE tr.id = ?
      `).get(ids[0]) as any;
      if (!report) return badRequest('التقرير غير موجود');
      doc = await generateTeacherReportDoc(report);
    } else if (['programs', 'attendance_reports', 'cases', 'contracts', 'issues'].includes(reportType)) {
      let query = '';
      if (reportType === 'programs') {
        query = `SELECT p.*, u.email as counselor_email FROM counseling_programs p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`;
      } else {
        const tables: Record<string, string> = {
          attendance_reports: 'counseling_attendance_reports',
          cases: 'counseling_cases',
          contracts: 'counseling_behavior_contracts',
          issues: 'counseling_behavior_issues',
        };
        const table = tables[reportType];
        query = `SELECT r.*, s.first_name || ' ' || s.last_name as student_name, s.student_id as student_code, c.class_name, u.email as counselor_email
                 FROM ${table} r
                 LEFT JOIN students s ON r.student_id = s.id
                 LEFT JOIN classes c ON r.class_id = c.id
                 LEFT JOIN users u ON r.counselor_id = u.id
                 WHERE r.id = ?`;
      }
      const record = await db.prepare(query).get(ids[0]) as any;
      if (!record) return badRequest('السجل غير موجود');
      doc = await generateCounselingReportDoc(record, reportType);
    } else {
      return badRequest('نوع تقرير غير مدعوم');
    }

    const buffer = await Packer.toBuffer(doc);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="report-${reportType}-${ids[0]}.docx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return serverError('فشل في تصدير التقرير');
  }
}
