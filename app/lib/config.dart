// 公开配置：publishable key 本就设计为可暴露在前端，数据安全由 Supabase RLS 控制（与 erp/.env 一致）
const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://wzxwssipzychiyygzcpd.supabase.co');
const supabaseKey = String.fromEnvironment('SUPABASE_KEY', defaultValue: 'sb_publishable_4lfpfSj-OMA20HNBWw4zEg_5AeJZSdo');
const erpUrl = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/erp/';
