// 检查 6.16 工作表前几行
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

  const range = 'ySlO2D!A1:C10';
  const resp = await axios.get(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SHEET_TOKEN}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const values = resp.data.data?.valueRange?.values || [];
  console.log(`6.16 工作表前 ${values.length} 行:`);
  values.forEach((row, i) => {
    console.log(`\n行 ${i + 1}:`);
    row.forEach((cell, j) => {
      const colName = ['A', 'B', 'C'][j];
      if (cell == null) {
        console.log(`  ${colName}: null`);
      } else if (typeof cell === 'object') {
        if (Array.isArray(cell)) {
          console.log(`  ${colName}: [array] ${JSON.stringify(cell).slice(0, 200)}`);
        } else {
          console.log(`  ${colName}: {object} type=${cell.type} fileToken=${cell.fileToken || 'N/A'}`);
        }
      } else {
        console.log(`  ${colName}: ${cell}`);
      }
    });
  });
}
main().catch(console.error);
