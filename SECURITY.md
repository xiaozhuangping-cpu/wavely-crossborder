# 安全说明

## 报告漏洞

如果你发现安全问题（例如 RLS 绕过、越权调用数据库函数、边缘函数可被滥用），请**不要公开提 Issue**，通过 GitHub 的 [Private vulnerability reporting](https://github.com/xiaozhuangping-cpu/wavely-crossborder/security/advisories/new) 私下报告，我会尽快处理。

## 设计上公开的内容（不是漏洞）

- `erp/.env`、`shop/.env`、`extension/config.js`、`app/lib/config.dart` 中的 Supabase URL 与 **publishable key**：按 Supabase 的设计本就暴露在前端，数据访问由 RLS 与数据库函数中的角色检查控制
- 演示站访客匿名登录后可读写 ERP 演示数据、可在顶栏自行切换身份：这是演示站的设计，数据每天 03:00 自动重置

## 不会出现在仓库里的内容

- `DEEPSEEK_API_KEY` 等服务端密钥只存在 Supabase Secrets 中
- 访客在「AI 模型设置」里填写的自有 API Key 只保存在浏览器本地，经边缘函数转发给对应服务商，不落库、不写日志；自定义接口地址只允许 https 公网域名（防 SSRF）
