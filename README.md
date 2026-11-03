# Wavely 跨境电商演示

虚构品牌「Wavely 海浪优选」的跨境电商全链路演示。

> 本项目的代码、演示数据与界面设计均为 AI 辅助生成（使用 Claude Code），由作者策划与发布。

- 在线访问：https://xiaozhuangping-cpu.github.io/wavely-crossborder/
- ERP 后台：https://xiaozhuangping-cpu.github.io/wavely-crossborder/erp/
- 独立站：https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/

## 结构

```
erp/        跨境 ERP 后台（React + react-admin + ra-supabase-core + Recharts + assistant-ui）
supabase/functions/ai-assistant/    ERP AI 运营助手
supabase/functions/shop-assistant/  独立站 AI 客服（导购、查物流、政策问答，只读）
supabase/functions/_shared/llm.ts   两者共用：鉴权、配额、DeepSeek 流式工具调用
shop/       多语言独立站（React + MUI + assistant-ui，中/英/德/日/西，6 种币种）
site/       演示入口页
supabase/   数据库迁移：表结构、RLS、业务函数、演示数据、定时任务
```

## 后端（Supabase）

| 能力 | 实现 |
|---|---|
| 访客登录 | 匿名登录（Anonymous Sign-in），无需注册 |
| 权限 | RLS：未登录只能读在售商品/店铺/汇率；登录访客可读写 ERP 数据 |
| 独立站下单 | `place_order()`（security definer，校验数量与收货信息） |
| 物流推进 | `advance_shipments()`，pg_cron 每小时执行 |
| 每日重置 | `reset_demo()`，pg_cron 每天北京时间 03:00 执行 |
| AI 运营助手 | 边缘函数 `ai-assistant` 调用 DeepSeek 工具调用；只读工具服务端执行（遵守 RLS），写操作只生成提案、用户确认后执行；每访客每天 30 次、全站 1500 次 |
| 保活 | GitHub Actions 每 3 天访问一次，避免免费项目被暂停 |

前端只使用 publishable key（本就设计为公开），数据安全由 RLS 控制。

## 本地开发

```bash
cd erp && npm install && npm run dev
```

修改数据库：在 `supabase/migrations/` 新增迁移后执行 `supabase db push`。

## 部署

推送到 `main` 后，GitHub Actions 自动构建并发布到 GitHub Pages。

## AI 运营助手

点击 ERP 右上角 ✦ 打开。可以问销售数据、找补货商品、生成多语言 Listing、批量发货。

部署前需要设置密钥（只存在 Supabase 服务端）：

```bash
supabase secrets set DEEPSEEK_API_KEY=...
supabase functions deploy ai-assistant shop-assistant --no-verify-jwt
```
