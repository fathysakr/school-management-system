'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
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
  Schedule,   Assessment, AutoStories, Speed, Build, AdminPanelSettings, VerifiedUser, CalendarMonth, SwapHoriz, Psychology
} from '@mui/icons-material';
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

  const isHovered = open || hovering;

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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" color="inherit" onClick={() => setOpen(!open)} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            {open ? <ChevronRight /> : <MenuIcon />}
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
            <AutoStories sx={{ fontSize: 28, opacity: 0.9 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              مدرسة صفوة الرواد الأهلية
            </Typography>
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

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ClickAwayListener onClickAway={() => setNotifOpen(false)}>
              <Box sx={{ position: 'relative' }}>
                <Tooltip title="الإشعارات">
                  <IconButton color="inherit" onClick={() => setNotifOpen(!notifOpen)} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    <Badge badgeContent={unreadCount} color="error"><Notifications /></Badge>
                  </IconButton>
                </Tooltip>
                {notifOpen && (
                  <Paper sx={{ position: 'absolute', left: 0, top: '100%', mt: 1, width: 360, maxHeight: 480, overflow: 'auto', zIndex: 9999, borderRadius: 2, boxShadow: 8 }}>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                          <ListItemButton key={n.id} sx={{ gap: 1.5, py: 1.5, px: 2, bgcolor: n.is_read ? 'transparent' : 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}
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
                px: 1.5, py: 0.5, borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <Avatar sx={{ width: 34, height: 34, bgcolor: roleColors[user.role] || 'primary.dark', fontSize: 14, fontWeight: 600 }}>
                {user.email?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ lineHeight: 1.2, fontWeight: 600 }}>{user.email?.split('@')[0]}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 11 }}>{roleLabels[user.role] || user.role}</Typography>
              </Box>
            </Box>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { mt: 1, borderRadius: 2, minWidth: 180, boxShadow: 4 } }}
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
            borderLeft: '1px solid #e0e0e0',
            transition: muiTheme.transitions.create('width', {
              easing: muiTheme.transitions.easing.easeOut,
              duration: muiTheme.transitions.duration.standard,
            }),
            overflowX: 'hidden',
            backgroundColor: '#ffffff',
            boxShadow: open || hovering ? '4px 0 20px rgba(0,0,0,0.06)' : 'none',
          },
        }}
      >
        {/* User Info Card */}
        {isHovered && (
          <Box sx={{
            mx: 1.5, my: 2, p: 2, borderRadius: 3,
            background: 'linear-gradient(135deg, #e8eaf6 0%, #f3e5f5 100%)',
            textAlign: 'center',
          }}>
            <Avatar sx={{ width: 52, height: 52, mx: 'auto', mb: 1, bgcolor: roleColors[user.role] || 'primary.main', fontSize: 20, fontWeight: 600 }}>
              {user.email?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="subtitle2" fontWeight={600}>{user.email?.split('@')[0]}</Typography>
            <RoleChip
              label={roleLabels[user.role] || user.role}
              size="small"
              sx={{
                mt: 0.5, height: 22, fontSize: 11, fontWeight: 600,
                bgcolor: roleColors[user.role] + '20',
                color: roleColors[user.role],
              }}
            />
          </Box>
        )}

        {/* Parent Menu */}
        {user.role === 'parent' && (
          <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
            <Box sx={{ mb: 0.5 }}>
              {isHovered && (
                <Typography variant="caption" sx={{ display: 'block', px: 3, py: 1, fontSize: 11, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1 }}>
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
                          selected={isActive}
                          sx={{ minHeight: 44, justifyContent: isHovered ? 'flex-start' : 'center', px: 1.5, py: 1, borderRadius: 2.5, mx: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mr: isHovered ? 1.5 : 0 }}>
                            {item.icon}
                          </ListItemIcon>
                          {isHovered && <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500 }} />}
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
                      display: 'block',
                      px: 3,
                      py: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'text.disabled',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {group.label}
                  </Typography>
                )}
                <List disablePadding>
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Tooltip key={item.path} title={!isHovered ? item.text : ''} placement="left" arrow>
                        <ListItem disablePadding sx={{ display: 'block', px: 1, py: 0.3 }}>
                          <ListItemButton
                            onClick={() => {
                              router.push(item.path);
                              if (isMobile) setOpen(false);
                            }}
                            selected={isActive}
                            sx={{
                              minHeight: 44,
                              justifyContent: isHovered ? 'flex-start' : 'center',
                              px: 1.5,
                              py: 1,
                              borderRadius: 2.5,
                              position: 'relative',
                              backgroundColor: isActive ? 'primary.50' : 'transparent',
                              '&::before': isActive ? {
                                content: '""',
                                position: 'absolute',
                                right: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 3,
                                height: 20,
                                borderRadius: 3,
                                bgcolor: 'primary.main',
                              } : {},
                              '&:hover': {
                                backgroundColor: isActive ? 'primary.100' : 'grey.100',
                              },
                              '&.Mui-selected': {
                                backgroundColor: 'primary.50',
                                '&:hover': { backgroundColor: 'primary.100' },
                              },
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                mr: isHovered ? 2 : 0,
                                justifyContent: 'center',
                                color: isActive ? 'primary.main' : 'text.secondary',
                                '& .MuiSvgIcon-root': {
                                  fontSize: isActive ? 24 : 22,
                                  transition: '0.2s',
                                },
                              }}
                            >
                              {isActive ? (
                                <Box sx={{ p: 0.5, borderRadius: 1.5, bgcolor: 'primary.50' }}>
                                  {item.icon}
                                </Box>
                              ) : item.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={item.text}
                              sx={{
                                opacity: isHovered ? 1 : 0,
                                transition: 'opacity 0.2s',
                                '& .MuiTypography-root': {
                                  fontWeight: isActive ? 700 : 500,
                                  color: isActive ? 'primary.main' : 'text.primary',
                                  fontSize: 14,
                                },
                              }}
                            />
                            {isActive && isHovered && (
                              <Box
                                sx={{
                                  width: 6, height: 6, borderRadius: '50%',
                                  bgcolor: 'primary.main', flexShrink: 0,
                                }}
                              />
                            )}
                          </ListItemButton>
                        </ListItem>
                      </Tooltip>
                    );
                  })}
                </List>
                {gi < menuGroups.length - 1 && isHovered && (
                  <Divider sx={{ mx: 2, my: 1 }} />
                )}
              </Box>
            );
          })}
        </Box>
        )}

        {/* Logout */}
        <Box sx={{ borderTop: '1px solid #e0e0e0', py: 1 }}>
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
                    color: 'error.main',
                    '&:hover': { backgroundColor: 'error.50' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: isHovered ? 2 : 0, justifyContent: 'center', color: 'error.main' }}>
                    <Logout />
                  </ListItemIcon>
                  <ListItemText
                    primary="تسجيل الخروج"
                    sx={{
                      opacity: isHovered ? 1 : 0,
                      '& .MuiTypography-root': { fontWeight: 500, fontSize: 14 },
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
          bgcolor: '#f4f6f8',
          minHeight: '100vh',
          mt: '64px',
          ml: isMobile ? 0 : `${drawerWidth}px`,
          transition: muiTheme.transitions.create(['margin', 'width'], {
            easing: muiTheme.transitions.easing.easeOut,
            duration: muiTheme.transitions.duration.standard,
          }),
        }}
      >
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          {children}
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
