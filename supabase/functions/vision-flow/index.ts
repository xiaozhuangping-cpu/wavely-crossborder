import { createClient } from 'npm:@supabase/supabase-js@2';
import AidgePackage, { VisionFlowRequest, QueryAsyncTaskResultRequest } from 'npm:@alicloud/aidge20260428@5.12.2';
import { $OpenApiUtil } from 'npm:@alicloud/openapi-core@1.0.9';
import { cors, json } from '../_shared/llm.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!user) return json({ error: '请先登录' }, 401);
  try {
    const body = await req.json();
    const { accessKeyId, accessKeySecret, action, region } = body;
    if (typeof accessKeyId !== 'string' || typeof accessKeySecret !== 'string' || !accessKeyId.trim() || !accessKeySecret.trim()) return json({ error: '请填写阿里云 AccessKey' }, 400);
    const endpoint = region === 'singapore' ? 'aidge.ap-southeast-1.aliyuncs.com' : 'aidge.cn-beijing.aliyuncs.com';
    const client = new AidgePackage.default(new $OpenApiUtil.Config({ accessKeyId: accessKeyId.trim(), accessKeySecret: accessKeySecret.trim(), endpoint }));
    if (action === 'save') {
      const u = new URL(body.resultUrl);
      if (!['https:', 'http:'].includes(u.protocol) || !/(^|\.)oss-[a-z0-9-]+\.aliyuncs\.com$/.test(u.hostname) || u.username || u.password) return json({ error: '无效的结果地址' }, 400);
      const image = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      const type = image.headers.get('content-type')?.split(';')[0] ?? '';
      if (!image.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('无法读取结果图片');
      const blob = await image.blob();
      if (blob.size > 20 * 1024 * 1024) throw new Error('结果图片超过 20 MB');
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[type];
      const path = `vision-flow/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from('product-media').upload(path, blob, { contentType: type });
      if (error) throw error;
      return json({ url: db.storage.from('product-media').getPublicUrl(path).data.publicUrl });
    }
    if (action === 'submit') {
      const p = body.params ?? {};
      const url = new URL(p.imageUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !Array.isArray(p.ability) || !p.ability.length || p.ability.some((n: unknown) => ![1, 2, 3, 4, 5, 6].includes(n as number))) return json({ error: '图片地址或处理能力无效' }, 400);
      const result = await client.visionFlow(new VisionFlowRequest(p));
      const data = result.body;
      if (!data?.success || !data.data?.taskId) throw new Error(data?.message || '提交任务失败');
      return json({ taskId: data.data.taskId });
    }
    if (action === 'query' && typeof body.taskId === 'string' && body.taskId.length < 200) {
      const response = await client.queryAsyncTaskResult(new QueryAsyncTaskResultRequest({ taskId: body.taskId }));
      const data = response.body;
      if (!data?.success || !data.data) throw new Error(data?.message || '查询任务失败');
      let result: any = data.data.result;
      if (typeof result === 'string') { try { result = JSON.parse(result); } catch { /* return error text */ } }
      return json({ status: data.data.status, result });
    }
    return json({ error: '无效操作' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || '请求失败').slice(0, 300) }, 502);
  }
});
