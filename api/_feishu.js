// Vercel Serverless: 共享的飞书 API 工具
// 所有 /api/*.js 都通过 require 引用这个文件

const axios = require('axios');
const FormData = require('form-data');

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_SHEET_TOKEN = process.env.FEISHU_SHEET_TOKEN || 'W4FCsff3Khj0cCtAAhyc1ynxnLb';
const FEISHU_ENABLED = !!(FEISHU_APP_ID && FEISHU_APP_SECRET);

let tokenCache = null;
let tokenExpire = 0;

async function getToken() {
  if (!FEISHU_ENABLED) throw new Error('FEISHU not configured');
  const now = Date.now();
  if (tokenCache && now < tokenExpire - 60000) return tokenCache;
  const resp = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET
  });
  tokenCache = resp.data.tenant_access_token;
  tokenExpire = now + (resp.data.expire || 7200) * 1000;
  return tokenCache;
}

async function getSheets() {
  const token = await getToken();
  const resp = await axios.get(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${FEISHU_SHEET_TOKEN}/sheets/query`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data.data.sheets || [];
}

async function appendRecordToFeishu(sheetTitle, content, time, imageFileToken) {
  if (!FEISHU_ENABLED) return { ok: false };
  try {
    const token = await getToken();
    const sheets = await getSheets();
    const sheet = sheets.find(s => s.title === sheetTitle);
    if (!sheet) return { ok: false, reason: 'sheet not found' };

    const sheetId = sheet.sheet_id;
    const range = `${sheetId}!A1:C200`;
    const valuesResp = await axios.get(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${FEISHU_SHEET_TOKEN}/values/${range}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const values = valuesResp.data.data?.valueRange?.values || [];
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

    const appendResp = await axios.put(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${FEISHU_SHEET_TOKEN}/values`,
      { valueRange: { range: `${sheetId}!A${nextRow}:C${nextRow}`, values: [rowValues] } },
      { headers: { Authorization: `Bearer ${token}` }, params: { insertDataOption: 'OVERWRITE' } }
    );
    return { ok: appendResp.data.code === 0 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function uploadImageToFeishu(fileBuffer, fileName) {
  if (!FEISHU_ENABLED) return null;
  try {
    const token = await getToken();
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('parent_type', 'sheet_image');
    form.append('parent_node', FEISHU_SHEET_TOKEN);
    form.append('size', String(fileBuffer.length));
    form.append('file', fileBuffer, { filename: fileName });
    const resp = await axios.post(
      'https://open.feishu.cn/open-apis/drive/v1/medias/upload_all',
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` } }
    );
    return resp.data.data?.file_token || null;
  } catch (e) {
    return null;
  }
}

async function downloadImage(fileToken) {
  if (!FEISHU_ENABLED) return null;
  try {
    const token = await getToken();
    const resp = await axios.get(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' }
    );
    return resp.data;
  } catch (e) {
    return null;
  }
}

module.exports = {
  FEISHU_ENABLED,
  FEISHU_SHEET_TOKEN,
  getToken,
  getSheets,
  appendRecordToFeishu,
  uploadImageToFeishu,
  downloadImage,
};
