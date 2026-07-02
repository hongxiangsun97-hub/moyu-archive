// Cloudflare Pages Functions: /api/records
// GET  -> 返回静态 records.json（前端也可直接 fetch /records.json，此接口保留兼容）
// POST -> 新增记录：上传图片到飞书 + 追加行到飞书表格
//
// Pages Functions 签名：export async function onRequestGet(context)
//   context = { request, env, params, waitUntil, next, data }
//   环境变量从 context.env 读取

import { isFeishuEnabled, appendRecordToFeishu, uploadImageToFeishu } from './_feishu.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// GET: 返回静态 records.json 内容
// Pages Functions 中静态资源可以直接由前端 fetch /records.json 拿到，
// 但保留此接口用于旧客户端兼容。直接用 fetch 读取同站静态文件。
export async function onRequestGet(context) {
  try {
    // 读取同站静态 records.json
    const base = new URL(context.request.url).origin;
    const resp = await fetch(base + '/records.json');
    if (!resp.ok) {
      return json({ ok: false, msg: 'records.json 不可读: ' + resp.status }, 500);
    }
    const data = await resp.json();
    return json({ ok: true, data, source: 'static' });
  } catch (e) {
    return json({ ok: false, msg: e.message }, 500);
  }
}

// OPTIONS: CORS 预检
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// POST: 新增记录（JSON + base64 图片）
export async function onRequestPost(context) {
  try {
    const { sheetTitle, content, time, imageBase64, imageName } = await context.request.json();

    if (!sheetTitle || !content) {
      return json({ ok: false, msg: '日期和内容必填' }, 400);
    }

    const enabled = isFeishuEnabled(context.env);
    let feishuFileToken = null;
    if (imageBase64 && enabled) {
      // base64 -> ArrayBuffer
      const binStr = atob(imageBase64);
      const buf = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) buf[i] = binStr.charCodeAt(i);
      const fileName = imageName || (genId('upload') + '.png');
      feishuFileToken = await uploadImageToFeishu(context.env, buf.buffer, fileName);
    }

    let feishuResult = null;
    if (enabled) {
      feishuResult = await appendRecordToFeishu(context.env, sheetTitle, content, time, feishuFileToken);
    }

    const record = {
      id: genId('rec'),
      sheetTitle,
      content,
      time: time || '',
      image: feishuFileToken ? {
        fileToken: feishuFileToken,
        fileName: feishuFileToken + '.png',
        isUserUpload: true
      } : null,
      createdAt: new Date().toISOString(),
      isUserAdded: true,
      feishuSynced: feishuResult?.ok || false
    };

    const msg = feishuResult?.ok
      ? '摸鱼记录已存档，并已同步到飞书表格！'
      : (enabled ? '飞书写入失败，记录已暂存' : '摸鱼记录已暂存（飞书未启用）');

    return json({ ok: true, data: record, msg });
  } catch (e) {
    return json({ ok: false, msg: e.message }, 500);
  }
}
