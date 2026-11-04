# 参与贡献

欢迎提 Issue 和 Pull Request！这是一个跨境电商全链路的演示项目，也欢迎直接 Fork 改造成你自己的系统。

## 开发环境

| 模块 | 命令 |
|---|---|
| ERP | `cd erp && npm install && npm run dev`（同时打包插件 zip） |
| 独立站 | `cd shop && npm install && npm run dev` |
| 仓库 App | `cd app && flutter pub get && flutter run -d chrome` |
| 采集插件 | Chrome「扩展程序 → 开发者模式 → 加载已解压的扩展程序」选择 `extension/` |
| 数据库测试 | `DATABASE_URL=postgres://postgres@127.0.0.1:5432/空测试库 ./supabase/tests/run.sh` |

前端默认连接线上演示后端（publishable key 本就公开，数据安全由 RLS 控制），改数据库请用自己的 Supabase 项目，见 README「自部署」。

## 约定

- **业务规则写在数据库函数里**（下单、采集、采购、审批、发货……），前端只调 `rpc`。改业务逻辑 = 新增迁移 `supabase/migrations/YYYYMMDDHHMMSS_xxx.sql` + 在 `supabase/tests/` 加测试；不要修改已发布的迁移
- 新表一律开启 RLS；关键写操作走 `security definer` 函数并在开头 `require_role(...)`
- 重新定义已有函数时，从**最新一版迁移**复制完整函数体再改
- 列表页用 `erp/src/grid/AgList.jsx`，列定义放在模块级保持引用稳定
- `erp/src/ai/llmConfig.jsx` 与 `shop/src/components/llmConfig.jsx` 是副本，需同步修改
- 采集插件版本号需与 `erp/src/collect/extension.js` 的 `EXTENSION_LATEST` 一致（构建时校验）
- 提交说明用中文，格式 `type(scope): 摘要`，如 `feat(app): 支持批量收货`

## 提交 PR 前

- [ ] `./supabase/tests/run.sh` 全部通过（改了数据库时）
- [ ] `cd erp && npm run build`、`cd shop && npx vite build` 通过（改了前端时）
- [ ] `cd app && flutter analyze && flutter test` 通过（改了 App 时）
- [ ] 新功能在 README 对应章节补充说明

CI 会在 PR 合并到 `main` 后先跑数据库测试与 App 测试，通过才发布。
