'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SchedulingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/schedules'); }, [router]);
  return null;
}
