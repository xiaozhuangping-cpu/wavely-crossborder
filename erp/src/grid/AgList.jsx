// AG Grid 列表：数据、排序、筛选、多选都与 react-admin 的 ListContext 双向同步（服务端分页/排序/筛选）
// 按 ag-dev skill 建议：所有非基础类型的 props 保持引用稳定，否则每次渲染都会重置列状态与行选择
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListContext } from 'react-admin';
import { AgGridReact } from 'ag-grid-react';
import {
  ModuleRegistry, enableDevValidations, themeQuartz, colorSchemeDark, colorSchemeLight,
  ClientSideRowModelModule, ClientSideRowModelApiModule, RowApiModule, RowSelectionModule, RowStyleModule, CellStyleModule,
  ColumnApiModule, LocaleModule, TextFilterModule, CustomFilterModule,
} from 'ag-grid-community';
import { Box, Stack, Typography, IconButton, Tooltip, Select, MenuItem, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { SelectFilter, SelectFloatingFilter, passAll } from './filters';

ModuleRegistry.registerModules([
  ClientSideRowModelModule, ClientSideRowModelApiModule, RowApiModule, RowSelectionModule, RowStyleModule, CellStyleModule,
  ColumnApiModule, LocaleModule, TextFilterModule, CustomFilterModule,
]);
// 开发环境打开校验：未注册模块等配置问题会给出可读报错（生产包不包含）
if (import.meta.env.DEV) enableDevValidations();

const LOCALE = {
  noRowsToShow: '暂无数据', loadingOoo: '加载中…', page: '页', of: '/', to: '-',
  contains: '包含', filterOoo: '筛选…', sortAscending: '升序', sortDescending: '降序',
};
const DEFAULT_COL = { resizable: true, suppressHeaderMenuButton: true, cellStyle: { display: 'flex', alignItems: 'center' } };
const ROW_SELECTION = { mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false };
const SELECTION_COL = { width: 48, pinned: 'left' };
const TEXT_FILTER_PARAMS = { filterOptions: ['contains'], maxNumConditions: 1, debounceMs: 400, trimInput: true };
const getRowId = (p) => String(p.data.id);
// 与键顺序无关的比较
const stable = (o = {}) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

// filterSpec → AG Grid 列配置（列 id 用筛选字段，便于和 react-admin filterValues 对应）
const buildCol = ({ filterSpec, ...c }, sort) => {
  const colId = c.colId ?? c.field ?? filterSpec?.source;
  const base = {
    ...c, colId,
    sortable: c.sortable ?? !!c.field,
    sort: c.field && sort?.field === c.field ? sort.order.toLowerCase() : null,
    comparator: () => 0,          // 数据已由服务端排序
  };
  if (!filterSpec) return { ...base, floatingFilter: false };
  const common = { floatingFilter: true, suppressFloatingFilterButton: true, suppressHeaderFilterButton: true };
  if (filterSpec.type === 'select') {
    return {
      ...base, ...common,
      filter: { component: SelectFilter, doesFilterPass: passAll },
      filterParams: { choices: filterSpec.choices, placeholder: filterSpec.placeholder },
      floatingFilterComponent: SelectFloatingFilter, floatingFilterComponentParams: { spec: filterSpec },
    };
  }
  return {
    ...base, ...common,
    filter: 'agTextColumnFilter',
    filterParams: TEXT_FILTER_PARAMS,
    // 渲染器列没有 field 时，指定筛选取值（当前页的客户端过滤与服务端 ilike 结果一致）
    ...(filterSpec.value ? { filterValueGetter: filterSpec.value } : {}),
    floatingFilterComponentParams: { filterPlaceholder: filterSpec.placeholder },
  };
};

// Gmail 式分页：「第 1–50 条，共 711 条 ‹ ›」，翻页按钮始终可见（无上/下一页时置灰）
const Pager = () => {
  const { page = 1, perPage = 25, total = 0, setPage, setPerPage } = useListContext();
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mr: 0.5 }}>每页</Typography>
      <Select size="small" variant="standard" disableUnderline value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}
        sx={{ fontSize: 12, mr: 1.5, '& .MuiSelect-select': { py: 0.25 } }}>
        {[25, 50, 100].map((n) => <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>)}
      </Select>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>第 {from}–{to} 条，共 {total.toLocaleString()} 条</Typography>
      <Tooltip title="上一页"><span><IconButton size="small" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeftIcon /></IconButton></span></Tooltip>
      <Tooltip title="下一页"><span><IconButton size="small" disabled={to >= total} onClick={() => setPage(page + 1)}><ChevronRightIcon /></IconButton></span></Tooltip>
    </Stack>
  );
};

export default function AgList({ columnDefs, rowClick, bulkActions, rowHeight = 56, pagination = true, height }) {
  // 有分页的列表固定高度、表格内滚动；小表格（无分页）自动高度
  const fixedHeight = height ?? (pagination ? 'max(360px, calc(100dvh - 200px))' : null);
  const { data, isPending, sort, setSort, filterValues = {}, setFilters, displayedFilters, selectedIds = [], onSelect, onUnselectItems, total } = useListContext();
  const navigate = useNavigate();
  const gridRef = useRef(null);
  const t = useTheme();
  const gm = t.palette.gm;
  const dark = t.palette.mode === 'dark';

  // 列定义只在挂载时取一次（列是静态配置），排序变化时才重建
  const [defs] = useState(columnDefs);
  const specByCol = useMemo(() => Object.fromEntries(defs.filter((c) => c.filterSpec)
    .map((c) => [c.colId ?? c.field ?? c.filterSpec.source, c.filterSpec])), [defs]);
  const cols = useMemo(() => defs.map((c) => buildCol(c, sort)), [defs, sort]);
  const hasFilters = Object.keys(specByCol).length > 0;
  const rowData = useMemo(() => data ?? [], [data]);

  // Gmail 配色的 Quartz 主题
  const theme = useMemo(() => themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({
    accentColor: t.palette.primary.main, backgroundColor: gm.surface, foregroundColor: gm.text,
    headerBackgroundColor: gm.surface, headerTextColor: gm.textSub, headerFontWeight: 600, borderColor: gm.border,
    rowHoverColor: dark ? 'rgba(255,255,255,.04)' : '#f2f6fc', selectedRowBackgroundColor: gm.selectedRow,
    inputBackgroundColor: gm.search, inputBorder: false, inputFocusBorder: { color: t.palette.primary.main },
    fontFamily: 'inherit', fontSize: 13, spacing: 7,
    // Gmail 风格：无外框、无列线，只保留行分隔细线
    wrapperBorder: false, wrapperBorderRadius: 0, columnBorder: false, headerColumnBorder: false, pinnedColumnBorder: false,
    rowBorder: { color: gm.border }, headerRowBorder: { color: gm.border }, headerColumnResizeHandleColor: gm.border,
  }), [dark, gm, t.palette.primary.main]);

  // ---- 筛选：react-admin filterValues → 表格（初始化、URL 变化、清空时）----
  // pending：表格刚发出、react-admin 尚未生效的筛选；在它追上之前不反向覆盖表格
  const pending = useRef(null);
  const syncFilterModel = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    if (pending.current) {
      if (pending.current !== stable(filterValues)) return;
      pending.current = null;
    }
    const model = {};
    for (const [colId, spec] of Object.entries(specByCol)) {
      const v = filterValues[spec.source];
      if (v == null || v === '') continue;
      model[colId] = spec.type === 'select' ? String(v) : { filterType: 'text', type: 'contains', filter: String(v) };
    }
    const flat = (m) => JSON.stringify(Object.keys(m).sort().map((k) => [k, typeof m[k] === 'object' ? m[k]?.filter : m[k]]));
    if (flat(api.getFilterModel() ?? {}) !== flat(model)) api.setFilterModel(model);
  }, [specByCol, filterValues]);
  useEffect(syncFilterModel, [syncFilterModel]);

  // ---- 筛选：表格 → react-admin（服务端查询）----
  const onFilterChanged = (e) => {
    if (e.source === 'api') return;
    const model = e.api.getFilterModel() ?? {};
    const next = { ...filterValues };
    for (const [colId, spec] of Object.entries(specByCol)) {
      if (spec.type === 'select') {
        // 模型是字符串，换回选项原始类型（布尔 / 数字 / 字符串）
        const opt = model[colId] != null ? spec.choices.find((c) => String(c.id) === model[colId]) : null;
        if (opt) next[spec.source] = opt.id; else delete next[spec.source];
      } else {
        const v = model[colId]?.filter;
        if (v) next[spec.source] = v; else delete next[spec.source];
      }
    }
    if (stable(next) !== stable(filterValues)) {
      pending.current = stable(next);
      setFilters(next, displayedFilters, false);   // 不再二次防抖：文本筛选自身已有 400ms debounce
    }
  };

  // ---- 选择：react-admin selectedIds ↔ 表格勾选 ----
  const syncSelection = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || !rowData.length) return;
    const present = new Set(rowData.map((r) => String(r.id)));
    const kept = selectedIds.filter((id) => present.has(String(id)));
    if (kept.length !== selectedIds.length) { onSelect?.(kept); return; }   // 清掉过期选择（上次会话残留、数据已重置）
    const want = new Set(kept.map(String));
    const on = [], off = [];
    api.forEachNode((n) => {
      const should = want.has(n.id);
      if (should !== n.isSelected()) (should ? on : off).push(n);
    });
    if (on.length) api.setNodesSelected({ nodes: on, newValue: true, source: 'api' });
    if (off.length) api.setNodesSelected({ nodes: off, newValue: false, source: 'api' });
  }, [rowData, selectedIds, onSelect]);
  useEffect(syncSelection, [syncSelection]);

  const onRowClicked = (e) => {
    if (!rowClick || e.event?.target?.closest?.('a,button,input,select,[role="checkbox"]')) return;
    const to = typeof rowClick === 'function' ? rowClick(e.data.id, e.data) : `${e.data.id}`;
    if (to) navigate(to.startsWith('/') ? to : `/${to}`);
  };
  const rowStyle = useMemo(() => ({ cursor: rowClick ? 'pointer' : 'default' }), [rowClick]);

  return (
    <Box>
      {pagination && (
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'flex-end', minHeight: 40, px: 0.5 }}>
          <Pager />
        </Stack>
      )}
      <Box sx={{ position: 'relative', ...(fixedHeight ? { height: fixedHeight } : {}) }}>
        {/* 批量操作栏覆盖在表头上（左侧全选框仍可见），避免表格跳动 */}
        {bulkActions && selectedIds.length > 0 && (
          <Stack direction="row" sx={{ position: 'absolute', zIndex: 3, top: 0, left: 48, right: 0, height: 44, alignItems: 'center', gap: 1, px: 1,
            bgcolor: gm.navActive, color: gm.navActiveText, '& .MuiButton-root': { color: 'inherit' } }}>
            <Tooltip title="取消选择"><IconButton size="small" onClick={onUnselectItems} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton></Tooltip>
            <Typography sx={{ fontSize: 14, fontWeight: 600, mr: 'auto' }}>已选 {selectedIds.length} 项</Typography>
            {bulkActions}
          </Stack>
        )}
        <AgGridReact
          ref={gridRef}
          theme={theme}
          rowData={rowData}
          columnDefs={cols}
          defaultColDef={DEFAULT_COL}
          getRowId={getRowId}
          domLayout={fixedHeight ? 'normal' : 'autoHeight'}
          rowHeight={rowHeight}
          headerHeight={44}
          floatingFiltersHeight={hasFilters ? 40 : 0}
          loading={isPending}
          localeText={LOCALE}
          rowSelection={bulkActions ? ROW_SELECTION : undefined}
          selectionColumnDef={SELECTION_COL}
          rowStyle={rowStyle}
          onGridReady={() => { syncFilterModel(); syncSelection(); }}
          onRowDataUpdated={syncSelection}
          onSelectionChanged={(e) => {
            if (e.source === 'api') return;
            onSelect?.(e.api.getSelectedRows().map((r) => r.id));
          }}
          onSortChanged={(e) => {
            if (e.source === 'api' || e.source === 'gridOptionsUpdated') return;
            const s = e.api.getColumnState().find((c) => c.sort);
            if (s) setSort({ field: s.colId, order: s.sort.toUpperCase() });
          }}
          enableFilterHandlers
          onFilterChanged={onFilterChanged}
          onRowClicked={onRowClicked}
          suppressCellFocus
          enableCellTextSelection
          animateRows={false}
        />
      </Box>
    </Box>
  );
}
