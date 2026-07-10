import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, success } from '@/lib/auth';

interface Row { id: number }
interface Enrollment { student_id: number; class_id: number }

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const key = (body.type as string) || 'all';
    const instructorId = user.id;

    const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    if (key === 'all' || key === 'distribute') {
      const students = (db.prepare('SELECT id FROM students WHERE status = ? ORDER BY id').all('active') || []) as Row[];
      const classList = (db.prepare('SELECT id FROM classes WHERE status = ? ORDER BY id').all('active') || []) as Row[];
      if (students.length && classList.length) {
        db.prepare('DELETE FROM enrollments').run();
        for (let i = 0; i < students.length; i++) {
          const classId = classList[i % classList.length].id;
          if (!db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?').get(students[i].id, classId)) {
            db.prepare('INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?,?,?,?)').run(students[i].id, classId, '2026-09-01', 'active');
          }
        }
      }
      if (key !== 'all') return success({ message: 'تم توزيع الطلاب على الفصول' });
    }

    if (key === 'all' || key === 'teacher_reports') {
      const teachers = (db.prepare('SELECT id FROM teachers WHERE status = ? ORDER BY id').all('active') || []) as Row[];
      const enrollList = (db.prepare('SELECT student_id, class_id FROM enrollments WHERE status = ?').all('active') || []) as Enrollment[];
      if (teachers.length && enrollList.length) {
        const reportTypes = ['activity','positive','behavioral','academic_deficiency'];
        const rtypeLabels: Record<string,string> = {activity:'نشاط',positive:'إيجابي',behavioral:'سلوكي',academic_deficiency:'ضعف دراسي'};
        const contents = ['تميز في النشاط الرياضي','سلوك مثالي','تحسن ملحوظ','ضعف يحتاج تقوية','مشاركة صفية','التزام بالحضور','دعم إضافي','تحسن دراسي'];
        db.prepare('DELETE FROM teacher_reports').run();
        const stmt = db.prepare('INSERT INTO teacher_reports (teacher_id,student_id,class_id,report_type,title,content,date,status) VALUES (?,?,?,?,?,?,?,?)');
        const max = Math.min(enrollList.length, 20);
        for (let i = 0; i < max; i++) {
          const e = enrollList[i];
          const rt = randomPick(reportTypes);
          stmt.run(randomPick(teachers).id, e.student_id, e.class_id, rt, `تقرير ${rtypeLabels[rt]}`, randomPick(contents), '2026-06-01', 'active');
        }
      }
      if (key !== 'all') return success({ message: 'تم إنشاء تقارير المعلمين' });
    }

    const studentRows = (db.prepare('SELECT id FROM students WHERE status = ? ORDER BY id').all('active') || []) as Row[];
    const classRows = (db.prepare('SELECT id FROM classes WHERE status = ? ORDER BY id').all('active') || []) as Row[];
    if (!studentRows.length || !classRows.length) return badRequest('لا يوجد طلاب أو فصول');
    const sIds = studentRows.map(r => r.id);
    const cIds = classRows.map(r => r.id);

    const descSuffix = ['يحتاج دعم','تحويل لأخصائي','خطة علاجية','متابعة مع الأهل','تم تقوية','متابعة أسبوعية'];
    const bgSuffix = ['ضعف أساسيات','تاريخ صعوبات','والدان منفصلان','تراجع أدائي','تقارير معلمين'];

    if (key === 'all' || key === 'programs') {
      const items: { title: string; domain: string; desc: string; goals: string; target: string; start: string; end: string }[] = [
        { title:'تحسين المستوى', domain:'academic', desc:'تحسين المهارات الأساسية', goals:'رفع النجاح 20%', target:'الأول ثانوي', start:'2026-09-01', end:'2026-12-30' },
        { title:'الصحة النفسية', domain:'psychological', desc:'توعوية للصحة النفسية', goals:'مهارات اجتماعية', target:'جميع الصفوف', start:'2026-09-15', end:'2026-11-15' },
        { title:'التوجيه المهني', domain:'guidance', desc:'اختيار المسارات', goals:'قرارات مستنيرة', target:'الثالث ثانوي', start:'2026-10-01', end:'2027-01-30' },
        { title:'مجلس الآباء', domain:'community', desc:'التواصل مع أولياء الأمور', goals:'العلاقة بالمدرسة', target:'جميع الأولياء', start:'2026-09-20', end:'2026-12-20' },
      ];
      db.prepare('DELETE FROM counseling_programs').run();
      const stmt = db.prepare('INSERT INTO counseling_programs (title,domain,description,goals,target_group,start_date,end_date,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)');
      for (let i = 0; i < items.length; i++) {
        const c = items[i];
        stmt.run(c.title,c.domain,c.desc,c.goals,c.target,c.start,c.end,'active',instructorId);
      }
      if (key !== 'all') return success({ message: 'تم إنشاء البرامج' });
    }

    if (key === 'all' || key === 'cases') {
      const titles = ['صعوبات تعلم','ضعف رياضيات','تشتت انتباه','قلق امتحاني','تدني تحصيلي','فقدان دافعية','صعوبة تركيز','تأخر قراءة','ضعف كتابة'];
      const types = ['academic','behavioral','psychological','social','career'];
      const statusList = ['open','in_progress','resolved','closed'];
      db.prepare('DELETE FROM counseling_cases').run();
      const stmt = db.prepare('INSERT INTO counseling_cases (student_id,class_id,case_type,title,background,analysis,intervention,outcome,recommendations,status,counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      const max = Math.min(sIds.length, 15);
      for (let i = 0; i < max; i++) {
        stmt.run(sIds[i], randomPick(cIds), types[i%5], titles[i%titles.length],
          randomPick(descSuffix), randomPick(bgSuffix), 'جلسات فردية',
          i%3===0?'تحسن':i%3===1?'قيد التحسين':'يحتاج جلسات','متابعة',statusList[i%4],instructorId);
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${max} حالة` });
    }

    if (key === 'all' || key === 'attendance_reports') {
      const rtypes = ['absence','behavior','academic','general'];
      const statusList = ['open','in_progress','resolved','closed'];
      db.prepare('DELETE FROM counseling_attendance_reports').run();
      const stmt = db.prepare('INSERT INTO counseling_attendance_reports (student_id,class_id,report_type,description,actions_taken,follow_up,status,counselor_id) VALUES (?,?,?,?,?,?,?,?)');
      const max = Math.min(sIds.length, 12);
      for (let i = 0; i < max; i++) {
        const rt = rtypes[i%rtypes.length];
        stmt.run(sIds[i],randomPick(cIds),rt,rt==='absence'?'غياب':rt==='behavior'?'سلوك':'عام','تم التوجيه','أسبوعي',statusList[i%4],instructorId);
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${max} تقرير` });
    }

    if (key === 'all' || key === 'issues') {
      const itypes = ['disruption','bullying','absence','cyber','violence','other'];
      const sevs = ['low','medium','high'];
      const statusList = ['open','in_progress','resolved','closed'];
      db.prepare('DELETE FROM counseling_behavior_issues').run();
      const stmt = db.prepare('INSERT INTO counseling_behavior_issues (student_id,class_id,issue_type,description,severity,actions_taken,status,counselor_id) VALUES (?,?,?,?,?,?,?,?)');
      const max = Math.min(sIds.length, 8);
      for (let i = 0; i < max; i++) {
        stmt.run(sIds[i],randomPick(cIds),itypes[i%itypes.length],'وصف المشكلة',sevs[i%3],'تم التوجيه',statusList[i%4],instructorId);
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${max} مشكلة` });
    }

    if (key === 'all' || key === 'contracts') {
      const titles = ['تحسين السلوك','المواظبة'];
      const terms = ['يلتزم بالتصرف الحسن','يلتزم بالحضور'];
      const statusList = ['active','completed','active','breached'];
      db.prepare('DELETE FROM counseling_behavior_contracts').run();
      const stmt = db.prepare('INSERT INTO counseling_behavior_contracts (student_id,class_id,title,terms,start_date,end_date,status,student_signed,parent_signed,counselor_signed,counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      const max = Math.min(sIds.length, 6);
      for (let i = 0; i < max; i++) {
        stmt.run(sIds[i],randomPick(cIds),titles[i%2],terms[i%2],'2026-09-01','2026-12-31',statusList[i%4],i%2===0?1:0,i%2===0?1:0,1,instructorId);
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${max} عقد` });
    }

    return success({ message: 'تم إنشاء جميع البيانات التجريبية بنجاح' });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || error?.toString() || 'خطأ غير معروف' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
