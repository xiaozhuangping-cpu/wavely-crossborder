import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';

// 运营助手的图标：普通线条图标，跟随文字颜色（不用星光和品牌外的蓝色）
export const Sparkle = ({ size = 20 }) => <ForumOutlinedIcon sx={{ fontSize: size, color: 'text.secondary' }} />;
