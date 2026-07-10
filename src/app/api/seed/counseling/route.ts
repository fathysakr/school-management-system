import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, success } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const key = body.type || 'all';
    const instructorId = user.id;

    const rget = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

    // ——— توزيع الطلاب على الفصول ———
    if (key === 'all' || key === 'distribute') {
      const students = db.prepare('SELECT id FROM students WHERE status = ? ORDER BY id').all('active');
      const classes = db.prepare('SELECT id FROM classes WHERE status = ? ORDER BY id').all('active');
      const classes = db.prepare('SELECT id FROM classes WHERE status = ? ORDER BY id').all('active') as any[];
      if (students.length > 0 && classes.length > 0) {
        db.prepare('DELETE FROM enrollments').run();
        let enrolled = 0;
        for (let i = 0; i < students.length; i++) {
          const classId = classes[i % classes.length].id;
          const existing = db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?').get(students[i].id, classId);
          if (!existing) {
            db.prepare('INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?,?,?,?)').run(students[i].id, classId, '2026-09-01', 'active');
            enrolled++;
          }
        }
      }
      if (key !== 'all') return success({ message: 'تم توزيع الطلاب على الفصول' });
    }

    // ——— تقارير المعلمين ———
    if (key === 'all' || key === 'teacher_reports') {
      const teachers = db.prepare('SELECT id FROM teachers WHERE status = ? ORDER BY id').all('active');
      const enrollments = db.prepare('SELECT student_id, class_id FROM enrollments WHERE status = ?').all('active');
      const reportTypes = ['activity','positive','behavioral','academic_deficiency'];
      const rtypes: Record<string,string> = {activity:'نشاط',positive:'إيجابي',behavioral:'سلوكي',academic_deficiency:'ضعف دراسي'};
      const contents = [
        'تميز الطالب في النشاط الرياضي المدرسي وحصل على المركز الأول',
        'أظهر الطالب سلوكاً مثالياً في التعامل مع زملائه',
        'تم رصد تحسن ملحوظ في سلوك الطالب بعد الجلسات الإرشادية',
        'يعاني الطالب من ضعف في مادة الرياضيات ويحتاج إلى حصص تقوية',
        'تميز الطالب في المشاركة الصفية وحل الواجبات المنزلية',
        'التزام الطالب بالحضور والانضباط',
        'حاجة الطالب لدعم إضافي في مهارات الكتابة',
        'تم رصد تحسن في مستوى الطالب الدراسي'
      ];
      db.prepare('DELETE FROM teacher_reports').run();
      let inserted = 0;
      const stmt = db.prepare('INSERT INTO teacher_reports (teacher_id,student_id,class_id,report_type,title,content,date,status) VALUES (?,?,?,?,?,?,?,?)');
      for (const e of enrollments) {
        if (inserted >= 20) break;
        const tid = rget(teachers);
        const rt = rget(reportTypes);
        const content = rget(contents);
        stmt.run(tid.id, e.student_id, e.class_id, rt, `تقرير ${rtypes[rt]}`, content, '2026-06-01', 'active');
        inserted++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${inserted} تقرير للمعلمين` });
    }

    // ——— بيانات الإرشاد الطلابي ———
    const studentIds = (db.prepare('SELECT id FROM students WHERE status = ? ORDER BY id').all('active') as any[]).map((s) => s.id);
    const classIds = (db.prepare('SELECT id FROM classes WHERE status = ? ORDER BY id').all('active') as any[]).map((c) => c.id);
    if (!studentIds.length || !classIds.length) return badRequest('لا يوجد طلاب أو فصول');

    const descSuffix = [
      'يحتاج إلى جلسات دعم فردية','تم تحويله إلى الاخصائي النفسي',
      'جاري وضع خطة علاجية','يتابع بالتعاون مع الأهل',
      'تم عمل برنامج تقوية','قيد المتابعة الأسبوعية'
    ];
    const bgSuffix = [
      'يعاني الطالب من ضعف في المهارات الأساسية',
      'الطالب لديه تاريخ من صعوبات التعلم منذ المرحلة الابتدائية',
      'الوالدان منفصلان ويعيش الطالب مع جدته',
      'لاحظ المدرسون تراجعا أدائيا بدأ منذ الشهرين الماضيين',
      'تم رصد الحالة عبر تقارير متعددة من المعلمين'
    ];

    if (key === 'all' || key === 'programs') {
      const items = [
        { title:'برنامج تحسين المستوى الدراسي', domain:'academic', desc:'برنامج مكثف لتحسين المهارات الأساسية في المواد الرئيسية', goals:'رفع نسب النجاح بنسبة 20%', target:'طلاب الصف الأول الثانوي', start:'2026-09-01', end:'2026-12-30' },
        { title:'برنامج تعزيز الصحة النفسية', domain:'psychological', desc:'برنامج توعوي وتدخل مبكر للصحة النفسية', goals:'تعزيز المهارات الاجتماعية والعاطفية', target:'جميع الصفوف', start:'2026-09-15', end:'2026-11-15' },
        { title:'برنامج التوجيه المهني', domain:'guidance', desc:'مساعدة الطلاب في اختيار مساراتهم التعليمية والمهنية', goals:'تمكين الطلاب من اتخاذ قرارات مستنيرة', target:'طلاب الصف الثالث الثانوي', start:'2026-10-01', end:'2027-01-30' },
        { title:'مجلس أولياء الأمور', domain:'community', desc:'برنامج للتواصل مع أولياء الأمور ومتابعة الانضباط', goals:'تعزيز علاقة المدرسة بالبيت', target:'جميع أولياء الأمور', start:'2026-09-20', end:'2026-12-20' },
      ];
      db.prepare('DELETE FROM counseling_programs').run();
      const stmt = db.prepare('INSERT INTO counseling_programs (title,domain,description,goals,target_group,start_date,end_date,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const c of items) stmt.run(c.title,c.domain,c.desc,c.goals,c.target,c.start,c.end,'active',instructorId);
      if (key !== 'all') return success({ message: 'تم إنشاء 4 برامج إرشادية' });
    }

    if (key === 'all' || key === 'cases') {
      const titles = ['حالة صعوبات تعلم','ضعف في مادة الرياضيات','تشتت انتباه','قلق امتحاني','تدني في المستوى التحصيلي','فقدان الدافعية','صعوبة في التركيز','تأخر في القراءة','ضعف مهارات الكتابة'];
      const types = ['academic','behavioral','psychological','social','career'];
      db.prepare('DELETE FROM counseling_cases').run();
      const stmt = db.prepare('INSERT INTO counseling_cases (student_id,class_id,case_type,title,background,analysis,intervention,outcome,recommendations,status,counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      let inserted = 0;
      for (let i = 0; i < Math.min(studentIds.length, 15); i++) {
        stmt.run(studentIds[i],rget(classIds),types[i%5],titles[i%titles.length],rget(descSuffix),rget(bgSuffix),'جلسات إرشاد فردي',i%3===0?'تحسن ملحوظ':i%3===1?'قيد التحسين':'يحتاج لجلسات إضافية','متابعة مستمرة',['open','in_progress','resolved','closed'][i%4],instructorId);
        inserted++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${inserted} دراسة حالة` });
    }

    if (key === 'all' || key === 'attendance_reports') {
      const rtypes = ['absence','behavior','academic','general'];
      db.prepare('DELETE FROM counseling_attendance_reports').run();
      const stmt = db.prepare('INSERT INTO counseling_attendance_reports (student_id,class_id,report_type,description,actions_taken,follow_up,status,counselor_id) VALUES (?,?,?,?,?,?,?,?)');
      let inserted = 0;
      for (let i = 0; i < Math.min(studentIds.length, 12); i++) {
        const rt = rtypes[i%rtypes.length];
        const desc = rt==='absence'?`غياب متكرر لمدة ${i+2} أيام: ${rget(descSuffix)}`:
                     rt==='behavior'?`سلوك غير لائق داخل الفصل: ${rget(descSuffix)}`:
                     `ملاحظة ${rt==='academic'?'تحصيل دراسي':'عامة'}: ${rget(descSuffix)}`;
        stmt.run(studentIds[i],rget(classIds),rt,desc,`تم عمل جلسة توجيه، ${i%2===0?'تم إخطار ولي الأمر':'تم تسليم إنذار كتابي'}`,`متابعة مع المعلمين ${i%2===0?'كل أسبوع':'شهريا'}`,['open','in_progress','resolved','closed'][i%4],instructorId);
        inserted++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${inserted} تقرير غياب وسلوك` });
    }

    if (key === 'all' || key === 'issues') {
      const itypes = ['disruption','bullying','absence','cyber','violence','other'];
      const sevs = ['low','medium','high'];
      db.prepare('DELETE FROM counseling_behavior_issues').run();
      const stmt = db.prepare('INSERT INTO counseling_behavior_issues (student_id,class_id,issue_type,description,severity,actions_taken,status,counselor_id) VALUES (?,?,?,?,?,?,?,?)');
      let inserted = 0;
      for (let i = 0; i < Math.min(studentIds.length, 8); i++) {
        const it = itypes[i%itypes.length];
        const desc = it==='disruption'?`إخلال مستمر بالنظام: ${rget(descSuffix)}`:
                     it==='bullying'?`التنمر على الزملاء: ${rget(descSuffix)}`:
                     it==='absence'?`تغيب بدون عذر: ${rget(descSuffix)}`:
                     it==='cyber'?`استخدام غير آمن للإنترنت: ${rget(descSuffix)}`:
                     it==='violence'?`شجار مع زميل: ${rget(descSuffix)}`:
                     `مشكلة طلابية عامة: ${rget(descSuffix)}`;
        stmt.run(studentIds[i],rget(classIds),it,desc,sevs[i%3],i%2===0?'تم عقد جلسة توجيه، التواصل':'تم تحويل الطالب للمرشد',['open','in_progress','resolved','closed'][i%4],instructorId);
        inserted++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${inserted} مشكلة طلابية` });
    }

    if (key === 'all' || key === 'contracts') {
      const contracts = [
        { title:'عقد تحسين السلوك', terms:'يلتزم الطالب بعدم التحدث أثناء الشرح واحترام المعلمين. في حال الإخلال سيتم اتخاذ إجراءات.', start:'2026-09-01', end:'2026-12-31' },
        { title:'عقد المواظبة على الحضور', terms:'يلتزم الطالب بالحضور اليومي وعدم التغيب بدون عذر.', start:'2026-09-15', end:'2026-12-31' },
      ];
      db.prepare('DELETE FROM counseling_behavior_contracts').run();
      const stmt = db.prepare('INSERT INTO counseling_behavior_contracts (student_id,class_id,title,terms,start_date,end_date,status,student_signed,parent_signed,counselor_signed,counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      let inserted = 0;
      for (let i = 0; i < Math.min(studentIds.length, 6); i++) {
        const c = contracts[i%2];
        stmt.run(studentIds[i],rget(classIds),c.title,c.terms,c.start,c.end,['active','completed','active','breached'][i%4],i%2===0?1:0,i%2===0?1:0,1,instructorId);
        inserted++;
      }
      if (key !== 'all') return success({ message: `تم إنشاء ${inserted} عقد سلوك` });
    }

    return success({ message: 'تم إنشاء جميع البيانات التجريبية بنجاح' });
  } catch (error: any) {
    console.error('Seed all error:', error);
    return new Response(JSON.stringify({ error: error?.message || error?.toString() }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
