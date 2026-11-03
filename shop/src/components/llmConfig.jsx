// AI 模型配置：内置 DeepSeek（计配额）或访客自带的 OpenAI 兼容服务（不计配额）
// 配置只存在本浏览器 localStorage（ERP 与独立站同域共用），API Key 随请求经边缘函数转发给服务商，服务端不保存
// 注意：这是 erp/src/ai/llmConfig.jsx 的副本（两个 Vite 项目各自打包），两处需同步修改
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Autocomplete, Stack, Typography, Alert, Link, InputAdornment, IconButton, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

export const PROVIDERS = [
  { id: 'builtin', name: '内置 DeepSeek（免配置，每天 30 次）', en: 'Built-in DeepSeek (free, 30/day)' },
  { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com', models: ['deepseek-chat'], keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'qwen', name: '通义千问（阿里云百炼）', en: 'Qwen (Alibaba)', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-max', 'qwen-turbo'], keyUrl: 'https://bailian.console.aliyun.com/' },
  { id: 'moonshot', name: 'Kimi（月之暗面）', en: 'Kimi (Moonshot)', base: 'https://api.moonshot.cn/v1', models: ['kimi-latest', 'moonshot-v1-32k'], keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { id: 'zhipu', name: '智谱 GLM', en: 'Zhipu GLM', base: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-flash'], keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'ark', name: '火山方舟（豆包）', en: 'Volcengine Ark (Doubao)', base: 'https://ark.cn-beijing.volces.com/api/v3', models: [], modelHint: '填模型 ID 或推理接入点 ID（ep-…）', keyUrl: 'https://console.volcengine.com/ark' },
  { id: 'siliconflow', name: '硅基流动', en: 'SiliconFlow', base: 'https://api.siliconflow.cn/v1', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'], keyUrl: 'https://cloud.siliconflow.cn/account/ak' },
  { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', models: ['deepseek/deepseek-chat', 'openai/gpt-4o-mini'], keyUrl: 'https://openrouter.ai/keys' },
  { id: 'openai', name: 'OpenAI', base: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4.1-mini'], keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic Claude', base: 'https://api.anthropic.com/v1', models: ['claude-sonnet-5-5', 'claude-haiku-5-5'], keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-2.5-flash'], keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'custom', name: '自定义（OpenAI 兼容接口）', en: 'Custom (OpenAI-compatible)', base: '', models: [] },
];
const byId = (id) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

// ---------- 存储（跨组件、跨标签页同步） ----------
const KEY = 'wv.llm';
const EVT = 'wv-llm-change';
const DEFAULT = { provider: 'builtin', baseUrl: '', apiKey: '', model: '' };
let cache;
const read = () => {
  if (cache) return cache;
  try { cache = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { cache = { ...DEFAULT }; }
  return cache;
};
export const saveLlmConfig = (cfg) => {
  cache = { ...DEFAULT, ...cfg };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 隐私模式等：只在本次会话内生效 */ }
  window.dispatchEvent(new Event(EVT));
};
const subscribe = (fn) => {
  const onStorage = (e) => { if (e.key === KEY) { cache = undefined; fn(); } };
  window.addEventListener(EVT, fn); window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVT, fn); window.removeEventListener('storage', onStorage); };
};
export const getLlmConfig = read;
export const useLlmConfig = () => useSyncExternalStore(subscribe, read);

/** 请求体里的 llm 字段；内置模型返回 undefined */
export const llmPayload = (cfg = read()) =>
  cfg.provider === 'builtin' || !cfg.apiKey ? undefined : { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model };

/** 界面上显示的当前模型名 */
export const llmLabel = (cfg = read()) => (llmPayload(cfg) ? cfg.model : 'DeepSeek');
export const isOwnKey = (cfg = read()) => !!llmPayload(cfg);

// ---------- 设置对话框 ----------
const T = {
  zh: { title: 'AI 模型设置', provider: '服务商', base: '接口地址（OpenAI 兼容）', key: 'API Key', model: '模型', fetch: '获取模型列表', getKey: '去获取 Key',
        save: '保存', cancel: '取消', reset: '恢复内置', loaded: (n) => `已获取 ${n} 个模型`,
        note: '用你自己的 Key 不占用演示额度，费用由对应服务商按你的账号计费。Key 只保存在本浏览器，每次对话时经本站服务端转发给服务商，不会被保存或记录。需要选择支持工具调用（function calling）的模型。',
        builtinNote: '内置模型由站长提供，每位访客每天 30 次。额度用完后可以切换到自己的 Key 继续使用。', need: '请填写接口地址、API Key 和模型' },
  en: { title: 'AI model settings', provider: 'Provider', base: 'Base URL (OpenAI-compatible)', key: 'API key', model: 'Model', fetch: 'Fetch models', getKey: 'Get a key',
        save: 'Save', cancel: 'Cancel', reset: 'Use built-in', loaded: (n) => `${n} models loaded`,
        note: 'Your own key does not use the demo quota; usage is billed to your account by the provider. The key stays in this browser and is relayed through this site\'s server to the provider on each chat — it is never stored or logged. Pick a model that supports tool / function calling.',
        builtinNote: 'The built-in model is provided by the site owner, 30 messages per visitor per day. Switch to your own key when it runs out.', need: 'Base URL, API key and model are required' },
};

/**
 * @param fetchModels (llm) => Promise<string[]>：经边缘函数拉取模型列表
 * @param lang 'zh' | 其它（英文）
 */
export function LlmSettingsDialog({ open, onClose, fetchModels, lang = 'zh' }) {
  const t = lang === 'zh' ? T.zh : T.en;
  const saved = useLlmConfig();
  const [f, setF] = useState(saved);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { severity, text }
  useEffect(() => { if (open) { setF(saved); setModels([]); setMsg(null); setShow(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = byId(f.provider);
  const builtin = f.provider === 'builtin';
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setMsg(null); };
  const pickProvider = (id) => {
    const np = byId(id);
    setModels([]);
    set({ provider: id, baseUrl: np.base ?? '', model: np.models?.[0] ?? '', apiKey: id === f.provider ? f.apiKey : '' });
  };
  const complete = !builtin && f.baseUrl.trim() && f.apiKey.trim() && f.model.trim();

  const loadModels = async () => {
    if (!f.baseUrl.trim() || !f.apiKey.trim()) { setMsg({ severity: 'warning', text: t.need }); return; }
    setBusy(true); setMsg(null);
    try {
      const list = await fetchModels({ baseUrl: f.baseUrl.trim(), apiKey: f.apiKey.trim(), model: f.model.trim() || 'x' });
      setModels(list);
      setMsg({ severity: 'success', text: t.loaded(list.length) });
    } catch (e) { setMsg({ severity: 'error', text: e.message }); }
    finally { setBusy(false); }
  };

  const save = () => {
    if (builtin) saveLlmConfig({ ...DEFAULT });
    else if (!complete) { setMsg({ severity: 'warning', text: t.need }); return; }
    else saveLlmConfig({ provider: f.provider, baseUrl: f.baseUrl.trim(), apiKey: f.apiKey.trim(), model: f.model.trim() });
    onClose();
  };

  const options = [...new Set([...(models.length ? models : p.models ?? [])])];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>{t.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label={t.provider} value={f.provider} onChange={(e) => pickProvider(e.target.value)} size="small" fullWidth>
            {PROVIDERS.map((x) => <MenuItem key={x.id} value={x.id}>{lang === 'zh' ? x.name : (x.en ?? x.name)}</MenuItem>)}
          </TextField>
          {builtin ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.builtinNote}</Typography>
          ) : (<>
            <TextField label={t.base} value={f.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} size="small" fullWidth
              placeholder="https://api.example.com/v1"
              helperText={f.provider !== 'custom' ? null : '…/chat/completions 之前的部分 / the part before /chat/completions'} />
            <TextField label={t.key} value={f.apiKey} onChange={(e) => set({ apiKey: e.target.value })} size="small" fullWidth
              type={show ? 'text' : 'password'} autoComplete="off"
              helperText={p.keyUrl ? <Link href={p.keyUrl} target="_blank" rel="noopener noreferrer">{t.getKey} ↗</Link> : null}
              slotProps={{ input: { endAdornment: (
                <InputAdornment position="end"><IconButton size="small" onClick={() => setShow((s) => !s)} edge="end">{show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment>
              ) } }} />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Autocomplete freeSolo fullWidth size="small" options={options} value={f.model}
                onChange={(_, v) => set({ model: v ?? '' })} onInputChange={(_, v) => set({ model: v })}
                renderInput={(params) => <TextField {...params} label={t.model} helperText={p.modelHint} />} />
              <Button onClick={loadModels} disabled={busy} sx={{ flexShrink: 0, mt: 0.25 }} size="small">
                {busy ? <CircularProgress size={16} /> : t.fetch}
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>{t.note}</Typography>
          </>)}
          {msg && <Alert severity={msg.severity} sx={{ wordBreak: 'break-word' }}>{msg.text}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!builtin && saved.provider !== 'builtin' && <Button onClick={() => { saveLlmConfig({ ...DEFAULT }); onClose(); }} color="inherit" sx={{ mr: 'auto' }}>{t.reset}</Button>}
        <Button onClick={onClose} color="inherit">{t.cancel}</Button>
        <Button onClick={save} variant="contained" disableElevation>{t.save}</Button>
      </DialogActions>
    </Dialog>
  );
}
