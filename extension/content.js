// Wavely 1688 采集助手：页面脚本
// - 列表页（搜索结果、店铺商品列表）：每个商品卡片左上角加勾选框，底部浮动栏批量采集
// - 详情页：右下角「采集到 Wavely」按钮
(() => {
  if (window.top !== window || window.__wavelyCollector) return;
  window.__wavelyCollector = true;

  const ERP = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/erp/#/import_drafts';
  const TEAL = '#0e7490';
  const isDetail = /^detail\.1688\.com$/.test(location.hostname) && /\/offer\/\d+\.html/.test(location.pathname);
  const send = (msg) => chrome.runtime.sendMessage(msg).catch((e) => ({ error: String(e.message || e) }));
  const offerIdOf = (href) => (String(href).match(/detail\.1688\.com\/offer\/(\d{6,20})\.html/) || [])[1];

  // ---------- 浮动面板（Shadow DOM，样式不受页面影响） ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483646;right:24px;bottom:24px;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial}
    .box{font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f1f1f;background:#fff;border-radius:16px;
      box-shadow:0 4px 24px rgba(0,0,0,.18);padding:12px 14px;min-width:260px;max-width:340px}
    .head{display:flex;align-items:center;gap:8px;font-weight:600}
    .logo{width:20px;height:20px;border-radius:6px;background:${TEAL};display:grid;place-items:center}
    .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    button{font:inherit;border:1px solid #d0d7de;background:#fff;color:#1f1f1f;border-radius:999px;padding:5px 12px;cursor:pointer}
    button:hover{background:#f3f6f8}
    button.primary{background:${TEAL};border-color:${TEAL};color:#fff;font-weight:600}
    button.primary:hover{background:#0b5f75}
    button:disabled{opacity:.5;cursor:default}
    .msg{margin-top:8px;color:#555;font-size:12px;word-break:break-all}
    .err{color:#c62828}
    a{color:${TEAL}}
    .bar{height:4px;background:#e6eef1;border-radius:2px;margin-top:8px;overflow:hidden}
    .bar i{display:block;height:100%;background:${TEAL};transition:width .3s}
    .x{margin-left:auto;border:0;padding:0 4px;color:#888;background:none}
    .opt{display:flex;align-items:center;gap:6px;margin-top:8px;color:#555;font-size:12px}
    select{font:inherit;border:1px solid #d0d7de;border-radius:6px;padding:1px 4px;background:#fff}
  </style>
  <div class="box">
    <div class="head"><span class="logo"><svg width="14" height="14" viewBox="0 0 64 64"><path d="M6 38c8-12 16-12 26 0s18 12 26 0" stroke="#c2e7ff" stroke-width="9" fill="none" stroke-linecap="round"/></svg></span>
      <span class="title">Wavely 采集</span><button class="x" title="收起">–</button></div>
    <div class="body"></div>
  </div>`;
  const $body = root.querySelector('.body');
  const $title = root.querySelector('.title');
  let collapsed = false;
  root.querySelector('.x').onclick = () => { collapsed = !collapsed; $body.style.display = collapsed ? 'none' : ''; root.querySelector('.x').textContent = collapsed ? '+' : '–'; };
  const mount = () => { if (!host.isConnected) document.documentElement.appendChild(host); };

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const erpLink = `<a href="${ERP}" target="_blank" rel="noopener">打开 ERP 采集箱 ↗</a>`;

  // ---------- 详情页 ----------
  if (isDetail) {
    $body.innerHTML = `<div class="row"><button class="primary go">采集此商品</button></div><div class="msg"></div>`;
    const $go = $body.querySelector('.go'), $msg = $body.querySelector('.msg');
    $go.onclick = async () => {
      $go.disabled = true; $msg.className = 'msg'; $msg.textContent = '正在读取商品数据…';
      const r = await send({ type: 'collectThis' });
      $go.disabled = false;
      if (r?.error) { $msg.className = 'msg err'; $msg.textContent = r.error; return; }
      $go.textContent = '重新采集';
      $msg.innerHTML = `✓ 已存入采集箱（${r.skuCount} 个规格）${r.status === 'imported' ? '，该商品此前已导入 ERP' : ''}<br>${erpLink}`;
    };
    mount();
    return;
  }

  // ---------- 列表页：勾选 ----------
  const KEY = 'wavely.selected';
  const load = () => { try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]')); } catch { return new Set(); } };
  const selected = load();
  const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify([...selected])); } catch { /* 忽略 */ } };
  const boxes = new Map();   // offerId -> [checkbox 元素]

  const paint = (el, on) => {
    el.style.background = on ? TEAL : 'rgba(255,255,255,.92)';
    el.style.borderColor = on ? TEAL : '#9aa7b0';
    el.innerHTML = on ? '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
    el.closest('[data-wavely-card]')?.style.setProperty('outline', on ? `2px solid ${TEAL}` : 'none');
  };
  const toggle = (id, on = !selected.has(id)) => {
    on ? selected.add(id) : selected.delete(id);
    (boxes.get(id) || []).forEach((b) => paint(b, on));
    persist(); render();
  };

  // 卡片 = 指向详情页、且包含较大商品图的链接（类名是随机后缀，不依赖类名）
  const scan = () => {
    document.querySelectorAll('a[href*="detail.1688.com/offer/"]:not([data-wavely-card])').forEach((a) => {
      const id = offerIdOf(a.href);
      const img = a.querySelector('img');
      if (!id || !img) return;
      const rect = img.getBoundingClientRect();
      if (rect.width && rect.width < 80) return;          // 跳过小图标、店铺 Logo
      a.setAttribute('data-wavely-card', id);
      if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
      a.style.outlineOffset = '-2px'; a.style.borderRadius = a.style.borderRadius || '8px';
      const cb = document.createElement('span');
      cb.setAttribute('role', 'checkbox'); cb.title = '勾选后批量采集到 Wavely';
      cb.style.cssText = 'position:absolute;left:8px;top:8px;z-index:20;width:22px;height:22px;border-radius:6px;border:2px solid #9aa7b0;' +
        'display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.25);box-sizing:border-box';
      const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
      cb.addEventListener('click', (e) => { stop(e); toggle(id); }, true);
      ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((t) => cb.addEventListener(t, (e) => e.stopPropagation(), true));
      a.appendChild(cb);
      boxes.set(id, [...(boxes.get(id) || []), cb]);
      paint(cb, selected.has(id));
    });
    if (boxes.size || selected.size) { mount(); render(); }
  };
  const pageIds = () => [...boxes.keys()];

  // ---------- 列表页：浮动栏与进度 ----------
  let queue = null;   // 后台推送的采集进度
  let delaySec = 1;
  const DELAYS = [0, 0.5, 1, 2, 3, 5, 10];
  send({ type: 'status' }).then((r) => { if (r?.delaySec != null) { delaySec = r.delaySec; render(); } });
  function render() {
    const total = queue?.items?.length || 0;
    const done = queue?.items?.filter((x) => x.status === 'done').length || 0;
    const failed = queue?.items?.filter((x) => x.status === 'error') || [];
    const pending = queue?.items?.filter((x) => x.status === 'pending' || x.status === 'running').length || 0;
    $title.textContent = `Wavely 采集 · 已选 ${selected.size}`;

    if (queue && (queue.running || queue.paused || pending)) {
      $body.innerHTML = `
        <div class="bar"><i style="width:${total ? Math.round(((done + failed.length) / total) * 100) : 0}%"></i></div>
        <div class="msg">${queue.paused
          ? '<b>1688 需要登录或安全验证。</b>请在已打开的页面里手动完成，然后点「继续」。'
          : `正在采集 ${done + failed.length + 1}/${total}，每个商品间隔约 ${delaySec} 秒…`}</div>
        <div class="row">${queue.paused ? '<button class="primary resume">继续</button>' : ''}<button class="cancel">停止</button></div>`;
      $body.querySelector('.resume')?.addEventListener('click', () => send({ type: 'resume' }));
      $body.querySelector('.cancel').onclick = () => send({ type: 'cancel' });
      return;
    }
    const result = queue && total ? `<div class="msg">✓ 采集完成 ${done} 个${failed.length ? `，<span class="err">失败 ${failed.length} 个</span>` : ''}。${erpLink}
      ${failed.slice(0, 3).map((f) => `<br><span class="err">${esc(f.offerId)}：${esc(f.msg)}</span>`).join('')}</div>` : '';
    $body.innerHTML = `
      <div class="row">
        <button class="all">全选本页（${pageIds().length}）</button>
        <button class="clear" ${selected.size ? '' : 'disabled'}>清空</button>
        <button class="primary go" ${selected.size ? '' : 'disabled'}>采集 ${selected.size || ''} 个</button>
      </div>
      <div class="opt">每个商品间隔
        <select class="delay">${[...new Set([...DELAYS, delaySec])].sort((a, b) => a - b).map((s) => `<option value="${s}" ${s === delaySec ? 'selected' : ''}>${s} 秒</option>`).join('')}</select>
        <span>间隔太短更容易触发 1688 验证</span></div>
      ${result || '<div class="msg">勾选商品卡片左上角的方框，可跨页累计（最多 100 个）。</div>'}`;
    $body.querySelector('.delay').onchange = async (e) => { const r = await send({ type: 'setDelay', delaySec: Number(e.target.value) }); if (r?.ok) delaySec = r.delaySec; };
    $body.querySelector('.all').onclick = () => pageIds().forEach((id) => toggle(id, true));
    $body.querySelector('.clear').onclick = () => [...selected].forEach((id) => toggle(id, false));
    $body.querySelector('.go').onclick = async () => {
      const ids = [...selected].slice(0, 100);
      const r = await send({ type: 'collectList', ids });
      if (r?.error) { alertMsg(r.error); return; }
      ids.forEach((id) => toggle(id, false));
    };
  }
  const alertMsg = (text) => { const m = document.createElement('div'); m.className = 'msg err'; m.textContent = text; $body.appendChild(m); };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'progress') { queue = msg.state; mount(); render(); }
  });
  send({ type: 'getState' }).then((r) => { if (r?.state) { queue = r.state; render(); } });

  scan();
  // 搜索结果是懒加载 / 无限滚动，持续识别新出现的卡片
  let t;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 300); }).observe(document.body, { childList: true, subtree: true });
})();
