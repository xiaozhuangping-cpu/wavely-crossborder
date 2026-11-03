import { useState } from 'react';
import { useLogin, useNotify } from 'react-admin';
import { Box, Button, Card, CardContent, Typography, Stack, Chip, CircularProgress } from '@mui/material';

const features = ['多平台订单', '海外仓库存', '物流轨迹', '多币种利润', '数据看板'];

export const LoginPage = () => {
  const login = useLogin();
  const notify = useNotify();
  const [loading, setLoading] = useState(false);

  const enter = () => {
    setLoading(true);
    login({}).catch((e) => {
      setLoading(false);
      notify(`进入演示失败：${e.message}`, { type: 'error' });
    });
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2,
      background: 'radial-gradient(1200px 600px at 80% -10%, #67e8f9 0%, transparent 60%), linear-gradient(160deg, #083344, #0e7490 60%, #155e75)',
    }}>
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 4, boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: '#0e7490', display: 'grid', placeItems: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 64 64"><path d="M6 38c9-11 17-11 26 0s17 11 26 0" stroke="white" strokeWidth="7" fill="none" strokeLinecap="round" /></svg>
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>Wavely ERP</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>海浪优选 · 跨境电商管理系统</Typography>
            </Box>
          </Stack>

          <Typography variant="body1" sx={{ mb: 2 }}>
            一个可以真实操作的跨境 ERP 演示：Amazon / Shopee / TikTok Shop / 独立站订单统一管理。
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 4 }}>
            {features.map((f) => <Chip key={f} label={f} size="small" variant="outlined" color="primary" />)}
          </Stack>

          <Button fullWidth size="large" variant="contained" onClick={enter} disabled={loading} sx={{ py: 1.4, borderRadius: 2, fontWeight: 700 }}>
            {loading ? <CircularProgress size={24} color="inherit" /> : '进入演示 →'}
          </Button>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2, textAlign: 'center' }}>
            无需注册，访客身份自动登录。数据每天凌晨 3 点重置，可以放心增删改。
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
