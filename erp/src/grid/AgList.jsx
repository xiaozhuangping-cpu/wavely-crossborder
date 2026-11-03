// AG Grid 列表：数据、排序、多选都来自 react-admin 的 ListContext，分页/筛选/批量操作照常使用
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListContext } from 'react-admin';
import { AgGridReact } from 'ag-grid-react';
import {
  ModuleRegistry, themeQuartz, colorSchemeDark, colorSchemeLight,
  ClientSideRowModelModule, RowSelectionModule, CellStyleModule, RowStyleModule, LocaleModule, ColumnApiModule,
} from 'ag-grid-community';
import { Box, Stack, Typography, IconButton, Tooltip, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// 只注册用到的模块（全量 AllCommunityModule 体积约是现在的 3 倍）
ModuleRegistry.registerModules([
  ClientSideRowModelModule, RowSelectionModule, CellStyleModule, RowStyleModule, LocaleModule, ColumnApiModule,
]);

const LOCALE = {
  noRowsToShow: '暂无数据', loadingOoo: '加载中…', page: '页', of: '/', to: '-',
  sortAscending: '升序', sortDescending: '降序', pinColumn: '固定列', autosizeThisColumn: '自适应宽度', resetColumns: '重置列',
};

export default function AgList({ columnDefs, rowClick, bulkActions, rowHeight = 56 }) {
  const { data, isPending, sort, setSort, selectedIds = [], onSelect, onUnselectItems } = useListContext();
  const navigate = useNavigate();
  const api = useRef(null);
  const t = useTheme();
  const gm = t.palette.gm;
  const dark = t.palette.mode === 'dark';

  // Gmail 配色的 Quartz 主题
  const theme = useMemo(() => themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({
    accentColor: t.palette.primary.main,
    backgroundColor: gm.surface,
    foregroundColor: gm.text,
    headerBackgroundColor: gm.surface,
    headerTextColor: gm.textSub,
    headerFontWeight: 600,
    borderColor: gm.border,
    rowHoverColor: dark ? 'rgba(255,255,255,.04)' : '#f2f6fc',
    selectedRowBackgroundColor: gm.selectedRow,
    fontFamily: 'inherit',
    fontSize: 13,
    wrapperBorderRadius: 12,
    spacing: 7,
  }), [dark, gm, t.palette.primary.main]);

  // 服务端排序：把 react-admin 当前排序映射到列上
  const cols = useMemo(() => columnDefs.map((c) => ({
    ...c,
    sortable: c.sortable ?? !!c.field,
    sort: c.field && sort?.field === c.field ? sort.order.toLowerCase() : null,
    // 数据已由服务端排好，客户端不再重排
    comparator: () => 0,
  })), [columnDefs, sort]);

  // 外部清空选择（如批量操作完成后）时同步到表格
  useEffect(() => {
    if (!api.current) return;
    if (!selectedIds.length) api.current.deselectAll();
  }, [selectedIds.length]);

  const onRowClicked = (e) => {
    if (!rowClick || e.event?.target?.closest?.('a,button,input,[role="checkbox"]')) return;
    const to = typeof rowClick === 'function' ? rowClick(e.data.id, e.data) : `${e.data.id}`;
    if (to) navigate(to.startsWith('/') ? to : `/${to}`);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* 批量操作栏覆盖在表头上（左侧全选框仍可见），避免表格跳动 */}
      {bulkActions && selectedIds.length > 0 && (
        <Stack direction="row" sx={{ position: 'absolute', zIndex: 3, top: 1, left: 49, right: 1, height: 43, alignItems: 'center', gap: 1, px: 1,
          borderTopRightRadius: 11, bgcolor: gm.navActive, color: gm.navActiveText, '& .MuiButton-root': { color: 'inherit' } }}>
          <Tooltip title="取消选择"><IconButton size="small" onClick={onUnselectItems} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton></Tooltip>
          <Typography sx={{ fontSize: 14, fontWeight: 600, mr: 'auto' }}>已选 {selectedIds.length} 项</Typography>
          {bulkActions}
        </Stack>
      )}
      <AgGridReact
        theme={theme}
        rowData={data ?? []}
        columnDefs={cols}
        defaultColDef={{ resizable: true, suppressHeaderMenuButton: true, cellStyle: { display: 'flex', alignItems: 'center' } }}
        getRowId={(p) => String(p.data.id)}
        domLayout="autoHeight"
        rowHeight={rowHeight}
        headerHeight={44}
        loading={isPending}
        localeText={LOCALE}
        rowSelection={bulkActions ? { mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false } : undefined}
        selectionColumnDef={{ width: 48, pinned: 'left' }}
        onGridReady={(e) => { api.current = e.api; }}
        onSelectionChanged={(e) => {
          if (e.source === 'api') return;
          onSelect?.(e.api.getSelectedRows().map((r) => r.id));
        }}
        onSortChanged={(e) => {
          if (e.source === 'api' || e.source === 'gridOptionsUpdated') return;
          const s = e.api.getColumnState().find((c) => c.sort);
          if (s) setSort({ field: s.colId, order: s.sort.toUpperCase() });
        }}
        onRowClicked={onRowClicked}
        rowStyle={{ cursor: rowClick ? 'pointer' : 'default' }}
        suppressCellFocus
        enableCellTextSelection
        animateRows={false}
      />
    </Box>
  );
}
