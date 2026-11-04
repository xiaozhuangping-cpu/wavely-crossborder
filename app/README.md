# Wavely 仓库助手（Flutter）

与 Wavely 跨境 ERP 共用同一个 Supabase 后端的移动端 App：**扫码收货入库、拣货发货、库存查询**，操作结果实时同步到 ERP。

- 网页版：https://xiaozhuangping-cpu.github.io/wavely-crossborder/app/
- 安卓安装包：https://github.com/xiaozhuangping-cpu/wavely-crossborder/releases/download/app-latest/wavely-warehouse.apk

| 功能 | 说明 |
|---|---|
| 首页 | 待收货采购单、待发货订单、低库存仓位、补货建议数量，点击直达 |
| 收货入库 | 扫码枪（键盘输入 + 回车）/ 相机扫码 / 「模拟扫码」逐件累加，确认后调用 `receive_purchase_order` 入库 |
| 拣货发货 | 逐件扫码核对，扫错件会提示；拣齐后调用 `ship_order` 生成运单号，ERP 中订单变为已发货 |
| 库存查询 | 按商品名、SKU、条码查询各仓库存，默认列出低于安全库存的仓位 |

扫码同时匹配 EAN-13 条码与 SKU 编码（1688 导入的商品没有条码）。访客匿名登录，权限由 Supabase RLS 控制。

## 开发

```bash
flutter pub get
flutter run -d chrome            # 网页调试
flutter test                     # 单元测试
flutter build web --release --base-href /wavely-crossborder/app/ --no-web-resources-cdn
flutter build apk --release      # 需要 Android SDK；CI 里自动打包
```

推送 `main` 后：网页版随 GitHub Pages 发布；`app/` 有改动时另一个工作流打包 APK 并更新 Release「app-latest」。演示包使用调试签名。
