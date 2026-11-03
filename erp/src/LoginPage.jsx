import { useState } from 'react';
import { useLogin, useNotify } from 'react-admin';
import { Box, Button, Typography, Stack, Avatar, LinearProgress, Link } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

const BLOG = 'https://xiaozhuangping-cpu.github.io/';
const REPO = 'https://github.com/xiaozhuangping-cpu/wavely-crossborder';

const Logo = () => (
  <svg width="48" height="48" viewBox="0 0 64 64" aria-label="Wavely">
    <rect width="64" height="64" rx="16" fill="#0e7490" />
    <path d="M10 38c8-10 14-10 22 0s14 10 22 0" stroke="#c2e7ff" strokeWidth="7" fill="none" strokeLinecap="round" />
  </svg>
);

const features = ['多平台订单统一处理', '海外仓库存与补货预警', '物流轨迹自动推进', '多币种利润计算'];

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
    <Box sx={(t) => ({
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: { sm: 'center' },
      bgcolor: { xs: t.palette.background.paper, sm: t.palette.mode === 'dark' ? '#111111' : '#f0f4f9' }, p: { sm: 3 },
    })}>
      <Box sx={(t) => ({
        width: '100%', maxWidth: 1040, position: 'relative', overflow: 'hidden',
        bgcolor: 'background.paper', borderRadius: { xs: 0, sm: '28px' },
        p: { xs: 3, sm: 4.5 }, pt: { xs: 5, sm: 4.5 },
        boxShadow: { sm: t.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(0,0,0,.04)' },
      })}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4 }} />}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 6, rowGap: 4, opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          {/* 左栏：品牌与标题 */}
          <Box>
            <Logo />
            <Typography component="h1" sx={{ fontSize: { xs: 32, sm: 44 }, lineHeight: 1.2, fontWeight: 400, mt: 3, mb: 2 }}>
              进入演示
            </Typography>
            <Typography sx={{ fontSize: 16, color: 'text.primary' }}>
              以访客身份继续使用 Wavely 跨境 ERP
            </Typography>
          </Box>

          {/* 右栏：账号选择与说明 */}
          <Box sx={{ pt: { md: 9 } }}>
            <Box role="button" tabIndex={0} onClick={enter} onKeyDown={(e) => e.key === 'Enter' && enter()}
              sx={(t) => ({
                display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderRadius: 2, cursor: 'pointer',
                border: `1px solid ${t.palette.gm.border}`, '&:hover': { bgcolor: t.palette.gm.navHover },
              })}>
              <Avatar sx={{ bgcolor: '#0e7490', width: 36, height: 36, fontSize: 16 }}>访</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>演示访客</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>匿名登录 · 无需注册和密码</Typography>
              </Box>
              <ChevronRightIcon sx={{ color: 'text.secondary' }} />
            </Box>

            <Stack spacing={1.25} sx={{ mt: 3 }}>
              {features.map((f) => (
                <Stack key={f} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <CheckCircleOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{f}</Typography>
                </Stack>
              ))}
            </Stack>

            <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 3 }}>
              所有数据均为演示数据，每天北京时间 03:00 自动重置，可以放心增删改。
              {' '}<Link href={REPO} target="_blank" rel="noopener" underline="hover" sx={{ fontWeight: 500 }}>了解实现方式</Link>
            </Typography>

            <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, mt: 5 }}>
              <Button href={BLOG} sx={{ px: 3 }}>作者主页</Button>
              <Button variant="contained" onClick={enter} disabled={loading} sx={{ px: 3, height: 40 }}>进入演示</Button>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* 卡片下方页脚 */}
      <Stack direction="row" sx={{ width: '100%', maxWidth: 1040, justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 1, px: { xs: 3, sm: 1 }, py: 2, mt: { xs: 'auto', sm: 0 } }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>简体中文</Typography>
        <Stack direction="row" spacing={3}>
          {[['作者博客', BLOG], ['源码', REPO], ['演示入口', `${BLOG}wavely-crossborder/`]].map(([l, h]) => (
            <Link key={l} href={h} underline="none" sx={{ fontSize: 12, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>{l}</Link>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};
