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
        let enrolled = 0;
        for (let i = 0; i < students.length; i++) {
          const classId = classList[i % classList.length].id;
          if (!db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?').get(students[i].id, classId)) {
            db.prepare('INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?,?,?,?)').run(
              students[i].id, classId, '2026-09-01', 'active'
            );
            enrolled++;
          }
        }
      }
      if (key !== 'all') return success({ message: 'تم توزيع الطلاب على الفصول' });
    }

    if (key === 'all' || key === 'teacher_reports') {
      const teachers = (db.prepare('SELECT id FROM teachers WHERE status = ? ORDER BY id').all('active') || []) as Row[];
      const enrollList = (db.prepare('SELECT student_id, class_id FROM enrollments WHERE status = ?').all('active') || []) as Enrollment[];
      const reportTypes = ['activity','positive','behavioral','academic_deficiency'];
      const rtypeLabels: Record<string,string> = {activity:'نشاط',positive:'إيجابي',behavioral:'سلوكي',academic_deficiency:'ضعف دراسي'};
      const contents = [
        'تميز الطالب في النشاط الرياضي المدرسي',
        'أظهر الطالب سلوكاً مثالياً',
        'تم رصد تحسن ملحوظ في السلوك',
        'يعاني من ضعف ويحتاج حصص تقوية',
        'تميز في المشاركة الصفية',
        'التزام بالحضور والانضباط',
        'يحتاج دعم إضافي',
        'تحسن في المستوى الدراسي'
      ];
      db.prepare('DELETE FROM teacher_reports').run();
      const stmt = db.prepare('INSERT INTO teacher_reports (teacher_id,student_id,class_id,report_type,title,content,date,status) VALUES (?,?,?,?,?,?,?,?)');
      let inserted = 0;
      for (let i = 0; i < Math.min(enrollList.length, 20); i++) {
        const e = enrollList[i];
        stmt.run(randomPick(teachers).id, e.student_id, e.class_id,
          randomPick(reportTypes), `تقرير ${randomPick(Object.values(rtypeLabels))}`,
          randomPick(contents), '2026-06-01', 'active');
        inserted++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${inserted} تقرير للمعلمين` });
    }

    const studentIds = ((db.prepare('SELECT id FROM students WHERE status = ? ORDER BY id').all('active') || []) as Row[]).map(r => r.id);
    const classIds = ((db.prepare('SELECT id FROM classes WHERE status = ? ORDER BY id').all('active') || []) as Row[]).map(r => r.id);
    if (!studentIds.length || !classIds.length) return badRequest('لا يوجد طلاب أو فصول');

    const descSuffix = ['يحتاج جلسات دعم','تحويل إلى أخصائي','وضع خطة علاجية','متابعة مع الأهل','تم عمل تقوية','متابعة أسبوعية'];
    const bgSuffix = ['ضعف في المهارات الأساسية','تاريخ صعوبات تعلم','والدان منفصلان','تراجع أدائي بدأ منذ شهرين','تقارير متعددة من المعلمين'];

    if (key === 'all' || key === 'programs') {
      const items = [
        { title:'تحسين المستوى الدراسي', domain:'academic', desc:'برنامج لتحسين المهارات الأساسية', goals:'رفع النجاح 20%', target:'الأول الثانوي', start:'2026-09-01', end:'2026-12-30' },
        { title:'تعزيز الصحة النفسية', domain:'psychological', desc:'برنامج توعوي للصحة النفسية', goals:'مهارات اجتماعية', target:'جميع الصفوف', start:'2026-09-15', end:'2026-11-15' },
        { title:'التوجيه المهني', domain:'guidance', desc:'مساعدة في اختيار المسارات', goals:'قرارات مستنيرة', target:'الثالث الثانوي', start:'2026-10-01', end:'2027-01-30' },
        { title:'مجلس أولياء الأمور', domain:'community', desc:'التواصل مع أولياء الأمور', goals:'علاقة المدرسة بالبيت', target:'جميع الأولياء', start:'2026-09-20', end:'2026-12-20' },
      ];
      db.prepare('DELETE FROM counseling_programs').run();
      const stmt = db.prepare('INSERT INTO counseling_programs (title,domain,description,goals,target_group,start_date,end_date,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const c of items) stmt.run(c.title,c.domain,c.desc,c.goals,c.target,c.start,c.end,'active',instructorId);
      if (key !== 'all') return success({ message: 'تم إنشاء 4 برامج' });
    }

    if (key === 'all' || key === 'cases') {
      const titles = ['صعوبات تعلم','ضعف رياضيات','تشتت انتباه','قلق امتحاني','تدني تحصيلي','فقدان دافعية','صعوبة تركيز','تأخر قراءة','ضعف كتابة'];
      const types = ['academic','behavioral','psychological','social','career'];
      const statusList = ['open','in_progress','resolved','closed'];
      db.prepare('DELETE FROM counseling_cases').run();
      const stmt = db.prepare('INSERT INTO counseling_cases (student_id,class_id,case_type,title,background,analysis,intervention,outcome,recommendations,status,counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      let count = 0;
      for (let i = 0; i < Math.min(studentIds.length, 15); i++) {
        stmt.run(studentIds[i], randomPick(classIds), types[i%5], titles[i%titles.length],
          randomPick(descSuffix), randomPick(bgSuffix), 'جلسات فردية',
          i%3===0?'تحسن ملحوظ':i%3===1?'قيد التحسين':'يحتاج جلسات','متابعة',statusList[i%4], instructorId);
        count++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${count} دراسة حالة` });
    }

    if (key === 'all' || key === 'attendance_reports') {
      const rtypes = ['absence','behavior','academic','general'];
      const statusList = ['open','in_progress','resolved','closed'];
      db.prepare('DELETE FROM counseling_attendance_reports').run();
      const stmt = db.prepare('INSERT INTO counseling_attendance_reports (student_id,class_id,report_type,description,actions_taken,follow_up,status,counselor_id) VALUES (?,?,?,?,?,?,?,?)');
      let count = 0;
      for (let i = 0; i < Math.min(studentIds.length, 12); i++) {
        const rt = rtypes[i%rtypes.length];
        const desc = rt==='absence'?`غياب ${i+2} أيام`:
                     rt==='behavior'?`سلوك غير لائق`:
                     `${rt==='academic'?'تحصيل دراسي':'عامة'}`;
        stmt.run(studentIds[i],randomPick(classIds),rt,desc,`تم التوجيه ${i%2===0?'وابلاغ ولي الأمر':''}`,i%2===0?'أسبوعي':'شهري',statusList[i%4],instructorId);
        count++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${count} تقرير` });
    }

    if (key === 'all' || key === 'issues') {
      const itypes = ['disruption','bullying','absence','cyber','violence','other'];
      const sevs = ['low','medium','high'];
      const statusList = ['open','in_progress','resolved','closed'];
      db.prepare('DELETE FROM counseling_behavior_issues').run();
      const stmt = db.prepare('INSERT INTO counseling_behavior_issues (student_id,class_id,issue_type,description,severity,actions_taken,status,counselor_id) VALUES (?,?,?,?,?,?,?,?)');
      let count = 0;
      for (let i = 0; i < Math.min(studentIds.length, 8); i++) {
        const it = itypes[i%itypes.length];
        const desc = it==='disruption'?'إخلال بالنظام':it==='bullying'?'تنمر':it==='absence'?'تغيب':it==='cyber'?'إنترنت':it==='violence'?'شجار':'مشكلة عامة';
        stmt.run(studentIds[i],randomPick(classIds),it,desc,sevs[i%3],i%2===0?'توجيه':'تحويل',statusList[i%4],instructorId);
        count++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${count} مشكلة` });
    }

    if (key === 'all' || key === 'contracts') {
      const contracts = [{ title:'تحسين السلوك', terms:'يلتزم بالتصرف الحسن', start:'2026-09-01', end:'2026-12-31' },{ title: 'المواظبة', terms:'يلتزم بالحضور', start:'2026-09-15', end:'2026-12-31' }];
      const statusList = ['active','completed','active','breached'];
      db.prepare('DELETE FROM counseling_behavior_contracts').run();
      const stmt = db.prepare('INSERT INTO counseling_behavior_contracts (student_id,class_id,title,terms,start_date,end_date,status,student_signed,parent_signed,counselor_signed,counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      let count = 0;
      for (let i = 0; i < Math.min(studentIds.length, 6); i++) {
        const c = contracts[i%2];
        stmt.run(studentIds[i],randomPick(classIds),c.title,c.terms,c.start,c.end,statusList[i%4],i%2===0?1:0,i%2===0?1:0,1,instructorId);
        count++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${count} عقد` });
    }

    return success({ message: 'تم إنشاء جميع البيانات التجريبية بنجاح' });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || error?.toString() }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
