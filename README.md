# Wavely 跨境电商演示

虚构品牌「Wavely 海浪优选」的跨境电商全链路演示。

- 在线访问：https://xiaozhuangping-cpu.github.io/wavely-crossborder/
- ERP 后台：https://xiaozhuangping-cpu.github.io/wavely-crossborder/erp/

## 结构

```
erp/        跨境 ERP 后台（React + react-admin + ra-supabase-core + Recharts）
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
| 保活 | GitHub Actions 每 3 天访问一次，避免免费项目被暂停 |

前端只使用 publishable key（本就设计为公开），数据安全由 RLS 控制。

## 本地开发

```bash
cd erp && npm install && npm run dev
```

修改数据库：在 `supabase/migrations/` 新增迁移后执行 `supabase db push`。

## 部署

推送到 `main` 后，GitHub Actions 自动构建并发布到 GitHub Pages。
