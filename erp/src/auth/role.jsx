// 演示用的角色（RBAC）：真正的权限检查在数据库函数里（require_role），这里只负责显示与隐藏不可用的操作
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotify, useRefresh } from 'react-admin';
import {
  Chip, Menu, MenuItem, ListItemText, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableHead, TableRow, TableCell, TableBody, Typography, Tooltip,
} from '@mui/material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { supabase } from '../supabase';

export const ROLES = {
  owner: { label: '老板', desc: '全部操作；审批超过 ¥5,000 的采购单' },
  purchaser: { label: '采购', desc: '供应商、采集导入、创建 / 提交 / 取消采购单' },
  warehouse: { label: '仓库', desc: '采购单收货入库、订单发货' },
};
export const APPROVAL_THRESHOLD = 5000;

// 与数据库 require_role 保持一致
const PERMS = {
  createPO: ['owner', 'purchaser'], submitPO: ['owner', 'purchaser'], cancelPO: ['owner', 'purchaser'],
  approvePO: ['owner'], receivePO: ['owner', 'warehouse'], ship: ['owner', 'warehouse'],
  importDraft: ['owner', 'purchaser'], editSupplier: ['owner', 'purchaser'],
};
const MATRIX = [
  ['生成 / 提交 / 取消采购单', 'createPO'], ['审批大额采购单（> ¥5,000）', 'approvePO'], ['收货入库', 'receivePO'],
  ['订单发货（含批量 / AI 发货）', 'ship'], ['1688 采集导入', 'importDraft'], ['维护供应商', 'editSupplier'],
];

export const useRole = () => {
  const { data } = useQuery({
    queryKey: ['app_role'],
    queryFn: async () => { const { data, error } = await supabase.rpc('app_role'); if (error) throw error; return data; },
    staleTime: 60_000,
  });
  const role = data ?? 'owner';
  return { role, label: ROLES[role]?.label ?? role, can: (perm) => PERMS[perm]?.includes(role) ?? true };
};

const PermissionDialog = ({ open, onClose, role }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>角色与权限</DialogTitle>
    <DialogContent>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
        权限在数据库层强制：每个关键操作的数据库函数都会检查当前身份，越权直接被拒绝；采购单表只读，直接调接口也改不了；成功的操作都会记入操作日志。演示站访客可自由切换身份体验。
      </Typography>
      <Table size="small">
        <TableHead><TableRow><TableCell>操作</TableCell>{Object.entries(ROLES).map(([k, r]) => <TableCell key={k} align="center" sx={{ fontWeight: k === role ? 700 : 500 }}>{r.label}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {MATRIX.map(([name, perm]) => (
            <TableRow key={perm}>
              <TableCell>{name}</TableCell>
              {Object.keys(ROLES).map((k) => <TableCell key={k} align="center">{PERMS[perm].includes(k) ? <CheckIcon fontSize="small" color="success" /> : <Typography sx={{ color: 'text.disabled' }}>—</Typography>}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>知道了</Button></DialogActions>
  </Dialog>
);

export const RoleSwitcher = () => {
  const { role, label } = useRole();
  const qc = useQueryClient();
  const notify = useNotify();
  const refresh = useRefresh();
  const [el, setEl] = useState(null);
  const [matrix, setMatrix] = useState(false);
  const pick = async (r) => {
    setEl(null);
    if (r === role) return;
    const { error } = await supabase.rpc('set_demo_role', { p_role: r });
    if (error) { notify(error.message, { type: 'error' }); return; }
    await qc.invalidateQueries({ queryKey: ['app_role'] });
    notify(`已切换为「${ROLES[r].label}」：${ROLES[r].desc}`, { type: 'info' });
    refresh();
  };
  return (
    <>
      <Tooltip title="切换演示身份，体验不同角色的权限">
        <Chip icon={<BadgeOutlinedIcon />} label={`身份：${label}`} onClick={(e) => setEl(e.currentTarget)} variant="outlined" sx={{ mr: 0.5, fontWeight: 500 }} />
      </Tooltip>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        {Object.entries(ROLES).map(([k, r]) => (
          <MenuItem key={k} selected={k === role} onClick={() => pick(k)} sx={{ minWidth: 280 }}>
            <ListItemText primary={r.label} secondary={r.desc} />
            {k === role && <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setEl(null); setMatrix(true); }}><ListItemText primary="查看权限对照表" /></MenuItem>
      </Menu>
      <PermissionDialog open={matrix} onClose={() => setMatrix(false)} role={role} />
    </>
  );
};
