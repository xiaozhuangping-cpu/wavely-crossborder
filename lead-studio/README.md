# 项目来信

客户需求收集页面与管理后台。前端使用 React、shadcn/ui 和 AG Grid Community，后端使用现有云端 Supabase。管理员使用 Supabase Auth 登录，数据库行级权限仅允许白名单账号读取和跟进需求。

## 本地运行

```sh
cd lead-studio/frontend
npm ci
cp .env.example .env.local
# 将已有 Supabase 项目 URL 和公开客户端 key 填入 .env.local
npm run dev
```

客户页面：http://127.0.0.1:5178/ ；管理入口：http://127.0.0.1:5178/?view=admin 。`VITE_SUPABASE_KEY` 只能使用 publishable / anon key，不得使用 service role / secret key。`VITE_PUBLIC_CONTACT` 可选；当前未配置自动通知或微信二维码。

## GitHub Pages

现有工作流将网站构建到 `/wavely-crossborder/lead-studio/`，使用仓库中电商项目 `shop/.env` 的公开 Supabase 客户端配置。静态资源由 GitHub Pages 提供，数据和认证仍由 Supabase 提供。管理员入口在同一 URL 后添加 `?view=admin`。

数据库脚本 `supabase/migrations/20261111000000_lead_studio.sql` 已单独应用到当前云端项目，并未记录在该项目的常规迁移历史；迁移到其他环境时需按迁移流程单独应用一次。它不关联电商演示表，当前电商重置函数不直接操作线索表和管理员白名单，修改重置逻辑时需要重新检查。管理员账号需在 Supabase Auth 创建并添加至 `lead_studio_admins`。

当前云端有两条明确标记的虚构测试需求。上线运营前需要配置真实联系方式和通知渠道，并根据使用场景完善反滥用、备份和隐私说明。平台规则与方案比较见 [调研记录](research.md)。
