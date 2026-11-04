// 操作日志：关键操作由数据库函数写入（log_action），访客只读
import { List, SimpleList } from 'react-admin';
import { Chip, useMediaQuery, Box, Typography } from '@mui/material';
import { AgList, col, render } from '../grid';
import { ROLES } from '../auth/role';

export const ACTIONS = {
  create_po: '创建采购单', submit_po: '提交审批', place_po: '下单', approve_po: '审批通过', reject_po: '驳回',
  receive_po: '收货入库', cancel_po: '取消采购单', ship_order: '发货', switch_role: '切换身份',
};
const ACTION_CHOICES = Object.entries(ACTIONS).map(([id, name]) => ({ id, name }));
const ROLE_CHOICES = Object.entries(ROLES).map(([id, r]) => ({ id, name: r.label }));
const ROLE_COLOR = { owner: 'primary', purchaser: 'secondary', warehouse: 'warning' };
const time = (v) => new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const COLS = [
  render('时间', ({ r }) => time(r.at), { field: 'at', sortable: true, width: 160 }),
  render('身份', ({ r }) => <Chip size="small" color={ROLE_COLOR[r.role]} variant="outlined" label={ROLES[r.role]?.label ?? r.role} />,
    { field: 'role', sortable: true, width: 100, filterSpec: { type: 'select', source: 'role', choices: ROLE_CHOICES, placeholder: '全部' } }),
  render('操作', ({ r }) => ACTIONS[r.action] ?? r.action, { field: 'action', sortable: true, width: 130, filterSpec: { type: 'select', source: 'action', choices: ACTION_CHOICES, placeholder: '全部' } }),
  col('summary', '内容', { flex: 1, minWidth: 260, filterSpec: { type: 'text', source: 'summary@ilike', placeholder: '内容' } }),
  render('访客', ({ r }) => <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{r.actor ? r.actor.slice(0, 8) : '系统'}</Typography>, { width: 100 }),
];

export const AuditLogList = () => {
  const isSmall = useMediaQuery((t) => t.breakpoints.down('md'));
  return (
    <List resource="audit_log" title="操作日志" sort={{ field: 'at', order: 'DESC' }} perPage={50} pagination={isSmall ? undefined : false} actions={false} empty={false}>
      {isSmall ? (
        <SimpleList primaryText={(r) => r.summary} secondaryText={(r) => `${ROLES[r.role]?.label ?? r.role} · ${ACTIONS[r.action] ?? r.action}`} tertiaryText={(r) => time(r.at)} linkType={false} />
      ) : (<>
        <Box sx={{ px: 2, pt: 1.5 }}><Typography sx={{ fontSize: 13, color: 'text.secondary' }}>记录采购下单、审批、收货、发货与身份切换：谁、以什么身份、做了什么。日志由数据库函数写入，任何人都不能修改。</Typography></Box>
        <AgList columnDefs={COLS} rowHeight={44} />
      </>)}
    </List>
  );
};
