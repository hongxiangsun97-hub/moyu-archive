// 重新抓取所有工作表，正确处理富文本数组（修复 [object Object] 问题）
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

// 把单元格值转成纯文本
function cellToText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    // 富文本数组: [{text, type, segmentStyle}, ...]
    return v.map(p => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') return p.text || p.name || '';
      return '';
    }).join('');
  }
  if (typeof v === 'object') {
    // embed-image 或其他对象
    if (v.type === 'embed-image') return null; // 图片，不是文本
    return v.text || v.name || '';
  }
  return String(v);
}

async function main() {
  const tokenResp = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: APP_ID, app_secret: APP_SECRET
  });
  const token = tokenResp.data.tenant_access_token;

  // 读取现有的 records.json
  const data = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));

  // 找到需要重新抓取的工作表
  const sheetsToRefetch = new Set();
  for (const sheet of data) {
    for (const r of sheet.records) {
      if (r.content && r.content.includes('[object Object]')) {
        sheetsToRefetch.add(sheet.sheetId);
      }
    }
  }
  console.log(`需要重新抓取 ${sheetsToRefetch.size} 个工作表:`, [...sheetsToRefetch]);

  for (const sheetId of sheetsToRefetch) {
    const sheet = data.find(s => s.sheetId === sheetId);
    if (!sheet) continue;
    console.log(`\n重新抓取: ${sheet.sheetTitle}`);

    // 抓取整个工作表前 200 行 A:C 列
    const range = `${sheetId}!A1:C200`;
    const resp = await axios.get(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SHEET_TOKEN}/values/${range}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const values = resp.data.data?.valueRange?.values || [];
    console.log(`  获取到 ${values.length} 行`);

    // 重新构建记录（保留原有的图片信息）
    const oldRecordsByRow = {};
    for (const r of sheet.records) {
      oldRecordsByRow[r.rowIndex] = r;
    }

    const newRecords = [];
    for (let i = 2; i < values.length; i++) {
      const row = values[i] || [];
      const contentRaw = row[0];
      const time = row[1];
      const imgObj = row[2];

      // 跳过完全空行
      if (contentRaw == null && time == null && imgObj == null) continue;

      const content = cellToText(contentRaw) || '';
      // 如果内容是空字符串且没有图片，跳过
      if (!content && (!imgObj || imgObj.type !== 'embed-image')) continue;

      const oldRec = oldRecordsByRow[i];
      const record = {
        sheetTitle: sheet.sheetTitle,
        sheetId: sheet.sheetId,
        rowIndex: i,
        content: content,
        timeRaw: time,
        time: oldRec ? oldRec.time : '', // 复用之前的 time 转换
        image: oldRec ? oldRec.image : null  // 保留图片信息
      };

      newRecords.push(record);
      if (oldRec && content !== (oldRec.content || '')) {
        const oldSnippet = (oldRec.content || '').slice(0, 50);
        const newSnippet = content.slice(0, 80);
        console.log(`  ✏️ 行 ${i + 1}: "${oldSnippet}" -> "${newSnippet}"`);
      }
    }

    sheet.records = newRecords;
    console.log(`  ✅ 修复后记录数: ${newRecords.length}`);
  }

  // 保存
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('\n✅ 全部修复完成，已保存到 records.json');

  // 验证
  const verify = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
  let remaining = 0;
  for (const sheet of verify) {
    for (const r of sheet.records) {
      if (r.content && r.content.includes('[object Object]')) remaining++;
    }
  }
  console.log(`剩余 [object Object] 记录: ${remaining}`);
}

main().catch(e => {
  console.error('出错:', e.message);
  process.exit(1);
});
