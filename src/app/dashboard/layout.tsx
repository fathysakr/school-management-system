'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, FORCED_SCHOOL_STAGE } from '@/lib/auth-context';
import { schoolFullName } from '@/lib/school-brand';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List,
  ListItem, ListItemIcon, ListItemText, ListItemButton, Divider,
  Avatar, Badge, Menu, MenuItem, useMediaQuery, useTheme as useMuiTheme, Tooltip,
  Paper, Chip, ClickAwayListener
} from '@mui/material';
import {
  People, School, Class as ClassIcon, EventNote, Grade,
  Person, Logout, Menu as MenuIcon, ChevronRight, Notifications, Campaign,
  Schedule,   Assessment, AutoStories, Speed, Build, AdminPanelSettings, VerifiedUser, CalendarMonth, SwapHoriz, Psychology, Payments,
  AddPhotoAlternate as UploadIcon
} from '@mui/icons-material';
import { Snackbar, Alert as MuiAlert } from '@mui/material';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';

const DRAWER_OPEN = 280;
const DRAWER_CLOSED = 80;

const allRoles = ['admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal', 'middle_monitor', 'high_monitor', 'middle_admin_staff', 'high_admin_staff'];

const managementViewRoles = ['admin', 'middle_supervisor', 'high_supervisor', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal', 'middle_monitor', 'high_monitor', 'middle_admin_staff', 'high_admin_staff'];
const substitutionRoles = ['admin', 'middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_principal', 'high_principal', 'middle_admin_staff', 'high_admin_staff'];
const announcementRoles = ['admin', 'middle_supervisor', 'high_supervisor', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal', 'middle_admin_staff', 'high_admin_staff'];

const menuGroups = [
  {
    label: 'الرئيسية',
    items: [
      { text: 'لوحة التحكم', icon: <Speed />, path: '/dashboard', roles: allRoles },
      { text: 'إدارة النظام', icon: <Build />, path: '/dashboard/admin', roles: ['admin'] },
      { text: 'شؤون المدرسة', icon: <AdminPanelSettings />, path: '/dashboard/principal', roles: ['middle_principal', 'high_principal'] },
    ],
  },
  {
    label: 'إدارة المعلمين',
    items: [
      { text: 'المعلمون', icon: <People />, path: '/dashboard/teachers', roles: managementViewRoles },
      { text: 'الإجازات', icon: <CalendarMonth />, path: '/dashboard/leaves', roles: allRoles },
      { text: 'حصص الانتظار', icon: <SwapHoriz />, path: '/dashboard/substitutions', roles: substitutionRoles },
      { text: 'الإدارة', icon: <VerifiedUser />, path: '/dashboard/management', roles: managementViewRoles },
    ],
  },
  {
    label: 'إدارة الطلاب',
    items: [
      { text: 'الطلاب', icon: <School />, path: '/dashboard/students', roles: allRoles },
      { text: 'الحضور', icon: <EventNote />, path: '/dashboard/attendance', roles: allRoles },
      { text: 'الدرجات', icon: <Grade />, path: '/dashboard/grades', roles: allRoles },
      { text: 'التقارير', icon: <Assessment />, path: '/dashboard/reports', roles: allRoles },
      { text: 'كشف الدرجات', icon: <Grade />, path: '/dashboard/report-card', roles: allRoles },
      { text: 'الرسوم الدراسية', icon: <Payments />, path: '/dashboard/payments', roles: ['admin', 'middle_admin_staff', 'high_admin_staff', 'middle_principal', 'high_principal'] },
    ],
  },
  {
    label: 'إدارة الفصول',
    items: [
      { text: 'الفصول', icon: <ClassIcon />, path: '/dashboard/classes', roles: allRoles },
      { text: 'الجدول الدراسي', icon: <Schedule />, path: '/dashboard/schedules', roles: allRoles },
    ],
  },
  {
    label: 'الإرشاد الطلابي',
    items: [
      { text: 'الإرشاد الطلابي', icon: <Psychology />, path: '/dashboard/counseling', roles: allRoles },
    ],
  },
  {
    label: 'أخرى',
    items: [
      { text: 'الإعلانات', icon: <Campaign />, path: '/dashboard/announcements', roles: announcementRoles },
      { text: 'التحليلات', icon: <Assessment />, path: '/dashboard/analytics', roles: ['admin', 'middle_supervisor', 'high_supervisor', 'middle_principal', 'high_principal'] },
      { text: 'الملف الشخصي', icon: <Person />, path: '/dashboard/profile', roles: allRoles },
    ],
  },
];

const roleLabels: Record<string, string> = {
  admin: 'مدير النظام',
  middle_supervisor: 'مشرف متوسط',
  high_supervisor: 'مشرف ثانوي',
  middle_teacher: 'معلم متوسط',
  high_teacher: 'معلم ثانوي',
  middle_counselor: 'مرشد طلابي متوسط',
  high_counselor: 'مرشد طلابي ثانوي',
  middle_principal: 'مدير مدرسة - متوسط',
  high_principal: 'مدير مدرسة - ثانوي',
  middle_monitor: 'مراقب متوسط',
  high_monitor: 'مراقب ثانوي',
  middle_admin_staff: 'إداري متوسط',
  high_admin_staff: 'إداري ثانوي',
  parent: 'ولي أمر',
};

const roleColors: Record<string, string> = {
  admin: '#7c4dff',
  middle_supervisor: '#1565c0',
  high_supervisor: '#e65100',
  middle_teacher: '#2e7d32',
  high_teacher: '#d32f2f',
  middle_counselor: '#00897b',
  high_counselor: '#6a1b9a',
  middle_principal: '#4a148c',
  high_principal: '#880e4f',
  middle_monitor: '#f9a825',
  high_monitor: '#e65100',
  middle_admin_staff: '#546e7a',
  high_admin_staff: '#37474f',
  parent: '#00bcd4',
};

function greetingFor(h: number): string {
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'طاب يومك';
  return 'مساء الخير';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout, selectedSchool, setSelectedSchool } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [hovering, setHovering] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [now, setNow] = useState<Date>(() => new Date());
  const [branding, setBranding] = useState<{ logo: string | null; moe: string | null; vision: string | null }>({ logo: null, moe: null, vision: null });
  const [brandMenuEl, setBrandMenuEl] = useState<null | HTMLElement>(null);
  const [uploadSlot, setUploadSlot] = useState<'logo' | 'moe' | 'vision'>('logo');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const isHovered = open || hovering;

  const fetchBranding = useCallback(async () => {
    try {
      const res = await api.get('/school-branding', '');
      if (res && typeof res === 'object') setBranding({ logo: res.logo || null, moe: res.moe || null, vision: res.vision || null });
    } catch { /* branding optional */ }
  }, []);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  const handleBrandFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const fd = new FormData();
      fd.append('slot', uploadSlot);
      fd.append('file', f);
      await api.upload('/school-branding', fd, token);
      await fetchBranding();
      setToast({ msg: 'تم تحديث الشعار بنجاح', severity: 'success' });
    } catch (err: any) {
      setToast({ msg: err?.message || 'فشل رفع الشعار', severity: 'error' });
    }
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const dateLabel = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const timeLabel = new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(now);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/notifications?unread=true&limit=50', token);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch { setNotifError('فشل تحميل الإشعارات'); }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    if (!token) return;
    try { await api.put('/notifications', { mark_all: true }, token); setUnreadCount(0); setNotifications(prev => prev.map((n: any) => ({ ...n, is_read: 1 }))); } catch { setNotifError('فشل تحديث الإشعارات'); }
  };

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const drawerWidth = isHovered ? DRAWER_OPEN : DRAWER_CLOSED;
  

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fbf3f3' }}>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(90deg, rgba(38,8,14,.93) 0%, rgba(64,12,22,.87) 55%, rgba(52,10,18,.84) 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,220,220,0.10)',
          boxShadow: '0 10px 30px -12px rgba(40,6,12,.55)',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" color="inherit" onClick={() => setOpen(!open)} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            {open ? <ChevronRight /> : <MenuIcon />}
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
            {branding.logo ? (
              <Box component="img" src={branding.logo} alt="شعار المدرسة" sx={{ height: 38, width: 38, objectFit: 'contain', borderRadius: 1.5, background: 'rgba(255,255,255,.94)', p: 0.4 }} />
            ) : (
              <AutoStories sx={{ fontSize: 28, opacity: 0.9 }} />
            )}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              {schoolFullName(FORCED_SCHOOL_STAGE)}
            </Typography>
            {user?.role === 'admin' && (
              <Tooltip title="رفع شعارات المدرسة">
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={(e) => setBrandMenuEl(e.currentTarget)}
                  sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
                >
                  <UploadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {user?.role === 'admin' && (
              <ToggleButtonGroup
                value={selectedSchool}
                exclusive
                onChange={(_, v) => v && setSelectedSchool(v)}
                size="small"
                sx={{
                  mr: 2, ml: 2,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.6)',
                    borderColor: 'rgba(255,255,255,0.15)',
                    px: 2,
                    py: 0.3,
                    fontSize: 12,
                    fontWeight: 600,
                    '&.Mui-selected': {
                      color: '#fff',
                      bgcolor: 'rgba(255,255,255,0.15)',
                    },
                  },
                }}
              >
                <ToggleButton value="all">الكل</ToggleButton>
                <ToggleButton value="middle">متوسطة</ToggleButton>
                <ToggleButton value="high">ثانوية</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          {/* Live clock & greeting */}
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', alignItems: 'flex-end', mx: 2, lineHeight: 1.3 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.92)' }}>
              {greetingFor(now.getHours())}{user.email ? `، ${user.email.split('@')[0]}` : ''} 👋
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>
              {dateLabel} • {timeLabel}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ClickAwayListener onClickAway={() => setNotifOpen(false)}>
              <Box sx={{ position: 'relative' }}>
                <Tooltip title="الإشعارات">
                  <IconButton color="inherit" onClick={() => setNotifOpen(!notifOpen)} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    <Badge
                      badgeContent={unreadCount}
                      color="error"
                      sx={{ '& .MuiBadge-badge': unreadCount > 0 ? { boxShadow: '0 0 0 2px rgba(13,16,45,.9)' } : {} }}
                    ><Notifications /></Badge>
                  </IconButton>
                </Tooltip>
                {unreadCount > 0 && !notifOpen && (
                  <Box className="pulse-dot" sx={{ position: 'absolute', top: 9, left: 9, width: 9, height: 9, borderRadius: '50%', bgcolor: '#f43f5e', pointerEvents: 'none' }} />
                )}
                {notifOpen && (
                  <Paper sx={{ position: 'absolute', left: 0, top: '100%', mt: 1, width: 360, maxHeight: 480, overflow: 'auto', zIndex: 9999, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 24px 60px -12px rgba(10,12,40,.35)' }}>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg,#f6f7ff,#fdf7ff)' }}>
                      <Typography variant="subtitle2" fontWeight={700}>الإشعارات</Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {notifError && <Typography variant="caption" color="error">{notifError}</Typography>}
                        {unreadCount > 0 && <Chip label={`${unreadCount} جديد`} size="small" color="error" onClick={markAllRead} sx={{ cursor: 'pointer', fontSize: 11 }} />}
                      </Box>
                    </Box>
                    {notifications.length === 0 ? (
                      <Typography color="text.secondary" textAlign="center" py={4} variant="body2">لا توجد إشعارات</Typography>
                    ) : (
                      <List disablePadding>
                        {notifications.map((n: any) => (
                          <ListItemButton key={n.id} sx={{ gap: 1.5, py: 1.5, px: 2, bgcolor: n.is_read ? 'transparent' : 'action.hover', borderBottom: '1px solid', borderColor: 'divider', transition: '.15s', '&:hover': { transform: 'translateX(-3px)' } }}
                            onClick={() => { if (n.link) router.push(n.link); setNotifOpen(false); }}>
                            <Box sx={{ flexShrink: 0 }}>
                              {n.type === 'urgent' ? <Box component="span" sx={{ fontSize: 20 }}>🚨</Box> : n.type === 'warning' ? <Box component="span" sx={{ fontSize: 20 }}>⚠️</Box> : <Box component="span" sx={{ fontSize: 20 }}>ℹ️</Box>}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>{n.title}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-line', lineHeight: 1.4 }}>{n.message}</Typography>
                            </Box>
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                  </Paper>
                )}
              </Box>
            </ClickAwayListener>

            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                px: 1.5, py: 0.5, borderRadius: 2.5,
                transition: '.15s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <Avatar sx={{ width: 34, height: 34, fontSize: 14, fontWeight: 600, background: `linear-gradient(135deg, ${roleColors[user.role] || '#b91c1c'}, #f59e0b)`, boxShadow: '0 0 0 2px rgba(255,255,255,.25)' }}>
                {user.email?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ lineHeight: 1.2, fontWeight: 600 }}>{user.email?.split('@')[0]}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 11 }}>{roleLabels[user.role] || user.role}</Typography>
              </Box>
            </Box>
          </Box>

          {/* Official logos */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <Tooltip title="وزارة التعليم">
              <Box component="img" src={branding.moe || '/branding/moe.svg'} alt="وزارة التعليم" sx={{ height: 38, width: 38, objectFit: 'contain', borderRadius: '50%', background: 'rgba(255,255,255,.95)', p: 0.3 }} />
            </Tooltip>
            <Tooltip title="رؤية المملكة 2030">
              <Box component="img" src={branding.vision || '/branding/vision2030.svg'} alt="رؤية 2030" sx={{ height: 32, objectFit: 'contain', background: 'rgba(255,255,255,.95)', borderRadius: 1.5, p: 0.35 }} />
            </Tooltip>
          </Box>

          <Menu
            anchorEl={brandMenuEl}
            open={Boolean(brandMenuEl)}
            onClose={() => setBrandMenuEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ sx: { mt: 1, borderRadius: 2.5, minWidth: 220, boxShadow: '0 24px 60px -12px rgba(40,6,12,.35)', border: '1px solid', borderColor: 'divider', overflow: 'hidden' } }}
          >
            <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1.5, pb: 0.5, color: 'text.secondary' }}>اختر الشعار المراد رفع/تغيير صورته</Typography>
            {([
              { slot: 'logo' as const, label: 'لوجو المدرسة' },
              { slot: 'moe' as const, label: 'لوجو وزارة التعليم' },
              { slot: 'vision' as const, label: 'شعار رؤية 2030' },
            ]).map(opt => (
              <MenuItem key={opt.slot} onClick={() => { setUploadSlot(opt.slot); setBrandMenuEl(null); setTimeout(() => fileInputRef.current?.click(), 50); }} sx={{ py: 1.25 }}>
                {opt.label}
              </MenuItem>
            ))}
          </Menu>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { mt: 1, borderRadius: 2.5, minWidth: 190, boxShadow: '0 24px 60px -12px rgba(10,12,40,.35)', border: '1px solid', borderColor: 'divider', overflow: 'hidden' } }}
          >
            <MenuItem onClick={() => { setAnchorEl(null); router.push('/dashboard/profile'); }} sx={{ gap: 1.5, py: 1.5 }}>
              <Person fontSize="small" /> الملف الشخصي
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); handleLogout(); }} sx={{ gap: 1.5, py: 1.5, color: 'error.main' }}>
              <Logout fontSize="small" /> تسجيل الخروج
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Hidden brand image input */}
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" style={{ display: 'none' }} onChange={handleBrandFile} />

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <MuiAlert severity={toast?.severity || 'success'} variant="filled" onClose={() => setToast(null)}>{toast?.msg}</MuiAlert>
      </Snackbar>

      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? open : true}
        onClose={() => isMobile && setOpen(false)}
        onMouseEnter={() => !open && !isMobile && setHovering(true)}
        onMouseLeave={() => !open && !isMobile && setHovering(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            mt: '64px',
            height: 'calc(100vh - 64px)',
            border: 'none',
            borderLeft: '1px solid rgba(255,220,220,0.09)',
            transition: muiTheme.transitions.create('width', {
              easing: muiTheme.transitions.easing.easeOut,
              duration: muiTheme.transitions.duration.standard,
            }),
            overflowX: 'hidden',
            background: 'linear-gradient(180deg, #260a10 0%, #34101a 45%, #3f1219 100%)',
            boxShadow: open || hovering ? '6px 0 32px -10px rgba(40,6,12,.55)' : 'none',
          },
        }}
      >
        {/* subtle aurora glow inside sidebar */}
        <Box className="aurora-glow" sx={{ position: 'absolute', top: -70, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,.30), transparent 65%)', pointerEvents: 'none' }} />

        {/* User Info Card */}
        {isHovered && (
          <Box sx={{
            mx: 1.5, my: 2, p: 2, borderRadius: 3.5,
            position: 'relative',
            background: 'linear-gradient(140deg, rgba(185,28,28,.30), rgba(220,38,38,.16) 55%, rgba(245,158,11,.14))',
            border: '1px solid rgba(255,255,255,0.12)',
            textAlign: 'center',
          }}>
            <Avatar sx={{ width: 54, height: 54, mx: 'auto', mb: 1, fontSize: 20, fontWeight: 700, background: `linear-gradient(135deg, ${roleColors[user.role] || '#b91c1c'}, #f59e0b)`, boxShadow: '0 8px 20px -6px rgba(0,0,0,.5), 0 0 0 3px rgba(255,255,255,.12)' }}>
              {user.email?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#eef0ff' }}>{user.email?.split('@')[0]}</Typography>
            <RoleChip
              label={roleLabels[user.role] || user.role}
              size="small"
              sx={{
                mt: 0.75, height: 22, fontSize: 11, fontWeight: 600,
                bgcolor: (roleColors[user.role] || '#b91c1c') + '33',
                color: '#dfe3ff',
                border: `1px solid ${(roleColors[user.role] || '#b91c1c')}55`,
                borderRadius: 999,
                px: 1.25,
              }}
            />
          </Box>
        )}

        {/* Parent Menu */}
        {user.role === 'parent' && (
          <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
            <Box sx={{ mb: 0.5 }}>
              {isHovered && (
                <Typography variant="caption" sx={{ display: 'block', px: 3, py: 1, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.38)', letterSpacing: 1 }}>
                  الرئيسية
                </Typography>
              )}
              <List disablePadding>
                {[
                  { text: 'لوحة التحكم', icon: <Speed />, path: '/dashboard/parent' },
                ].map((item) => {
                  const isActive = pathname === item.path || pathname.startsWith('/dashboard/parent');
                  return (
                    <Tooltip key={item.path} title={!isHovered ? item.text : ''} placement="left" arrow>
                      <ListItem disablePadding sx={{ display: 'block', px: 1, py: 0.3 }}>
                        <ListItemButton
                          onClick={() => { router.push(item.path); if (isMobile) setOpen(false); }}
                          sx={{
                            minHeight: 44, justifyContent: isHovered ? 'flex-start' : 'center', px: 1.5, py: 1, borderRadius: 2.5,
                            color: isActive ? '#fff' : '#c7cbe8',
                            background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,.95), rgba(139,92,246,.85))' : 'transparent',
                            boxShadow: isActive ? '0 10px 24px -10px rgba(99,102,241,.65)' : 'none',
                            '&:hover': { background: isActive ? undefined : 'rgba(255,255,255,.06)' },
                            transition: '.18s',
                          }}>
                          <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mr: isHovered ? 1.5 : 0, color: 'inherit' }}>
                            {item.icon}
                          </ListItemIcon>
                          {isHovered && <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: 'inherit' }} />}
                        </ListItemButton>
                      </ListItem>
                    </Tooltip>
                  );
                })}
              </List>
            </Box>
          </Box>
        )}

        {/* Menu Groups */}
        {user.role !== 'parent' && (
        <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
          {menuGroups.map((group, gi) => {
            const filteredItems = group.items.filter(item => item.roles.includes(user.role));
            if (filteredItems.length === 0) return null;
            return (
              <Box key={gi} sx={{ mb: 0.5 }}>
                {isHovered && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 3,
                      py: 1,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,.38)',
                      letterSpacing: 1.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.label}
                    <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,.14), transparent)' }} />
                  </Typography>
                )}
                <List disablePadding>
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Tooltip key={item.path} title={!isHovered ? item.text : ''} placement="left" arrow>
                        <ListItem disablePadding sx={{ display: 'block', px: 1, py: 0.25 }}>
                          <ListItemButton
                            onClick={() => {
                              router.push(item.path);
                              if (isMobile) setOpen(false);
                            }}
                            sx={{
                              minHeight: 44,
                              justifyContent: isHovered ? 'flex-start' : 'center',
                              px: 1.5,
                              py: 1,
                              borderRadius: 2.5,
                              position: 'relative',
                              color: isActive ? '#fff' : '#c7cbe8',
                              background: isActive
                                ? 'linear-gradient(120deg, rgba(99,102,241,.95), rgba(139,92,246,.82))'
                                : 'transparent',
                              boxShadow: isActive ? '0 12px 26px -10px rgba(99,102,241,.7)' : 'none',
                              '&::before': !isActive ? {
                                content: '""',
                                position: 'absolute',
                                right: 0,
                                top: '50%',
                                transform: 'translateY(-50%) scale(0)',
                                width: 3,
                                height: 22,
                                borderRadius: 3,
                                background: '#ef4444',
                                transition: '.2s',
                              } : {},
                              '&:hover': {
                                background: isActive ? undefined : 'rgba(255,255,255,.06)',
                                color: isActive ? undefined : '#fff',
                                '&::before': { transform: 'translateY(-50%) scale(1)' },
                              },
                              transition: '.18s',
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                mr: isHovered ? 1.5 : 0,
                                justifyContent: 'center',
                                color: 'inherit',
                              }}
                            >
                              <Box sx={{
                                display: 'grid', placeItems: 'center',
                                width: 32, height: 32, borderRadius: 2,
                                background: isActive ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)',
                                transition: '.18s',
                              }}>
                                {item.icon}
                              </Box>
                            </ListItemIcon>
                            <ListItemText
                              primary={item.text}
                              sx={{
                                opacity: isHovered ? 1 : 0,
                                transition: 'opacity 0.2s',
                                '& .MuiTypography-root': {
                                  fontWeight: isActive ? 700 : 500,
                                  color: 'inherit',
                                  fontSize: 13.5,
                                  whiteSpace: 'nowrap',
                                },
                              }}
                            />
                            {isActive && isHovered && (
                              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#a5f3fc', boxShadow: '0 0 10px 2px rgba(165,243,252,.6)', flexShrink: 0 }} />
                            )}
                          </ListItemButton>
                        </ListItem>
                      </Tooltip>
                    );
                  })}
                </List>
              </Box>
            );
          })}
        </Box>
        )}

        {/* Logout */}
        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', py: 1 }}>
          <List disablePadding>
            <Tooltip title={!isHovered ? 'تسجيل الخروج' : ''} placement="left" arrow>
              <ListItem disablePadding sx={{ display: 'block', px: 1 }}>
                <ListItemButton
                  onClick={handleLogout}
                  sx={{
                    minHeight: 44,
                    justifyContent: isHovered ? 'flex-start' : 'center',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2.5,
                    color: '#fda4af',
                    '&:hover': { backgroundColor: 'rgba(244,63,94,.14)', color: '#fecdd3' },
                    transition: '.18s',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: isHovered ? 1.5 : 0, justifyContent: 'center', color: 'inherit' }}>
                    <Logout />
                  </ListItemIcon>
                  <ListItemText
                    primary="تسجيل الخروج"
                    sx={{
                      opacity: isHovered ? 1 : 0,
                      '& .MuiTypography-root': { fontWeight: 500, fontSize: 13.5 },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, sm: 3 },
          minHeight: '100vh',
          mt: '64px',
          ml: isMobile ? 0 : `${drawerWidth}px`,
          transition: muiTheme.transitions.create(['margin', 'width'], {
            easing: muiTheme.transitions.easing.easeOut,
            duration: muiTheme.transitions.duration.standard,
          }),
          background:
            'radial-gradient(1100px 520px at 88% -8%, rgba(185,28,28,.12), transparent 60%),' +
            'radial-gradient(900px 480px at 4% 108%, rgba(245,158,11,.10), transparent 55%),' +
            'radial-gradient(760px 420px at 12% -6%, rgba(220,38,38,.10), transparent 55%),' +
            '#fbf3f3',
        }}
      >
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <Box key={pathname} className="page-enter">
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function RoleChip({ label, size, sx }: { label: string; size?: 'small' | 'medium'; sx?: any }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: size === 'small' ? 11 : 13,
        fontWeight: 600,
        ...sx,
      }}
    >
      {label}
    </Box>
  );
}
