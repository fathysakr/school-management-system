'use client';
import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { Assignment, Book, CalendarToday, SwapHoriz } from '@mui/icons-material';
import TeacherAssignments from './TeacherAssignments';
import SubjectsManagement from './SubjectsManagement';
import SchedulePanel from './SchedulePanel';
import SubstitutionPanel from './SubstitutionPanel';

export default function AcademicManagement() {
  const [subTab, setSubTab] = useState(0);

  return (
    <Box>
      <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<Assignment />} label="تعيينات المعلمين" iconPosition="start" />
        <Tab icon={<Book />} label="المواد الدراسية" iconPosition="start" />
        <Tab icon={<CalendarToday />} label="الجداول" iconPosition="start" />
        <Tab icon={<SwapHoriz />} label="حصص الانتظار" iconPosition="start" />
      </Tabs>
      {subTab === 0 && <TeacherAssignments />}
      {subTab === 1 && <SubjectsManagement />}
      {subTab === 2 && <SchedulePanel />}
      {subTab === 3 && <SubstitutionPanel />}
    </Box>
  );
}
