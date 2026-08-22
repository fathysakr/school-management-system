'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Box, Card, CardContent, Typography, Chip, Grid } from '@mui/material';
import { TrendingUp, TrendingDown, EmojiEvents } from '@mui/icons-material';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface TrendPoint {
  date: string;
  label: string;
  rate: number | null;
  present: number;
  absent: number;
  late: number;
  escape: number;
  records: number;
}

export default function AttendanceTrendChart({ days = 14 }: { days?: number }) {
  const { token, selectedSchool } = useAuth();
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .get(`/analytics/trends?days=${days}${selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : ''}`, token)
      .then((data) => {
        setTrend(data.trend || []);
        setSummary(data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, days, selectedSchool]);

  const chartData = trend.filter((t) => t.rate !== null);

  if (loading) return null;
  if (chartData.length === 0) return null;

  return (
    <Card sx={{ borderRadius: 3, mb: 3 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            مؤشر الحضور — آخر {days} يوماً
          </Typography>
          {summary?.avgRate !== null && summary?.avgRate !== undefined && (
            <Chip
              icon={summary.avgRate >= 85 ? <EmojiEvents /> : summary.avgRate >= 75 ? <TrendingUp /> : <TrendingDown />}
              label={`المتوسط العام: ${summary.avgRate}%`}
              color={summary.avgRate >= 90 ? 'success' : summary.avgRate >= 80 ? 'primary' : summary.avgRate >= 70 ? 'warning' : 'error'}
              variant="outlined"
            />
          )}
        </Box>

        {summary && (
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ bgcolor: 'success.50', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">أفضل يوم</Typography>
                <Typography fontWeight="bold" color="success.main" fontSize="0.9rem">
                  {summary.bestDay ? `${summary.bestDay.label}` : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ bgcolor: 'error.50', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">أضعف يوم</Typography>
                <Typography fontWeight="bold" color="error.main" fontSize="0.9rem">
                  {summary.worstDay ? `${summary.worstDay.label}` : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ bgcolor: 'warning.50', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">إجمالي الغياب</Typography>
                <Typography fontWeight="bold" fontSize="0.9rem">{summary.totalAbsences}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ bgcolor: 'grey.100', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">حالات هروب</Typography>
                <Typography fontWeight="bold" fontSize="0.9rem">{summary.totalEscapes}</Typography>
              </Box>
            </Grid>
          </Grid>
        )}

        <Box sx={{ width: '100%', height: 300 }} dir="ltr">
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e7d32" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2e7d32" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: any, name: any) =>
                  name === 'نسبة الحضور' ? [`${value}%`, name] : [value, name]
                }
                contentStyle={{ direction: 'rtl', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Area
                type="monotone"
                dataKey="rate"
                name="نسبة الحضور"
                stroke="#2e7d32"
                strokeWidth={2.5}
                fill="url(#rateGradient)"
                dot={{ r: 3, fill: '#2e7d32' }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
