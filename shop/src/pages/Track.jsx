import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Stack, TextField, Button, Card, Chip, Alert } from '@mui/material';
import { useStore, supabase } from '../store';

// 数据库里的物流描述是中文，其他语言按对照表翻译
const EVENT_TX = {
  '已生成运单，等待揽收': { de: 'Versandetikett erstellt, wartet auf Abholung', en: 'Label created, awaiting pickup', ja: '送り状作成済み・集荷待ち', es: 'Etiqueta creada, pendiente de recogida' },
  '快递员已揽收': { de: 'Vom Kurier abgeholt', en: 'Picked up by courier', ja: '集荷完了', es: 'Recogido por el transportista' },
  '航班已起飞，运输中': { de: 'Im Flugzeug unterwegs', en: 'Departed on flight, in transit', ja: '航空便で輸送中', es: 'En vuelo, en tránsito' },
  '到达目的国，清关中': { de: 'Im Zielland angekommen, Zollabfertigung', en: 'Arrived in destination country, clearing customs', ja: '到着国で通関手続き中', es: 'En el país de destino, en aduanas' },
  '派送中': { de: 'In Zustellung', en: 'Out for delivery', ja: '配達中', es: 'En reparto' },
  '已签收': { de: 'Zugestellt', en: 'Delivered', ja: 'お届け済み', es: 'Entregado' },
};
const txEvent = (d, lang) => (lang === 'zh' ? d : EVENT_TX[d]?.[lang] ?? d);
const txLoc = (l, lang) => (lang === 'zh' ? l : l.replace('深圳宝安', 'Shenzhen Bao\'an').replace('深圳', 'Shenzhen').replace('香港国际机场', 'Hong Kong Intl. Airport').replace(' 口岸', ' port of entry').replace(' 派送站', ' delivery station'));

export const Timeline = ({ data, tr, lang }) => {
  const s = data.shipment;
  const fmt = (d) => new Date(d).toLocaleString(lang === 'zh' ? 'zh-CN' : lang);
  return (
    <Box>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.order_no}</Typography>
        <Chip size="small" color={data.status === 'delivered' ? 'success' : 'primary'} label={tr.status[data.status] ?? data.status} />
        {s && <Chip size="small" variant="outlined" label={`${s.carrier} · ${s.tracking_no}`} />}
      </Stack>
      {!s && <Typography sx={{ color: 'text.secondary' }}>{tr.notShipped}</Typography>}
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {(s?.events ?? []).map((e, i, arr) => (
          <Box component="li" key={i} sx={{ position: 'relative', pl: 3.5, pb: 2.25,
            '&::before': { content: '""', position: 'absolute', left: 6, top: 6, width: 12, height: 12, borderRadius: '50%', bgcolor: i === 0 ? 'primary.main' : '#cfd8d7' },
            '&::after': i < arr.length - 1 ? { content: '""', position: 'absolute', left: 11, top: 20, bottom: 0, width: 2, bgcolor: '#e3ebea' } : {} }}>
            <Typography sx={{ fontWeight: i === 0 ? 600 : 400 }}>{txEvent(e.description, lang)}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{txLoc(e.location, lang)} · {fmt(e.time)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const Track = () => {
  const { tr, lang, orders } = useStore();
  const [params, setParams] = useSearchParams();
  const [no, setNo] = useState(params.get('no') ?? '');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const query = async (value) => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    setErr(''); setData(null); setParams({ no: v });
    const { data: d, error } = await supabase.rpc('track_order', { p_order_no: v });
    if (error || !d) setErr(tr.notFound); else setData(d);
  };
  useEffect(() => { if (params.get('no')) query(params.get('no')); }, []);   // eslint-disable-line

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, pt: 5 }}>
      <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 40 }, mb: 3 }}>{tr.track}</Typography>
      <Stack component="form" direction="row" spacing={1} onSubmit={(e) => { e.preventDefault(); query(no); }}>
        <TextField fullWidth value={no} onChange={(e) => setNo(e.target.value)} placeholder={tr.trackHint} inputProps={{ 'aria-label': tr.trackHint }} />
        <Button type="submit" variant="contained" sx={{ px: 3 }}>{tr.trackBtn}</Button>
      </Stack>
      {orders.length > 0 && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2, alignItems: 'center' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{tr.myOrders}:</Typography>
          {orders.map((o) => <Chip key={o} size="small" label={o} onClick={() => { setNo(o); query(o); }} />)}
        </Stack>
      )}
      {err && <Alert severity="warning" sx={{ mt: 3 }}>{err}</Alert>}
      {data && <Card sx={{ mt: 3, p: 3, '&:hover': { transform: 'none', boxShadow: 'none' } }}><Timeline data={data} tr={tr} lang={lang} /></Card>}
    </Box>
  );
};
