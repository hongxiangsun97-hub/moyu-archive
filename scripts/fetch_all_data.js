// 抓取所有小雯上班记录的数据 + 下载所有图片
// 用法: node run.js fetch_all_data.js
// 依赖环境变量: FEISHU_APP_ID / FEISHU_APP_SECRET
// 也可读取同目录 .env 文件（需先 npm install dotenv，可选）
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 加载 .env（如果存在）
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

const APP_ID = process.env.FEISHU_APP_ID || 'cli_aa8c2eb2857bdbdd';
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const SHEET_TOKEN = process.env.FEISHU_SHEET_TOKEN || 'W4FCsff3Khj0cCtAAhyc1ynxnLb';

if (!APP_SECRET) {
  console.error('❌ 缺少环境变量 FEISHU_APP_SECRET，请在 .env 或环境变量中配置');
  process.exit(1);
}

// 输出目录
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

async function getAccessToken() {
  const resp = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: APP_ID, app_secret: APP_SECRET
  });
  return resp.data.tenant_access_token;
}

// 把小数时间转成 HH:MM
function decimalToTime(dec) {
  if (dec == null || typeof dec !== 'number') return String(dec ?? '');
  const totalMinutes = Math.round(dec * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

async function getAllSheets(token) {
  const resp = await axios.get(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${SHEET_TOKEN}/sheets/query`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return resp.data.data.sheets;
}

async function getSheetValues(token, sheetId, maxRow = 200) {
  const range = `${sheetId}!A1:T${maxRow}`;
  const resp = await axios.get(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SHEET_TOKEN}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return resp.data.data.valueRange.values || [];
}

async function downloadImage(token, fileToken, destPath) {
  if (fs.existsSync(destPath)) {
    // 已存在则跳过
    return 'skip';
  }
  // 使用 Drive 媒体下载接口
  try {
    const resp = await axios.get(`https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    fs.writeFileSync(destPath, resp.data);
    return 'ok';
  } catch (e) {
    console.log(`  ⚠️ 下载失败 ${fileToken}: ${e.response?.data?.msg || e.message}`);
    // 尝试备用方式：直接拿 link（需要 cookie，可能不可用）
    return 'fail';
  }
}

async function main() {
  console.log('🚀 开始抓取小雯上班记录...\n');
  const token = await getAccessToken();
  console.log('✅ Token 获取成功\n');

  const sheets = await getAllSheets(token);
  console.log(`📋 共找到 ${sheets.length} 个工作表:\n`);
  sheets.forEach((s, i) => console.log(`  ${i + 1}. ${s.title} (id=${s.sheet_id})`));
  console.log('');

  const allRecords = [];
  const imageList = []; // {fileToken, destPath, sheetTitle}

  for (const sheet of sheets) {
    console.log(`\n📂 处理: ${sheet.title}`);
    const values = await getSheetValues(token, sheet.sheet_id);
    if (!values || values.length === 0) {
      console.log('  ⚠️ 无数据');
      continue;
    }

    // 第0行: 标题（A1合并）
    // 第1行: 表头 内容/时间/截图
    // 第2行+: 数据
    const titleRow = values[0] || [];
    const headerRow = values[1] || [];
    const sheetTitle = titleRow[0] || sheet.title;

    const records = [];
    for (let i = 2; i < values.length; i++) {
      const row = values[i] || [];
      const content = row[0];
      const time = row[1];
      const imgObj = row[2];

      // 跳过完全空行
      if (content == null && time == null && imgObj == null) continue;
      // 也跳过内容/截图都为空的行
      if ((content == null || content === '') && (!imgObj || imgObj.type !== 'embed-image')) continue;

      const record = {
        sheetTitle,
        sheetId: sheet.sheet_id,
        rowIndex: i,
        content: content == null ? '' : String(content),
        timeRaw: time,
        time: decimalToTime(time),
        image: null
      };

      if (imgObj && imgObj.type === 'embed-image' && imgObj.fileToken) {
        const ext = '.png'; // 默认png，下载后再检测
        const imgFileName = imgObj.fileToken + ext;
        const imgRelPath = `images/${imgFileName}`;
        const destPath = path.join(IMAGES_DIR, imgFileName);
        record.image = {
          fileToken: imgObj.fileToken,
          fileName: imgFileName,
          relPath: imgRelPath,
          width: imgObj.width,
          height: imgObj.height,
          originalLink: imgObj.link
        };
        imageList.push({ fileToken: imgObj.fileToken, destPath, sheetTitle });
      }

      records.push(record);
    }

    console.log(`  ✅ 抓取到 ${records.length} 条记录`);
    allRecords.push({
      sheetTitle,
      sheetId: sheet.sheet_id,
      sheetIndex: sheet.index,
      records
    });
  }

  // 保存记录JSON
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(allRecords, null, 2), 'utf-8');
  console.log(`\n💾 记录已保存: ${RECORDS_FILE}`);
  console.log(`📊 共 ${allRecords.length} 个工作表, ${allRecords.reduce((s, x) => s + x.records.length, 0)} 条记录`);
  console.log(`🖼️  共 ${imageList.length} 张图片待下载\n`);

  // 下载图片
  console.log('⬇️  开始下载图片...\n');
  let okCount = 0, skipCount = 0, failCount = 0;
  for (let i = 0; i < imageList.length; i++) {
    const img = imageList[i];
    process.stdout.write(`  [${i + 1}/${imageList.length}] ${img.fileToken} ... `);
    const result = await downloadImage(token, img.fileToken, img.destPath);
    if (result === 'ok') { okCount++; console.log('✅'); }
    else if (result === 'skip') { skipCount++; console.log('⏭️  已存在'); }
    else { failCount++; console.log('❌'); }
    // 避免限流
    if ((i + 1) % 10 === 0) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 下载结果: ✅ ${okCount} 新下载, ⏭️  ${skipCount} 已存在, ❌ ${failCount} 失败`);
  console.log(`\n🎉 全部完成!`);
}

main().catch(e => {
  console.error('💥 出错了:', e.message);
  process.exit(1);
});
