# 商品图片工作台

ERP 左侧「商品图片工作台」使用阿里云 Aidge VisionFlow，支持批量上传、图片链接、处理队列和原图结果对照。处理完成后转存到 Supabase `product-media`，可选取商品并应用为主图。商品编辑页也保留了单图处理入口，应用后需保存商品表单。

部署前执行已有数据库迁移，并部署 Edge Function：

```sh
supabase functions deploy vision-flow --no-verify-jwt --remote
```

在阿里云开通电商经营助手和对应能力，使用有 `aidge:VisionFlow` 和 `aidge:QueryAsyncTaskResult` 权限的 RAM AccessKey。使用者在页面输入自己的密钥与地域，密钥仅在当前页面内存中保留，随请求发送给 Edge Function，不写入数据库。不要使用主账号密钥。各处理能力由阿里云按调用计费。

输入图片需是阿里云可访问的公网地址，满足其尺寸、格式和大小限制。阿里云处理结果为临时链接，必须通过「应用为主图」转存。若上游图片站限制访问，需先将图片转存到可公开访问的存储。处理任务依赖当前页面轮询，离开页面将停止查询。

参考：[VisionFlow API](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-visionflow)、[异步查询](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-queryasynctaskresult)。
