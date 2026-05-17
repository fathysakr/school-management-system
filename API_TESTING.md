# API Testing Guide - دليل اختبار الـ API

قم باختبار الـ API باستخدام Postman أو أي أداة مشابهة

## 1. إنشاء حساب Admin

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "admin@school.com",
  "password": "AdminPass123!",
  "role": "admin"
}
```

**الرد:**
```json
{
  "message": "Registration successful",
  "user": {
    "id": 1,
    "email": "admin@school.com",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

احفظ الـ token - ستحتاجه في الطلبات التالية

---

## 2. تسجيل الدخول

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@school.com",
  "password": "AdminPass123!"
}
```

---

## 3. إضافة معلمين

لكل الطلبات التالية، أضف في الـ Headers:
```
Authorization: Bearer {YOUR_TOKEN}
Content-Type: application/json
```

### المعلم الأول

```http
POST http://localhost:3000/api/teachers
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "teacher_id": "T001",
  "first_name": "أحمد",
  "last_name": "محمد",
  "email": "ahmed@school.com",
  "phone": "+966501234567",
  "specialization": "الرياضيات",
  "gender": "male",
  "date_of_birth": "1990-01-15",
  "address": "الرياض"
}
```

### المعلم الثاني

```http
POST http://localhost:3000/api/teachers
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "teacher_id": "T002",
  "first_name": "فاطمة",
  "last_name": "علي",
  "email": "fatima@school.com",
  "phone": "+966502222222",
  "specialization": "العلوم",
  "gender": "female",
  "date_of_birth": "1992-03-20"
}
```

---

## 4. الحصول على قائمة المعلمين

```http
GET http://localhost:3000/api/teachers?page=1&limit=10&status=active
Authorization: Bearer {TOKEN}
```

**مع البحث:**
```http
GET http://localhost:3000/api/teachers?page=1&limit=10&search=أحمد&status=active
Authorization: Bearer {TOKEN}
```

---

## 5. الحصول على معلم محدد

```http
GET http://localhost:3000/api/teachers/1
Authorization: Bearer {TOKEN}
```

---

## 6. تحديث معلم

```http
PUT http://localhost:3000/api/teachers/1
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "specialization": "الفيزياء",
  "phone": "+966501111111"
}
```

---

## 7. إضافة طلاب

### الطالب الأول

```http
POST http://localhost:3000/api/students
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": "S001",
  "first_name": "علي",
  "last_name": "أحمد",
  "date_of_birth": "2010-05-20",
  "gender": "male",
  "email": "ali@school.com",
  "phone": "+966505555555",
  "parent_email": "parent1@gmail.com",
  "parent_phone": "+966506666666"
}
```

### الطالب الثاني

```http
POST http://localhost:3000/api/students
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": "S002",
  "first_name": "سارة",
  "last_name": "محمد",
  "date_of_birth": "2010-08-15",
  "gender": "female",
  "email": "sarah@school.com",
  "parent_email": "parent2@gmail.com"
}
```

### الطالب الثالث

```http
POST http://localhost:3000/api/students
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": "S003",
  "first_name": "حسن",
  "last_name": "علي",
  "date_of_birth": "2011-02-10",
  "gender": "male",
  "email": "hassan@school.com",
  "parent_email": "parent3@gmail.com"
}
```

---

## 8. الحصول على قائمة الطلاب

```http
GET http://localhost:3000/api/students?page=1&limit=10&status=active
Authorization: Bearer {TOKEN}
```

**مع البحث:**
```http
GET http://localhost:3000/api/students?page=1&limit=10&search=علي&status=active
Authorization: Bearer {TOKEN}
```

---

## 9. إنشاء فصول

### الفصل الأول

```http
POST http://localhost:3000/api/classes
Authorization: Bearer {TOKEN}
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

استبدل `teacher_id: 1` بـ ID المعلم الفعلي

### الفصل الثاني

```http
POST http://localhost:3000/api/classes
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "class_name": "6-B",
  "grade": "6",
  "section": "B",
  "teacher_id": 2,
  "room_number": "202",
  "capacity": 35
}
```

---

## 10. الحصول على الفصول

```http
GET http://localhost:3000/api/classes?page=1&limit=10&grade=6
Authorization: Bearer {TOKEN}
```

---

## 11. الحصول على معلومات فصل محدد

```http
GET http://localhost:3000/api/classes/1
Authorization: Bearer {TOKEN}
```

---

## 12. تسجيل طلاب في فصل

```http
POST http://localhost:3000/api/classes/enrollment
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1
}
```

### تسجيل الطالب الثاني

```http
POST http://localhost:3000/api/classes/enrollment
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 2,
  "class_id": 1
}
```

### تسجيل الطالب الثالث

```http
POST http://localhost:3000/api/classes/enrollment
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 3,
  "class_id": 1
}
```

---

## 13. تسجيل الحضور

### تسجيل حضور فردي

```http
POST http://localhost:3000/api/attendance
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1,
  "attendance_date": "2024-01-15",
  "status": "present"
}
```

### تسجيل حضور جماعي (Bulk)

```http
PUT http://localhost:3000/api/attendance
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "class_id": 1,
  "attendance_date": "2024-01-15",
  "records": [
    {
      "student_id": 1,
      "status": "present"
    },
    {
      "student_id": 2,
      "status": "absent",
      "remarks": "مرض"
    },
    {
      "student_id": 3,
      "status": "late"
    }
  ]
}
```

---

## 14. الحصول على سجل الحضور

```http
GET http://localhost:3000/api/attendance?student_id=1&class_id=1
Authorization: Bearer {TOKEN}
```

**حسب التاريخ:**
```http
GET http://localhost:3000/api/attendance?class_id=1&date=2024-01-15
Authorization: Bearer {TOKEN}
```

---

## 15. تسجيل الدرجات

### درجة فردية

```http
POST http://localhost:3000/api/grades
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1,
  "subject": "الرياضيات",
  "assessment_type": "test",
  "score": 95,
  "total_score": 100,
  "assessment_date": "2024-01-15"
}
```

### درجات أخرى

```http
POST http://localhost:3000/api/grades
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 2,
  "class_id": 1,
  "subject": "الرياضيات",
  "assessment_type": "test",
  "score": 85,
  "total_score": 100,
  "assessment_date": "2024-01-15"
}
```

```http
POST http://localhost:3000/api/grades
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1,
  "subject": "الرياضيات",
  "assessment_type": "quiz",
  "score": 19,
  "total_score": 20,
  "assessment_date": "2024-01-14"
}
```

---

## 16. الحصول على الدرجات

```http
GET http://localhost:3000/api/grades?student_id=1&class_id=1
Authorization: Bearer {TOKEN}
```

**حسب الموضوع:**
```http
GET http://localhost:3000/api/grades?student_id=1&subject=الرياضيات
Authorization: Bearer {TOKEN}
```

---

## 17. حالات الخطأ - اختبر الحماية

### محاولة إضافة معلم بدون توثيق (يجب أن تفشل)

```http
POST http://localhost:3000/api/teachers
Content-Type: application/json

{
  "teacher_id": "T099",
  "first_name": "محاولة",
  "last_name": "هجوم"
}
```

**الرد المتوقع:**
```json
{
  "error": "Unauthorized"
}
```

---

### محاولة إضافة معلم برسالة غير صحيحة

```http
POST http://localhost:3000/api/teachers
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "teacher_id": "",
  "first_name": "الخطأ"
}
```

**الرد المتوقع:**
```json
{
  "error": "Validation failed: Teacher ID is required"
}
```

---

### محاولة إضافة طالب بتاريخ ميلاد غير صحيح

```http
POST http://localhost:3000/api/students
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": "S999",
  "first_name": "اختبار",
  "last_name": "خطأ",
  "date_of_birth": "2030-01-01"
}
```

**الرد المتوقع:**
```json
{
  "error": "Validation failed: Student age must be between 4 and 25"
}
```

---

### محاولة إضافة درجة خارج النطاق

```http
POST http://localhost:3000/api/grades
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "student_id": 1,
  "class_id": 1,
  "subject": "الرياضيات",
  "assessment_type": "test",
  "score": 150,
  "total_score": 100
}
```

**الرد المتوقع:**
```json
{
  "error": "Score must be between 0 and 100"
}
```

---

## ملاحظات مهمة

1. **الـ Tokens:** جميع الطلبات (ما عدا login و register) تحتاج توثيق
2. **الصيانة:** ركز على صيغة البيانات وليس القيم الحرفية
3. **الأخطاء:** ستجد رسائل خطأ واضحة تساعدك على تصحيح الطلب
4. **الترقيم:** استخدم الـ IDs الفعلية المرجعة من الـ API
5. **CORS:** الـ API تدعم CORS لذلك يمكنك استدعاؤها من تطبيق الويب

---

## أوامر مفيدة

### النسخ واللصق في Postman

استخدم Postman Collection لاستيراد جميع الطلبات دفعة واحدة

```json
{
  "info": {
    "name": "School Management System API",
    "version": "1.0.0"
  },
  "item": [
    {
      "name": "Register",
      "request": {
        "method": "POST",
        "header": [],
        "url": {
          "raw": "http://localhost:3000/api/auth/register",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "auth", "register"]
        }
      }
    }
  ]
}
```

---

استمتع باختبار الـ API! 🚀
