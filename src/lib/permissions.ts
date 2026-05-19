export type Permission =
  | 'teachers:view' | 'teachers:create' | 'teachers:edit' | 'teachers:delete'
  | 'students:view' | 'students:create' | 'students:edit' | 'students:delete'
  | 'classes:view' | 'classes:create' | 'classes:edit' | 'classes:delete'
  | 'attendance:view' | 'attendance:create' | 'attendance:edit'
  | 'grades:view' | 'grades:create' | 'grades:edit' | 'grades:delete'
  | 'reports:view' | 'reports:create' | 'reports:edit' | 'reports:delete'
  | 'schedules:view' | 'schedules:create' | 'schedules:edit' | 'schedules:delete'
  | 'substitutions:view' | 'substitutions:create' | 'substitutions:edit' | 'substitutions:delete'
  | 'attendance:delete'
  | 'announcements:view' | 'announcements:create' | 'announcements:edit' | 'announcements:delete'
  | 'dashboard:stats'
  | 'settings:edit';

export type UserRole = 'admin' | 'middle_supervisor' | 'high_supervisor' | 'middle_teacher' | 'high_teacher' | 'middle_counselor' | 'high_counselor' | 'middle_principal' | 'high_principal' | 'middle_monitor' | 'high_monitor' | 'middle_admin_staff' | 'high_admin_staff';

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    'teachers:view', 'teachers:create', 'teachers:edit', 'teachers:delete',
    'students:view', 'students:create', 'students:edit', 'students:delete',
    'classes:view', 'classes:create', 'classes:edit', 'classes:delete',
    'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete',
    'grades:view', 'grades:create', 'grades:edit', 'grades:delete',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete',
    'schedules:view', 'schedules:create', 'schedules:edit', 'schedules:delete',
    'substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete',
    'announcements:view', 'announcements:create', 'announcements:edit', 'announcements:delete',
    'dashboard:stats', 'settings:edit',
  ],
  middle_supervisor: [
    'teachers:view', 'teachers:create', 'teachers:edit',
    'students:view', 'students:create', 'students:edit',
    'classes:view', 'classes:create', 'classes:edit',
    'attendance:view', 'attendance:create', 'attendance:edit',
    'grades:view', 'grades:create', 'grades:edit',
    'reports:view', 'reports:create', 'reports:edit',
    'schedules:view', 'schedules:create', 'schedules:edit',
    'substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete',
    'announcements:view', 'announcements:create', 'announcements:edit',
    'dashboard:stats',
  ],
  high_supervisor: [
    'teachers:view', 'teachers:create', 'teachers:edit',
    'students:view', 'students:create', 'students:edit',
    'classes:view', 'classes:create', 'classes:edit',
    'attendance:view', 'attendance:create', 'attendance:edit',
    'grades:view', 'grades:create', 'grades:edit',
    'reports:view', 'reports:create', 'reports:edit',
    'schedules:view', 'schedules:create', 'schedules:edit',
    'substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete',
    'announcements:view', 'announcements:create', 'announcements:edit',
    'dashboard:stats',
  ],
  middle_teacher: [
    'students:view',
    'classes:view',
    'attendance:view', 'attendance:create',
    'grades:view', 'grades:create', 'grades:edit',
    'reports:view', 'reports:create', 'reports:edit',
    'schedules:view',
    'substitutions:view',
    'announcements:view',
    'dashboard:stats',
  ],
  high_teacher: [
    'students:view',
    'classes:view',
    'attendance:view', 'attendance:create',
    'grades:view', 'grades:create', 'grades:edit',
    'reports:view', 'reports:create', 'reports:edit',
    'schedules:view',
    'substitutions:view',
    'announcements:view',
    'dashboard:stats',
  ],
  middle_counselor: [
    'teachers:view',
    'students:view',
    'classes:view',
    'attendance:view',
    'grades:view',
    'reports:view',
    'schedules:view',
    'announcements:view',
    'dashboard:stats',
  ],
  high_counselor: [
    'teachers:view',
    'students:view',
    'classes:view',
    'attendance:view',
    'grades:view',
    'reports:view',
    'schedules:view',
    'announcements:view',
    'dashboard:stats',
  ],
  middle_monitor: [
    'teachers:view',
    'students:view',
    'classes:view',
    'attendance:view',
    'grades:view',
    'reports:view',
    'schedules:view',
    'announcements:view',
    'dashboard:stats',
  ],
  high_monitor: [
    'teachers:view',
    'students:view',
    'classes:view',
    'attendance:view',
    'grades:view',
    'reports:view',
    'schedules:view',
    'announcements:view',
    'dashboard:stats',
  ],
  middle_admin_staff: [
    'teachers:view', 'teachers:create', 'teachers:edit',
    'students:view', 'students:create', 'students:edit',
    'classes:view', 'classes:create', 'classes:edit',
    'attendance:view', 'attendance:create', 'attendance:edit',
    'grades:view', 'grades:create', 'grades:edit',
    'reports:view', 'reports:create', 'reports:edit',
    'schedules:view', 'schedules:create', 'schedules:edit',
    'substitutions:view', 'substitutions:create', 'substitutions:edit',
    'announcements:view', 'announcements:create', 'announcements:edit',
    'dashboard:stats',
  ],
  high_admin_staff: [
    'teachers:view', 'teachers:create', 'teachers:edit',
    'students:view', 'students:create', 'students:edit',
    'classes:view', 'classes:create', 'classes:edit',
    'attendance:view', 'attendance:create', 'attendance:edit',
    'grades:view', 'grades:create', 'grades:edit',
    'reports:view', 'reports:create', 'reports:edit',
    'schedules:view', 'schedules:create', 'schedules:edit',
    'substitutions:view', 'substitutions:create', 'substitutions:edit',
    'announcements:view', 'announcements:create', 'announcements:edit',
    'dashboard:stats',
  ],
  middle_principal: [
    'teachers:view', 'teachers:create', 'teachers:edit', 'teachers:delete',
    'students:view', 'students:create', 'students:edit', 'students:delete',
    'classes:view', 'classes:create', 'classes:edit', 'classes:delete',
    'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete',
    'grades:view', 'grades:create', 'grades:edit', 'grades:delete',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete',
    'schedules:view', 'schedules:create', 'schedules:edit', 'schedules:delete',
    'substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete',
    'announcements:view', 'announcements:create', 'announcements:edit', 'announcements:delete',
    'dashboard:stats',
  ],
  high_principal: [
    'teachers:view', 'teachers:create', 'teachers:edit', 'teachers:delete',
    'students:view', 'students:create', 'students:edit', 'students:delete',
    'classes:view', 'classes:create', 'classes:edit', 'classes:delete',
    'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete',
    'grades:view', 'grades:create', 'grades:edit', 'grades:delete',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete',
    'schedules:view', 'schedules:create', 'schedules:edit', 'schedules:delete',
    'substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete',
    'announcements:view', 'announcements:create', 'announcements:edit', 'announcements:delete',
    'dashboard:stats',
  ],
};

const allPermissions: Permission[] = [
  'teachers:view', 'teachers:create', 'teachers:edit', 'teachers:delete',
  'students:view', 'students:create', 'students:edit', 'students:delete',
  'classes:view', 'classes:create', 'classes:edit', 'classes:delete',
  'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete',
  'grades:view', 'grades:create', 'grades:edit', 'grades:delete',
  'reports:view', 'reports:create', 'reports:edit', 'reports:delete',
  'schedules:view', 'schedules:create', 'schedules:edit', 'schedules:delete',
  'substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete',
  'announcements:view', 'announcements:create', 'announcements:edit', 'announcements:delete',
  'dashboard:stats',
];

const permissionLabels: Record<Permission, string> = {
  'teachers:view': 'عرض المعلمين',
  'teachers:create': 'إضافة معلم',
  'teachers:edit': 'تعديل معلم',
  'teachers:delete': 'حذف معلم',
  'students:view': 'عرض الطلاب',
  'students:create': 'إضافة طالب',
  'students:edit': 'تعديل طالب',
  'students:delete': 'حذف طالب',
  'classes:view': 'عرض الفصول',
  'classes:create': 'إضافة فصل',
  'classes:edit': 'تعديل فصل',
  'classes:delete': 'حذف فصل',
  'attendance:view': 'عرض الحضور',
  'attendance:create': 'تسجيل حضور',
  'attendance:edit': 'تعديل حضور',
  'attendance:delete': 'حذف حضور',
  'grades:view': 'عرض الدرجات',
  'grades:create': 'إضافة درجة',
  'grades:edit': 'تعديل درجة',
  'grades:delete': 'حذف درجة',
  'reports:view': 'عرض التقارير',
  'reports:create': 'إضافة تقرير',
  'reports:edit': 'تعديل تقرير',
  'reports:delete': 'حذف تقرير',
  'schedules:view': 'عرض الجداول',
  'schedules:create': 'إضافة جدول',
  'schedules:edit': 'تعديل جدول',
  'schedules:delete': 'حذف جدول',
  'substitutions:view': 'عرض البدائل',
  'substitutions:create': 'إضافة بديل',
  'substitutions:edit': 'تعديل بديل',
  'substitutions:delete': 'حذف بديل',
  'announcements:view': 'عرض الإعلانات',
  'announcements:create': 'إضافة إعلان',
  'announcements:edit': 'تعديل إعلان',
  'announcements:delete': 'حذف إعلان',
  'dashboard:stats': 'عرض الإحصائيات',
  'settings:edit': 'إدارة الإعدادات',
};

const permissionGroups: { label: string; keys: Permission[] }[] = [
  { label: 'المعلمون', keys: ['teachers:view', 'teachers:create', 'teachers:edit', 'teachers:delete'] },
  { label: 'الطلاب', keys: ['students:view', 'students:create', 'students:edit', 'students:delete'] },
  { label: 'الفصول', keys: ['classes:view', 'classes:create', 'classes:edit', 'classes:delete'] },
  { label: 'الحضور', keys: ['attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete'] },
  { label: 'الدرجات', keys: ['grades:view', 'grades:create', 'grades:edit', 'grades:delete'] },
  { label: 'التقارير', keys: ['reports:view', 'reports:create', 'reports:edit', 'reports:delete'] },
  { label: 'الجداول', keys: ['schedules:view', 'schedules:create', 'schedules:edit', 'schedules:delete'] },
  { label: 'البدائل', keys: ['substitutions:view', 'substitutions:create', 'substitutions:edit', 'substitutions:delete'] },
  { label: 'الإعلانات', keys: ['announcements:view', 'announcements:create', 'announcements:edit', 'announcements:delete'] },
  { label: 'عام', keys: ['dashboard:stats', 'settings:edit'] },
];

export function hasPermission(role: UserRole | undefined, permission: Permission, customPermissions?: string[] | null): boolean {
  if (!role) return false;
  if (customPermissions) {
    return customPermissions.includes(permission);
  }
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function canAccessRole(currentRole: UserRole | undefined, targetRole: UserRole): boolean {
  if (!currentRole) return false;
  if (currentRole === 'admin') return true;
  const hierarchy: Record<string, number> = {
    monitor: 0,
    admin_staff: 0,
    counselor: 1,
    teacher: 2,
    supervisor: 3,
    principal: 4,
  };
  const currentBase = currentRole.split('_').slice(1).join('_');
  const targetBase = targetRole.split('_').slice(1).join('_');
  const currentSchool = currentRole.split('_')[0];
  const targetSchool = targetRole.split('_')[0];
  if (currentSchool !== 'admin' && currentSchool !== targetSchool) return false;
  const currentLevel = hierarchy[currentBase] ?? -1;
  const targetLevel = hierarchy[targetBase] ?? -1;
  return currentLevel >= targetLevel;
}

export function getSchoolStage(role: UserRole): 'middle' | 'high' | 'both' {
  if (role === 'admin') return 'both';
  if (role.includes('middle_')) return 'middle';
  return 'high';
}

export function getSchoolFilter(role: UserRole, adminOverride?: string): { grade?: string; school?: string } {
  const stage = getSchoolStage(role);
  if (stage === 'both') {
    if (adminOverride) {
      const gradeLabel = adminOverride === 'middle' ? 'متوسط' : 'ثانوي';
      return { grade: gradeLabel, school: adminOverride };
    }
    return {};
  }
  const gradeLabel = stage === 'middle' ? 'متوسط' : 'ثانوي';
  return { grade: gradeLabel, school: stage };
}

export { rolePermissions, allPermissions, permissionLabels, permissionGroups };
