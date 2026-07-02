// Cloudflare Pages Functions: /images/[fileToken]
// 前端访问 /images/xxx.png 时由此函数代理飞书图片下载（懒加载）。
// 飞书原 313 张图不打包进 public/，运行时按需拉取。

import { isFeishuEnabled, downloadImage } from '../api/_feishu.js';

export async function onRequestGet(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    // 图片内容稳定，用长缓存避免重复回源飞书
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  };

  const raw = context.params.fileToken || '';
  const fileToken = Array.isArray(raw) ? raw[0] : raw;
  const cleanToken = fileToken.replace(/\.[^.]+$/, '');

  if (!cleanToken) {
    return new Response('Missing fileToken', { status: 400, headers });
  }
  if (!isFeishuEnabled(context.env)) {
    return new Response('Feishu not configured', { status: 503, headers });
  }

  // downloadImage 内部已含 3 次重试逻辑
  const buf = await downloadImage(context.env, cleanToken);
  if (!buf) {
    // 返回 502 而非 404：区分"真失效"和"飞书间歇性失败"，
    // 让前端 handleImgError 知道该重试
    return new Response('Image fetch failed (feishu API)', {
      status: 502,
      headers: { ...headers, 'Content-Type': 'text/plain' },
    });
  }
  return new Response(buf, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'image/png' },
  });
}
