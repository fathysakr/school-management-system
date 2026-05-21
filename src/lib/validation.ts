export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone validation (basic)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone.trim());
}

// Date validation
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// Age validation
export function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Validate teacher data
export function validateTeacher(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.teacher_id?.trim()) {
    errors.push({ field: 'teacher_id', message: 'رقم المعلم مطلوب' });
  }

  if (!data.first_name?.trim()) {
    errors.push({ field: 'first_name', message: 'الاسم الأول مطلوب' });
  }

  if (!data.last_name?.trim()) {
    errors.push({ field: 'last_name', message: 'الاسم الأخير مطلوب' });
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'صيغة البريد الإلكتروني غير صالحة' });
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push({ field: 'phone', message: 'صيغة رقم الجوال غير صالحة' });
  }

  if (data.date_of_birth && !isValidDate(data.date_of_birth)) {
    errors.push({ field: 'date_of_birth', message: 'صيغة التاريخ غير صالحة' });
  }

  if (data.specialization && !data.specialization.trim()) {
    errors.push({ field: 'specialization', message: 'التخصص لا يمكن أن يكون فارغاً' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Validate student data
export function validateStudent(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.student_id?.trim()) {
    errors.push({ field: 'student_id', message: 'رقم الطالب مطلوب' });
  }

  if (!data.first_name?.trim()) {
    errors.push({ field: 'first_name', message: 'الاسم الأول مطلوب' });
  }

  if (!data.last_name?.trim()) {
    errors.push({ field: 'last_name', message: 'الاسم الأخير مطلوب' });
  }

  if (!data.date_of_birth || !isValidDate(data.date_of_birth)) {
    errors.push({ field: 'date_of_birth', message: 'تاريخ ميلاد صحيح مطلوب' });
  } else {
    const age = getAge(data.date_of_birth);
    if (age < 4 || age > 25) {
      errors.push({ field: 'date_of_birth', message: 'عمر الطالب يجب أن يكون بين 4 و 25 سنة' });
    }
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'صيغة البريد الإلكتروني غير صالحة' });
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push({ field: 'phone', message: 'صيغة رقم الجوال غير صالحة' });
  }

  if (data.parent_email && !isValidEmail(data.parent_email)) {
    errors.push({ field: 'parent_email', message: 'صيغة البريد الإلكتروني لولي الأمر غير صالحة' });
  }

  if (data.parent_phone && !isValidPhone(data.parent_phone)) {
    errors.push({ field: 'parent_phone', message: 'صيغة رقم جوال ولي الأمر غير صالحة' });
  }

  if (data.parent_phones) {
    if (!Array.isArray(data.parent_phones)) {
      errors.push({ field: 'parent_phones', message: 'يجب أن تكون أرقام أولياء الأمور مصفوفة' });
    } else {
      for (let i = 0; i < data.parent_phones.length; i++) {
        if (data.parent_phones[i] && !isValidPhone(data.parent_phones[i])) {
          errors.push({ field: `parent_phones[${i}]`, message: `صيغة رقم جوال غير صالحة في الرقم ${i + 1}` });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Validate class data
export function validateClass(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.class_name?.trim()) {
    errors.push({ field: 'class_name', message: 'اسم الفصل مطلوب' });
  }

  if (!data.grade?.trim()) {
    errors.push({ field: 'grade', message: 'المرحلة الدراسية مطلوبة' });
  }

  if (data.teacher_id !== undefined && data.teacher_id !== null && !data.teacher_id) {
    errors.push({ field: 'teacher_id', message: 'المعلم المحدد غير صالح' });
  }

  if (data.capacity && (isNaN(data.capacity) || data.capacity < 1 || data.capacity > 100)) {
    errors.push({ field: 'capacity', message: 'السعة يجب أن تكون بين 1 و 100' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Sanitize string input
export function sanitizeString(input: string): string {
  return input?.trim().slice(0, 255) || '';
}

// Validate score
export function isValidScore(score: number, total: number = 100): boolean {
  return typeof score === 'number' && score >= 0 && score <= total;
}
