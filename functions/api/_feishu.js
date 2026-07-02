// Cloudflare Pages Functions: 共享的飞书 API 工具（ES Modules）
// 与 Vercel 版的区别：
//   1. 用原生 fetch 替代 axios
//   2. 用 Web 标准 FormData + Blob 替代 form-data 包
//   3. 环境变量从 env 参数读取（Cloudflare 通过 context.env 注入），不用 process.env
//   4. export function 而非 module.exports

const DEFAULT_SHEET_TOKEN = 'W4FCsff3Khj0cCtAAhyc1ynxnLb';

function isFeishuEnabled(env) {
  return !!(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET);
}

function getSheetToken(env) {
  return env.FEISHU_SHEET_TOKEN || DEFAULT_SHEET_TOKEN;
}

// token 缓存（模块级，单个 Worker 实例内复用）
let tokenCache = null;
let tokenExpire = 0;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getToken(env) {
  if (!isFeishuEnabled(env)) throw new Error('FEISHU not configured');
  const now = Date.now();
  if (tokenCache && now < tokenExpire - 60000) return tokenCache;
  // 重试 3 次：飞书 API 从 Cloudflare 海外边缘节点访问时偶发失败
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET })
      });
      const data = await resp.json();
      if (data.tenant_access_token) {
        tokenCache = data.tenant_access_token;
        tokenExpire = now + (data.expire || 7200) * 1000;
        return tokenCache;
      }
      if (attempt < 3) { await sleep(400 * attempt); continue; }
      throw new Error('Failed to get feishu token: ' + JSON.stringify(data));
    } catch (e) {
      if (attempt < 3) { await sleep(400 * attempt); continue; }
      throw e;
    }
  }
}

async function getSheets(env) {
  const token = await getToken(env);
  const sheetToken = getSheetToken(env);
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetToken}/sheets/query`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  return data.data?.sheets || [];
}

async function appendRecordToFeishu(env, sheetTitle, content, time, imageFileToken) {
  if (!isFeishuEnabled(env)) return { ok: false };
  try {
    const token = await getToken(env);
    const sheetToken = getSheetToken(env);
    const sheets = await getSheets(env);
    const sheet = sheets.find(s => s.title === sheetTitle);
    if (!sheet) return { ok: false, reason: 'sheet not found' };

    const sheetId = sheet.sheet_id;
    const range = `${sheetId}!A1:C200`;
    const valuesResp = await fetch(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/values/${range}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const valuesData = await valuesResp.json();
    const values = valuesData.data?.valueRange?.values || [];
    let lastRow = 1;
    for (let i = 2; i < values.length; i++) {
      const row = values[i] || [];
      if (row[0] != null || row[1] != null || row[2] != null) lastRow = i + 1;
    }
    const nextRow = lastRow + 1;

    let timeValue = '';
    if (time && /^\d{1,2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':').map(Number);
      timeValue = (h * 60 + m) / (24 * 60);
    }

    const rowValues = [content, timeValue];
    if (imageFileToken) {
      rowValues.push({ fileToken: imageFileToken, type: 'embed-image', width: 500, height: 300 });
    }

    const appendResp = await fetch(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/values?insertDataOption=OVERWRITE`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ valueRange: { range: `${sheetId}!A${nextRow}:C${nextRow}`, values: [rowValues] } })
      }
    );
    const appendData = await appendResp.json();
    return { ok: appendData.code === 0 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 用 Web 标准 FormData 上传图片到飞书 Drive
async function uploadImageToFeishu(env, fileBuffer, fileName) {
  if (!isFeishuEnabled(env)) return null;
  try {
    const token = await getToken(env);
    const sheetToken = getSheetToken(env);
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('parent_type', 'sheet_image');
    form.append('parent_node', sheetToken);
    form.append('size', String(fileBuffer.byteLength));
    // fileBuffer 是 ArrayBuffer，包成 Blob 再附进 FormData
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    form.append('file', blob, fileName);
    const resp = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await resp.json();
    return data.data?.file_token || null;
  } catch (e) {
    return null;
  }
}

async function downloadImage(env, fileToken) {
  if (!isFeishuEnabled(env)) return null;
  // 重试 3 次，应对飞书 API 从海外边缘节点访问的间歇性失败
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const token = await getToken(env);
      const resp = await fetch(
        `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) return await resp.arrayBuffer();
      // 404 = fileToken 真失效，不重试
      if (resp.status === 404) return null;
      // 429/500/502/503 等间歇性错误，退避后重试
      if (attempt < 3) { await sleep(400 * attempt); continue; }
      return null;
    } catch (e) {
      // 网络错误，退避后重试
      if (attempt < 3) { await sleep(400 * attempt); continue; }
      return null;
    }
  }
  return null;
}

export {
  isFeishuEnabled,
  getSheetToken,
  getToken,
  getSheets,
  appendRecordToFeishu,
  uploadImageToFeishu,
  downloadImage,
};
