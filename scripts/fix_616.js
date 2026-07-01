// 下载 6.16 工作表缺失的图片，并恢复记录
const path = require('path');
const fs = require('fs');
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

if (!APP_SECRET) {
  console.error('❌ 缺少环境变量 FEISHU_APP_SECRET');
  process.exit(1);
}

const RECORDS_FILE = path.resolve(__dirname, '..', 'data', 'records.json');
const IMAGES_DIR = path.resolve(__dirname, '..', 'data', 'images');

async function main() {
  const tokenResp = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: APP_ID, app_secret: APP_SECRET
  });
  const token = tokenResp.data.tenant_access_token;

  const fileToken = 'SNaBb3Wcpork4txlGQOcdXqon8R';
  const imgPath = path.join(IMAGES_DIR, fileToken + '.png');

  console.log('下载图片:', fileToken);
  const resp = await axios.get(`https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer'
  });
  fs.writeFileSync(imgPath, resp.data);
  console.log('✅ 已下载:', imgPath);

  // 添加记录到 6.16 工作表
  const data = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
  const sheet616 = data.find(s => s.sheetTitle.includes('6.16'));
  if (!sheet616) {
    console.log('找不到 6.16 工作表');
    return;
  }

  sheet616.records.push({
    sheetTitle: sheet616.sheetTitle,
    sheetId: sheet616.sheetId,
    rowIndex: 2,
    content: '下班图鉴（直接放图版）',
    timeRaw: null,
    time: '',
    image: {
      fileToken: fileToken,
      fileName: fileToken + '.png',
      relPath: 'images/' + fileToken + '.png',
      width: null,
      height: null,
      originalLink: null
    }
  });

  fs.writeFileSync(RECORDS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ 6.16 工作表记录已恢复，共', sheet616.records.length, '条');
}

main().catch(e => {
  console.error('出错:', e.message);
  process.exit(1);
});
