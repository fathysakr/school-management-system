# School Management System

نظام متكامل لإدارة المدارس مبني على Next.js و TypeScript مع SQLite كقاعدة بيانات.

## المميزات

✅ نظام مصادقة آمن (JWT)  
✅ إدارة المعلمين والطلاب والفصول  
✅ تسجيل الحضور والغياب  
✅ نظام الدرجات والنتائج  
✅ الحماية من SQL Injection  
✅ التحقق الصارم من البيانات  
✅ نظام أدوار وصلاحيات  
✅ API RESTful كاملة  

## متطلبات التثبيت

- Node.js 18+ 
- npm أو yarn

## التثبيت والتشغيل

### 1. تثبيت المتطلبات
```bash
npm install
```

### 2. إنشاء ملف البيئة
```bash
cp .env.example .env.local
```

### 3. تشغيل سيرفر التطوير
```bash
npm run dev
```

السيرفر سيعمل على `http://localhost:3000`

### 4. بناء للإنتاج
```bash
npm run build
npm run start
```

## بنية المشروع

```
school-management-system/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # تسجيل الدخول والتسجيل
│   │   │   ├── teachers/      # إدارة المعلمين
│   │   │   ├── students/      # إدارة الطلاب
│   │   │   ├── classes/       # إدارة الفصول والتسجيل
│   │   │   ├── attendance/    # الحضور والغياب
│   │   │   └── grades/        # الدرجات والنتائج
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/            # مكونات React
│   ├── lib/
│   │   ├── database.ts        # إعدادات قاعدة البيانات
│   │   ├── auth.ts            # المصادقة والتوثيق
│   │   └── validation.ts      # التحقق من البيانات
│   └── types/
│       └── index.ts           # تعريفات TypeScript
├── data/                       # قاعدة البيانات (تُنشأ تلقائياً)
├── .env.local                  # متغيرات البيئة
└── package.json
```

## API الرئيسية

### المصادقة

#### التسجيل
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "role": "student"  # admin, teacher, parent, student
}
```

#### تسجيل الدخول
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**الرد:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "student"
  },
  "token": "eyJhbGc..."
}
```

### المعلمون

#### الحصول على قائمة المعلمين
```http
GET /api/teachers?page=1&limit=10&search=ahmed&status=active
Authorization: Bearer {token}
```

#### إضافة معلم جديد (admin only)
```http
POST /api/teachers
Authorization: Bearer {token}
Content-Type: application/json

{
  "teacher_id": "T001",
  "first_name": "أحمد",
  "last_name": "محمد",
  "email": "ahmed@example.com",
  "phone": "+966501234567",
  "specialization": "الرياضيات",
  "gender": "male",
  "date_of_birth": "1990-01-15",
  "address": "الرياض"
}
```

#### تحديث معلم
```http
PUT /api/teachers/1
Authorization: Bearer {token}
Content-Type: application/json

{
  "first_name": "أحمد",
  "specialization": "العلوم"
}
```

#### حذف معلم (soft delete)
```http
DELETE /api/teachers/1
Authorization: Bearer {token}
```

### الطلاب

#### الحصول على قائمة الطلاب
```http
GET /api/students?page=1&limit=10&search=علي&status=active&class_id=1
Authorization: Bearer {token}
```

#### إضافة طالب جديد
```http
POST /api/students
Authorization: Bearer {token}
Content-Type: application/json

{
  "student_id": "S001",
  "first_name": "علي",
  "last_name": "أحمد",
  "date_of_birth": "2010-05-20",
  "gender": "male",
  "email": "ali@example.com",
  "parent_email": "parent@example.com",
  "parent_phone": "+966501234567",
  "enrollment_date": "2024-01-15"
}
```

### الفصول

#### الحصول على قائمة الفصول
```http
GET /api/classes?page=1&limit=10&grade=6&teacher_id=1
Authorization: Bearer {token}
```

#### إنشاء فصل جديد
```http
POST /api/classes
Authorization: Bearer {token}
Content-Type: application/json

{
  "class_name": "6-A",
  "grade": "6",
  "section": "A",
  "teacher_id": 1,
  "room_number": "201",
  "capacity": 35
}
```

#### تسجيل طالب في فصل
```http
POST /api/classes/enrollment
Authorization: Bearer {token}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1
}
```

#### إلغاء تسجيل طالب
```http
DELETE /api/classes/enrollment?student_id=1&class_id=1
Authorization: Bearer {token}
```

### الحضور

#### تسجيل حضور
```http
POST /api/attendance
Authorization: Bearer {token}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1,
  "attendance_date": "2024-01-15",
  "status": "present",  # present, absent, late, excused
  "remarks": "ملاحظات اختيارية"
}
```

#### الحصول على سجل الحضور
```http
GET /api/attendance?student_id=1&class_id=1&date=2024-01-15
Authorization: Bearer {token}
```

#### تحميل حضور جماعي
```http
PUT /api/attendance
Authorization: Bearer {token}
Content-Type: application/json

{
  "class_id": 1,
  "attendance_date": "2024-01-15",
  "records": [
    {"student_id": 1, "status": "present"},
    {"student_id": 2, "status": "absent", "remarks": "مرض"},
    {"student_id": 3, "status": "late"}
  ]
}
```

### الدرجات

#### تسجيل درجة
```http
POST /api/grades
Authorization: Bearer {token}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1,
  "subject": "الرياضيات",
  "assessment_type": "test",  # test, quiz, assignment, midterm, final
  "score": 95,
  "total_score": 100,
  "assessment_date": "2024-01-15"
}
```

#### الحصول على الدرجات
```http
GET /api/grades?student_id=1&class_id=1&subject=الرياضيات
Authorization: Bearer {token}
```

#### الحصول على كشف النتائج
```http
GET /api/grades?student_id=1&transcript=true
Authorization: Bearer {token}
```

## نظام الأدوار والصلاحيات

### Admin (المسؤول)
- إدارة جميع المعلمين والطلاب
- إدارة الفصول
- تعيين المعلمين للفصول
- عرض جميع البيانات

### Teacher (المعلم)
- عرض الطلاب الموكلين إليه
- تسجيل الحضور
- إدخال الدرجات
- عرض تقارير الفصل

### Parent (ولي الأمر)
- عرض بيانات الطالب
- عرض الدرجات والحضور
- عرض التقارير

### Student (الطالب)
- عرض درجاته وحضوره
- عرض جدول الحصص
- عرض الإعلانات

## التحقق من البيانات

جميع البيانات تخضع للتحقق الصارم:

- ✅ التحقق من الحقول المطلوبة
- ✅ تنسيق البريد الإلكتروني
- ✅ تنسيق أرقام الهواتف
- ✅ صحة التواريخ
- ✅ نطاق الدرجات
- ✅ تنظيف المدخلات (sanitization)
- ✅ الحماية من SQL Injection
- ✅ التحقق من الحدود القصوى للقيم

## الأمان

- 🔐 تشفير كلمات المرور باستخدام bcryptjs
- 🔐 توثيق JWT آمن
- 🔐 التحقق من الصلاحيات في كل endpoint
- 🔐 حماية من SQL Injection
- 🔐 تنظيف المدخلات
- 🔐 CORS مفعل

## ملفات قاعدة البيانات

يتم إنشاء قاعدة البيانات تلقائياً عند الطلب الأول:

```
data/
└── school.db
```

## استكمال المشروع

### المكونات الأمامية (Frontend)
- صفحات تسجيل الدخول
- لوحة التحكم
- نماذج إدارة البيانات
- التقارير والإحصائيات
- الرسوم البيانية

### ميزات إضافية
- نظام الإجازات
- الإعلانات والتنبيهات
- رفع الملفات (الصور والمستندات)
- تصدير التقارير (PDF/Excel)
- نظام الدفع (للرسوم الدراسية)
- التكامل مع البريد الإلكتروني
- SMS notification
- تطبيق جوال
- لوحة تحليلات متقدمة

## المساهمة

يمكنك المساهمة في تطوير المشروع بإضافة المزيد من الميزات والتحسينات.

## الترخيص

MIT License

## التواصل

للأسئلة والدعم، يرجى فتح issue في المستودع.

---

**تم البناء بـ Next.js 14 + TypeScript + SQLite + Better-SQLite3 + Material-UI**
