// 采集插件安装入口：检测是否已安装；未安装时提供下载与三步安装指引
// Chrome 不允许网页直接安装扩展（只能通过应用商店或手动加载），所以这里给的是最短的手动路径
import { useState } from 'react';
import { Box, Button, Stack, Typography, Chip, Tooltip, IconButton, Collapse, Alert } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useExtension, isOutdated, EXTENSION_LATEST, EXTENSION_ZIP, EXTENSIONS_PAGE, WEB_STORE_URL, BROWSER } from './extension';

const Step = ({ n, title, children }) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', flex: 1, minWidth: 220 }}>
    <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#0e7490', color: '#fff', fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{n}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
      <Box sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25, lineHeight: 1.6 }}>{children}</Box>
    </Box>
  </Stack>
);

const CopyAddress = () => {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(EXTENSIONS_PAGE); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* 忽略 */ }
  };
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: 'action.hover', borderRadius: 1, px: 0.75, fontFamily: 'monospace', fontSize: 12.5, color: 'text.primary' }}>
      {EXTENSIONS_PAGE}
      <Tooltip title={ok ? '已复制' : '复制（浏览器不允许网页直接打开这个地址）'}>
        <IconButton size="small" onClick={copy} sx={{ p: 0.25 }}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton>
      </Tooltip>
    </Box>
  );
};

export function InstallCard() {
  const { status, info } = useExtension();
  const [open, setOpen] = useState(false);
  const installed = status === 'installed';
  const outdated = installed && isOutdated(info?.version);
  const showGuide = !installed || open || outdated;

  return (
    <Box sx={(t) => ({ border: `1px solid ${t.palette.divider}`, borderRadius: 4, p: 2, m: 2, mb: 1 })}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Box component="img" src={`${import.meta.env.BASE_URL}collector-icon.png`} alt="" sx={{ width: 36, height: 36, borderRadius: 2 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontWeight: 600 }}>Wavely 1688 采集助手</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>在 1688 列表页勾选商品、在详情页一键采集，数据会出现在下面的采集箱里</Typography>
        </Box>
        {status === 'checking' && <Chip size="small" label="检测中…" />}
        {installed && <>
          {outdated
            ? <Chip size="small" color="warning" label={`v${info.version} · 有新版本 v${EXTENSION_LATEST}`} />
            : <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`已安装 v${info.version}`} />}
          <Button size="small" href="https://s.1688.com/" target="_blank" rel="noopener" endIcon={<OpenInNewIcon />}>去 1688 选品</Button>
          <Button size="small" color="inherit" onClick={() => setOpen((v) => !v)} endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />}>更新插件</Button>
        </>}
        {status === 'missing' && (WEB_STORE_URL
          ? <Button variant="contained" disableElevation href={WEB_STORE_URL} target="_blank" rel="noopener">添加至 Chrome</Button>
          : <Button variant="contained" disableElevation startIcon={<DownloadIcon />} href={EXTENSION_ZIP} download>下载插件</Button>)}
      </Stack>

      <Collapse in={showGuide && status !== 'checking' && !WEB_STORE_URL}>
        {BROWSER === 'other' && <Alert severity="warning" sx={{ mt: 2 }}>插件支持 Chrome 和 Edge，请换用这两个浏览器打开本页。</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <Step n={1} title={installed ? '下载新版并解压' : '下载并解压'}>
            <Button size="small" startIcon={<DownloadIcon />} href={EXTENSION_ZIP} download sx={{ ml: -0.75 }}>wavely-1688-collector.zip</Button><br />
            解压到一个固定的文件夹，之后不要删除或移动它
          </Step>
          <Step n={2} title="打开扩展程序页面">
            在地址栏粘贴 <CopyAddress /> 并回车，打开右上角的<b>「开发者模式」</b>
          </Step>
          <Step n={3} title={installed ? '点插件卡片上的刷新按钮' : '加载插件，然后刷新本页'}>
            {installed ? '或者先移除旧版，再按第 1、2 步重新加载' : <>点<b>「加载已解压的扩展程序」</b>，选择解压出来的文件夹；装好后
              <Button size="small" startIcon={<RefreshIcon />} onClick={() => location.reload()} sx={{ ml: 0.5, py: 0 }}>刷新本页</Button></>}
          </Step>
        </Stack>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.5 }}>
          Chrome 不允许网页直接安装扩展，插件上架 Chrome 应用商店之后这里会变成一键安装。Chrome 每次启动可能提示「停用开发者模式扩展程序」，点「保留」即可。
          插件只读取你在 1688 正在浏览的页面，不会自动登录，也不会绕过滑块等安全验证。
        </Typography>
      </Collapse>
    </Box>
  );
}
