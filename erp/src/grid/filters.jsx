// 下拉选择式列筛选：按 AG Grid v36 官方扩展方式实现（受控的自定义筛选 + 自定义浮动筛选，配合 enableFilterHandlers）
// 社区版没有 Set Filter（企业版），这里扩展一个轻量的「单选」筛选。
// 筛选模型 = 选中值的字符串（null 表示不筛选），出现在 api.getFilterModel() 中，由 AgList 同步到服务端。
import { Box } from '@mui/material';

const selectSx = (t) => ({
  width: '100%', height: 30, px: 1, fontSize: 13, borderRadius: 1.5, border: '1px solid transparent', outline: 'none',
  bgcolor: t.palette.gm.search, color: 'text.primary', cursor: 'pointer', fontFamily: 'inherit', colorScheme: t.palette.mode,
  '&:focus': { borderColor: t.palette.primary.main },
});

const Options = ({ choices, placeholder }) => (
  <>
    <option value="">{placeholder ?? '全部'}</option>
    {choices.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
  </>
);

// 筛选弹层（表头筛选按钮已隐藏，主要用于完整性与 API 调用）
export const SelectFilter = ({ model, onModelChange, choices = [], placeholder }) => (
  <Box sx={{ p: 1.5, minWidth: 180 }}>
    <Box component="select" value={model ?? ''} onChange={(e) => onModelChange(e.target.value === '' ? null : e.target.value)} sx={selectSx}>
      <Options choices={choices} placeholder={placeholder} />
    </Box>
  </Box>
);

// 浮动筛选（表头下方那一行）
export const SelectFloatingFilter = ({ model, onModelChange, spec }) => (
  <Box component="select" value={model ?? ''} aria-label={spec.placeholder ?? '筛选'}
    onChange={(e) => onModelChange(e.target.value === '' ? null : e.target.value)} sx={selectSx}>
    <Options choices={spec.choices} placeholder={spec.placeholder} />
  </Box>
);

// 数据已由服务端按筛选条件返回，客户端不再过滤
export const passAll = () => true;
