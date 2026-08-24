// Single source of truth for school branding across deployments.
export const SCHOOL_BASE_NAME = 'مدرسة صفوة الرواد الأهلية';

export const STAGE_FULL_NAMES: Record<'middle' | 'high', string> = {
  middle: 'مدرسة صفوة الرواد المتوسطة الأهلية',
  high: 'مدرسة صفوة الرواد الثانوية الأهلية',
};

export const schoolFullName = (stage?: string | null): string =>
  stage === 'middle' || stage === 'high' ? STAGE_FULL_NAMES[stage] : SCHOOL_BASE_NAME;

// For server-side code (API routes / libs): resolves from the deployment env.
export const serverSchoolFullName = (): string =>
  schoolFullName(process.env.NEXT_PUBLIC_SCHOOL_STAGE || null);

// Works in client components too: NEXT_PUBLIC_ vars are inlined at build time.
export const currentSchoolName = (): string =>
  schoolFullName(process.env.NEXT_PUBLIC_SCHOOL_STAGE || null);
