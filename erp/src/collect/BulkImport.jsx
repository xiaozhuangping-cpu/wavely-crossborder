// 采集箱批量操作：批量导入（统一类目 / 毛利率 / 状态，逐条导入并显示进度）、批量丢弃
import { useState } from 'react';
import { useListContext, useNotify, useRefresh, useDataProvider, Button as RaButton } from 'react-admin';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack, Typography, LinearProgress, Alert, InputAdornment, Box,
  FormControlLabel, Checkbox,
} from '@mui/material';
import { translateItem, applyTranslation, translateAll } from './localize';
import { useLlmConfig, llmLabel, isOwnKey } from '../ai/llmConfig';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import { supabase } from '../supabase';
import { CATEGORY_CHOICES, STATUS_OPTIONS, draftRows, defaultName, buildPayload, descOf, useCnyRate } from './ImportDialog';

const BulkImport = () => {
  const { selectedIds, data = [], onUnselectItems } = useListContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const cny = useCnyRate();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [margin, setMargin] = useState(30);
  const [status, setStatus] = useState('active');
  const [translate, setTranslate] = useState(true);
  const llm = useLlmConfig();
  const [run, setRun] = useState(null);   // { stage, done, total, failed: [{title, msg}], warn }

  const picked = data.filter((r) => selectedIds.includes(r.id));
  const todo = picked.filter((r) => r.status === 'new');
  const skipped = picked.length - todo.length;
  const running = run && (run.stage === 'translate' || run.done < run.total);

  const start = async () => {
    const state = { stage: 'import', done: 0, total: todo.length, ok: 0, failed: [], warn: '' };
    // 先为每个商品算好规格行，翻译与导入用同一份
    const plans = todo.map((r) => {
      const d = r.data ?? {};
      const rows = draftRows(d, cny, margin / 100);
      const optionName = (d.props ?? []).map((x) => x.name).join(' / ');
      return { r, d, rows, optionName, item: translateItem({ id: r.id, title: r.title, optionName, rows, description: descOf(d) }) };
    });
    // 1) AI 本地化：商品名、规格、描述；某批失败时这批只有中文，不影响导入
    let results = {};
    if (translate) {
      const out = await translateAll(plans.map((x) => x.item), (i, n) => setRun({ ...state, stage: 'translate', done: i, total: n }));
      results = out.results;
      if (out.errors.length) state.warn = `部分商品 AI 翻译失败，只有中文：${out.errors[0]}`;
    }
    // 2) 逐条导入
    setRun({ ...state });
    for (const { r, d, rows, optionName, item } of plans) {
      const base = buildPayload({ d, rows, zh: defaultName(d), category, optionName, image: d.images?.[0], status });
      const p = applyTranslation(base, item, results[String(r.id)]);
      const { error } = await supabase.rpc('import_draft', { p_draft: r.id, p });
      if (error) state.failed.push({ title: r.title, msg: error.message }); else state.ok += 1;
      state.done += 1;
      setRun({ ...state, failed: [...state.failed] });
    }
    notify(`已导入 ${state.ok} 个商品${state.failed.length ? `，失败 ${state.failed.length} 个` : ''}`, { type: state.failed.length ? 'warning' : 'success' });
    refresh();
    if (!state.failed.length && !state.warn) { onUnselectItems(); setOpen(false); setRun(null); }
  };

  const close = () => { if (running) return; setOpen(false); setRun(null); };
  return (
    <>
      <RaButton label="批量导入" onClick={() => setOpen(true)}><PlaylistAddIcon /></RaButton>
      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>批量导入 · {todo.length} 个商品</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {skipped > 0 && <Alert severity="info" sx={{ py: 0 }}>已跳过 {skipped} 个已导入或已丢弃的商品</Alert>}
            <TextField select label="类目" value={category} onChange={(e) => setCategory(e.target.value)} size="small" required disabled={!!run}>
              {CATEGORY_CHOICES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="目标毛利率" type="number" value={margin} onChange={(e) => setMargin(e.target.value === '' ? '' : Number(e.target.value))} size="small" disabled={!!run}
              helperText="按 头程 ¥45/kg + 尾程 $4 + 佣金 15% 反推每个规格的售价"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
            <TextField select label="导入后" value={status} onChange={(e) => setStatus(e.target.value)} size="small" disabled={!!run}>
              {STATUS_OPTIONS.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
            </TextField>
            <Box>
              <FormControlLabel disabled={!!run} control={<Checkbox size="small" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />}
                label={<Typography sx={{ fontSize: 14 }}>AI 本地化（商品名、规格、描述 · 中 / 英 / 德 / 日 / 西）</Typography>} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 3.75 }}>
                {translate
                  ? `由 ${llmLabel(llm)} 精简 1688 标题并翻译规格与描述，每批最多 5 个商品${isOwnKey(llm) ? '（使用你自己的 API Key）' : `，约消耗 ${Math.max(1, Math.ceil(todo.length / 5))} 次以上 AI 额度`}`
                  : '商品名取 1688 标题前 40 字（去掉【】里的营销词），只有中文'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              保留全部规格（每个商品最多 100 个）。需要逐个精调的商品，可以在列表里点「导入」单独处理。
            </Typography>
            {run && (
              <Box>
                <LinearProgress variant="determinate" value={run.total ? (run.done / run.total) * 100 : 100} />
                <Typography sx={{ fontSize: 13, mt: 0.75 }}>
                  {run.stage === 'translate' ? `AI 正在本地化（第 ${run.done + 1}/${run.total} 批）…`
                    : running ? `正在导入 ${run.done + 1}/${run.total}…` : `完成：成功 ${run.ok} 个${run.failed.length ? `，失败 ${run.failed.length} 个` : ''}`}
                </Typography>
                {run.warn && <Typography sx={{ fontSize: 12, color: 'warning.main', wordBreak: 'break-all' }}>{run.warn}</Typography>}
                {run.failed.slice(0, 5).map((f, i) => (
                  <Typography key={i} sx={{ fontSize: 12, color: 'error.main', wordBreak: 'break-all' }}>{f.title.slice(0, 24)}…：{f.msg}</Typography>
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} color="inherit" disabled={running}>{run && !running ? '关闭' : '取消'}</Button>
          {!run && <Button variant="contained" disableElevation onClick={start} disabled={!category || !todo.length || !(margin >= 0 && margin < 85)}>开始导入</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
};

const BulkDiscard = () => {
  const { selectedIds, data = [], onUnselectItems } = useListContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const ids = data.filter((r) => selectedIds.includes(r.id) && r.status === 'new').map((r) => r.id);
  return (
    <RaButton label="批量丢弃" disabled={!ids.length} onClick={async () => {
      await dataProvider.updateMany('import_drafts', { ids, data: { status: 'discarded' } });
      notify(`已丢弃 ${ids.length} 个`, { type: 'info' });
      onUnselectItems(); refresh();
    }}><DeleteSweepOutlinedIcon /></RaButton>
  );
};

export const CollectBulkActions = () => <><BulkImport /><BulkDiscard /></>;
