// 调试：打印 5.29 工作表第43行的完整 API 响应
const path = require('path');
process.env.NODE_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.workbuddy', 'skills', 'feishu-docs', 'node_modules'
);
require('module').Module._initPaths();

const axios = require('axios');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}
const APP_ID = process.env.FEISHU_APP_ID || 'cli_aa8c2eb2857bdbdd';
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const SHEET_TOKEN = process.env.FEISHU_SHEET_TOKEN || 'W4FCsff3Khj0cCtAAhyc1ynxnLb';

if (!APP_SECRET) { console.error('❌ 缺少 FEISHU_APP_SECRET'); process.exit(1); }

async function main() {
  const tokenResp = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: APP_ID, app_secret: APP_SECRET
  });
  const token = tokenResp.data.tenant_access_token;

  // 读取 5.29 工作表 41-44 行的 A-C 列
  const sheetId = 'nO2Ljq';
  const range = `${sheetId}!A41:C44`;
  console.log('Range:', range);
  const resp = await axios.get(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SHEET_TOKEN}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Full response:', JSON.stringify(resp.data, null, 2));
}
main().catch(console.error);
