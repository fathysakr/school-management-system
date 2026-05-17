# 🚀 Quick Start Guide - دليل البدء السريع

## في 5 خطوات، ابدأ الآن!

### الخطوة 1️⃣: تثبيت المتطلبات

```bash
npm install
```

انتظر حتى تنتهي عملية التثبيت (قد تستغرق 2-3 دقائق)

---

### الخطوة 2️⃣: تشغيل السيرفر

```bash
npm run dev
```

ستظهر رسالة مثل:
```
> school-management-system@0.1.0 dev
> next dev

  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
```

فتح المتصفح على: **http://localhost:3000**

---

### الخطوة 3️⃣: إنشاء حساب Admin

استخدم **Postman** أو أي أداة مشابهة:

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "admin@school.com",
  "password": "Admin123!",
  "role": "admin"
}
```

احفظ الـ **token** من الرد

---

### الخطوة 4️⃣: أضف معلماً

```http
POST http://localhost:3000/api/teachers
Authorization: Bearer {YOUR_TOKEN}
Content-Type: application/json

{
  "teacher_id": "T001",
  "first_name": "أحمد",
  "last_name": "محمد",
  "email": "ahmed@school.com",
  "specialization": "الرياضيات"
}
```

---

### الخطوة 5️⃣: أضف طالباً

```http
POST http://localhost:3000/api/students
Authorization: Bearer {YOUR_TOKEN}
Content-Type: application/json

{
  "student_id": "S001",
  "first_name": "علي",
  "last_name": "أحمد",
  "date_of_birth": "2010-05-20",
  "email": "ali@school.com",
  "parent_email": "parent@gmail.com"
}
```

## ✅ تمام! النظام يعمل الآن!

---

## 📚 الخطوات التالية

### 1. استكشف الـ API الكاملة
اقرأ [README.md](./README.md) للحصول على قائمة كاملة بجميع الـ endpoints

### 2. اختبر المزيد من الميزات
اتبع [API_TESTING.md](./API_TESTING.md) لاختبار جميع الميزات

### 3. افهم الأمان
اقرأ [SECURITY_REPORT.md](./SECURITY_REPORT.md) لفهم مميزات الأمان

### 4. ابدأ التطوير
أضف مكونات React جديدة في `src/components/`

---

## 🎯 الميزات الأساسية الجاهزة الآن

✅ المصادقة والتسجيل  
✅ إدارة المعلمين  
✅ إدارة الطلاب  
✅ إدارة الفصول  
✅ تسجيل الحضور  
✅ إدارة الدرجات  
✅ البحث والتصفية  
✅ نظام الأدوار والصلاحيات  

---

## 🆘 استكشاف الأخطاء

### المشكلة: "Connection refused"
**الحل:** تأكد من أن السيرفر يعمل (`npm run dev`)

### المشكلة: "Module not found"
**الحل:** أعد تثبيت المتطلبات (`npm install`)

### المشكلة: "Invalid token"
**الحل:** استخدم الـ token الصحيح من عملية تسجيل الدخول

### المشكلة: "Database is locked"
**الحل:** أغلق جميع نوافذ السيرفر وأعد التشغيل

---

## 💡 نصائح

1. **استخدم Postman:** سهل وسريع للاختبار
2. **احفظ الـ Tokens:** استخدمها في طلبات متعددة
3. **تحقق من الرد:** اقرأ رسائل الخطأ بعناية
4. **استعمل البحث:** جرب البحث والتصفية

---

## 📞 تحتاج مساعدة؟

راجع الملفات:
- [README.md](./README.md) - توثيق شامل
- [API_TESTING.md](./API_TESTING.md) - أمثلة عملية
- [CHANGELOG.md](./CHANGELOG.md) - ملخص البناء

---

## 🎉 ممتاز!

أنت الآن جاهز للبدء بالتطوير!

اختر:
- **Frontend Development** → اقرأ [TODO.md](./TODO.md)
- **API Development** → اقرأ [README.md](./README.md)
- **Security Review** → اقرأ [SECURITY_REPORT.md](./SECURITY_REPORT.md)

---

**Happy Coding! 🚀**
