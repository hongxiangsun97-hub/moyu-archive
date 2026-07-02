// Cloudflare Pages Functions: /images/[fileToken]
// 前端访问 /images/xxx.png 时由此函数代理飞书图片下载（懒加载）。
// 飞书原 313 张图不打包进 public/，运行时按需拉取。

import { isFeishuEnabled, downloadImage } from '../api/_feishu.js';

export async function onRequestGet(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
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

  try {
    const buf = await downloadImage(context.env, cleanToken);
    if (!buf) {
      return new Response('Image not found', { status: 404, headers });
    }
    return new Response(buf, {
      status: 200,
      headers: { ...headers, 'Content-Type': 'image/png' },
    });
  } catch (e) {
    return new Response('Download failed', { status: 500, headers });
  }
}
