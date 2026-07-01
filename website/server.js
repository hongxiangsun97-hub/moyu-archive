/**
 * 小雯上班摸鱼档案馆 - 服务器
 *
 * 功能:
 *  - 提供静态前端资源
 *  - 提供 /api/records 获取所有记录（原始 + 用户新增）
 *  - 提供 POST /api/records 新增记录（支持图片上传 + 写回飞书）
 *  - 提供 /api/stats 统计数据
 *  - 提供 /api/quotes 随机摸鱼语录
 *
 * 部署说明:
 *  - 本地: 数据存在 ../data/
 *  - 云端: 数据存在 ./data/（同目录），通过环境变量 DATA_DIR 覆盖
 *  - 持久化: 新增记录自动写回飞书表格（需配置 FEISHU_APP_SECRET）
 */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 路径配置（自适应本地/云端）============
// 本地: website/server.js → ../data/
// 云端: 仓库根部署 → ./data/
// 也可通过 DATA_DIR 环境变量强制指定
const ROOT = __dirname;
const POSSIBLE_DATA_DIRS = [
  process.env.DATA_DIR,
  path.join(ROOT, 'data'),       // 云端（data 在仓库根）
  path.join(ROOT, '..', 'data'), // 本地（data 在 website 上一级）
].filter(Boolean);

const DATA_DIR = POSSIBLE_DATA_DIRS.find(d => fs.existsSync(d)) || POSSIBLE_DATA_DIRS[POSSIBLE_DATA_DIRS.length - 1];
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const ORIGINAL_RECORDS = path.join(DATA_DIR, 'records.json');
const NEW_RECORDS_FILE = path.join(DATA_DIR, 'new-records.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

// 确保目录存在
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ============ 飞书 API 配置 ============
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_SHEET_TOKEN = process.env.FEISHU_SHEET_TOKEN || 'W4FCsff3Khj0cCtAAhyc1ynxnLb';
const FEISHU_ENABLED = !!(FEISHU_APP_ID && FEISHU_APP_SECRET);

// 中间件
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 静态资源
app.use(express.static(path.join(ROOT, 'public')));

// 图片懒加载：如果本地没有，从飞书下载并缓存
app.use('/images/:fileToken', async (req, res, next) => {
  const fileToken = req.params.fileToken.replace(/\.[^.]+$/, ''); // 去扩展名
  const localPath = path.join(IMAGES_DIR, fileToken + '.png');
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  // 本地没有，尝试从飞书下载
  if (FEISHU_ENABLED) {
    try {
      const axios = getFeishuAxios();
      const token = await getFeishuToken();
      const resp = await axios.get(
        `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' }
      );
      fs.writeFileSync(localPath, resp.data);
      return res.sendFile(localPath);
    } catch (e) {
      // 下载失败，返回占位图
    }
  }
  res.status(404).send('Image not found');
});

app.use('/uploads', express.static(UPLOADS_DIR));

// ============ 摸鱼语录库 ============
const MOYU_QUOTES = [
  '上班是不可能上班的，这辈子都不可能上班的',
  '今天不摸鱼，明天没鱼摸',
  '我不是在摸鱼，我是在进行深度思考',
  '工作使我快乐？不，是下班使我快乐',
  '摸鱼一时爽，一直摸鱼一直爽',
  '老板看不见就是没在摸鱼',
  '今日事今日毕？不，今日事明日再说',
  '我有一个梦想：上班只拿钱不干活',
  '工资可以少，摸鱼不能停',
  '今日摸鱼，明日成龙',
  '人在工位，心在远方',
  '我摸的不是鱼，是自由',
  '没有摸鱼的上班是不完整的',
  '生活不止眼前的苟且，还有工位上的摸鱼',
  '摸鱼是一门艺术，需要用心去感受',
  '上班摸鱼，下班躺平，人生赢家',
  '只要思想不滑坡，办法总比困难多——摸鱼的办法',
  '今日不摸鱼，如衣锦夜行',
  '摸鱼冠军，非我莫属',
  '上班如上坟，摸鱼如沐春',
  '一日摸鱼一日爽，天天摸鱼天天爽',
  '人生苦短，及时摸鱼',
  '我没摸鱼，我在帮老板省钱（电费）',
];

// ============ 工具函数 ============
function loadOriginalRecords() {
  if (!fs.existsSync(ORIGINAL_RECORDS)) return [];
  try {
    return JSON.parse(fs.readFileSync(ORIGINAL_RECORDS, 'utf-8'));
  } catch (e) {
    console.error('读取 records.json 失败:', e.message);
    return [];
  }
}

function loadNewRecords() {
  if (!fs.existsSync(NEW_RECORDS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(NEW_RECORDS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveNewRecords(records) {
  try {
    fs.writeFileSync(NEW_RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存 new-records.json 失败:', e.message);
  }
}

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function extractDate(title) {
  const m = title.match(/(\d{1,2})[.．](\d{1,2})/);
  if (!m) return null;
  return parseInt(m[1]) * 100 + parseInt(m[2]);
}

// ============ 飞书 API 工具函数 ============
let feishuAxios = null;
let feishuTokenCache = null;
let feishuTokenExpire = 0;

function getFeishuAxios() {
  if (!feishuAxios) {
    const axios = require('axios');
    feishuAxios = axios;
  }
  return feishuAxios;
}

async function getFeishuToken() {
  const now = Date.now();
  if (feishuTokenCache && now < feishuTokenExpire - 60000) {
    return feishuTokenCache;
  }
  const axios = getFeishuAxios();
  const resp = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: FEISHU_APP_ID,
    app_secret: FEISHU_APP_SECRET
  });
  feishuTokenCache = resp.data.tenant_access_token;
  feishuTokenExpire = now + (resp.data.expire || 7200) * 1000;
  return feishuTokenCache;
}

// 获取所有工作表（用于找日期对应 sheetId）
async function getFeishuSheets() {
  const axios = getFeishuAxios();
  const token = await getFeishuToken();
  const resp = await axios.get(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${FEISHU_SHEET_TOKEN}/sheets/query`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data.data.sheets || [];
}

// 向指定工作表追加一行记录
async function appendRecordToFeishu(sheetTitle, content, time, imageFileToken) {
  if (!FEISHU_ENABLED) return { ok: false, reason: 'feishu not configured' };

  try {
    const axios = getFeishuAxios();
    const token = await getFeishuToken();

    // 1. 找到对应日期的 sheet（标题匹配）
    const sheets = await getFeishuSheets();
    const targetSheet = sheets.find(s => s.title === sheetTitle);

    if (!targetSheet) {
      // 找不到对应 sheet，跳过飞书写入（仅本地保存）
      return { ok: false, reason: `sheet not found: ${sheetTitle}` };
    }

    const sheetId = targetSheet.sheet_id;

    // 2. 找到最后一行的位置
    const range = `${sheetId}!A1:C200`;
    const valuesResp = await axios.get(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${FEISHU_SHEET_TOKEN}/values/${range}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const values = valuesResp.data.data?.valueRange?.values || [];
    let lastRow = 1; // 第0行标题，第1行表头
    for (let i = 2; i < values.length; i++) {
      const row = values[i] || [];
      if (row[0] != null || row[1] != null || row[2] != null) {
        lastRow = i + 1;
      }
    }
    const nextRow = lastRow + 1;

    // 3. 把时间转成飞书格式（小数）
    let timeValue = '';
    if (time && /^\d{1,2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':').map(Number);
      timeValue = (h * 60 + m) / (24 * 60);
    }

    // 4. 构造单元格值
    const rowValues = [content, timeValue];
    if (imageFileToken) {
      rowValues.push({
        fileToken: imageFileToken,
        type: 'embed-image',
        width: 500,
        height: 300
      });
    }

    // 5. 追加到指定行
    const appendResp = await axios.put(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${FEISHU_SHEET_TOKEN}/values`,
      {
        valueRange: {
          range: `${sheetId}!A${nextRow}:C${nextRow}`,
          values: [rowValues]
        }
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { insertDataOption: 'OVERWRITE' }
      }
    );

    return { ok: appendResp.data.code === 0, raw: appendResp.data };
  } catch (e) {
    console.error('飞书写入失败:', e.response?.data || e.message);
    return { ok: false, reason: e.message };
  }
}

// 上传图片到飞书 Drive
async function uploadImageToFeishu(fileBuffer, fileName) {
  if (!FEISHU_ENABLED) return null;

  try {
    const axios = getFeishuAxios();
    const token = await getFeishuToken();
    const FormData = require('form-data');

    const form = new FormData();
    form.append('file_name', fileName);
    form.append('parent_type', 'sheet_image');
    form.append('parent_node', FEISHU_SHEET_TOKEN);
    form.append('size', String(fileBuffer.length));
    form.append('file', fileBuffer, { filename: fileName });

    const resp = await axios.post(
      'https://open.feishu.cn/open-apis/drive/v1/medias/upload_all',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      }
    );

    return resp.data.data?.file_token || null;
  } catch (e) {
    console.error('飞书图片上传失败:', e.response?.data || e.message);
    return null;
  }
}

// ============ Multer 配置 ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, genId('upload') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('只允许上传图片文件'));
  }
});

// ============ API ============

// 获取所有记录（原始 + 新增）
app.get('/api/records', (req, res) => {
  try {
    const original = loadOriginalRecords();
    const newRecs = loadNewRecords();

    const merged = JSON.parse(JSON.stringify(original));
    const newBySheet = {};
    for (const r of newRecs) {
      if (!newBySheet[r.sheetTitle]) newBySheet[r.sheetTitle] = [];
      newBySheet[r.sheetTitle].push(r);
    }
    for (const sheet of merged) {
      if (newBySheet[sheet.sheetTitle]) {
        sheet.records = sheet.records.concat(newBySheet[sheet.sheetTitle]);
        sheet.hasNewRecords = true;
      }
    }
    for (const title of Object.keys(newBySheet)) {
      if (!merged.find(s => s.sheetTitle === title)) {
        merged.push({
          sheetTitle: title,
          sheetId: 'user_created',
          sheetIndex: 999 + merged.length,
          records: newBySheet[title],
          isUserCreated: true
        });
      }
    }
    merged.sort((a, b) => {
      const da = extractDate(a.sheetTitle);
      const db = extractDate(b.sheetTitle);
      if (da && db) return da - db;
      return 0;
    });
    res.json({ ok: true, data: merged });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// 新增记录（本地 + 飞书双向同步）
app.post('/api/records', upload.single('image'), async (req, res) => {
  try {
    const { sheetTitle, content, time } = req.body;
    if (!sheetTitle || !content) {
      return res.status(400).json({ ok: false, msg: '日期和内容必填' });
    }

    const newRecs = loadNewRecords();
    const record = {
      id: genId('rec'),
      sheetTitle,
      content,
      time: time || '',
      timeRaw: null,
      image: null,
      createdAt: new Date().toISOString(),
      isUserAdded: true
    };

    // 本地保存图片
    if (req.file) {
      record.image = {
        fileToken: req.file.filename.replace(path.extname(req.file.filename), ''),
        fileName: req.file.filename,
        relPath: 'uploads/' + req.file.filename,
        width: null,
        height: null,
        originalLink: null,
        isUserUpload: true
      };
    }

    // 尝试写回飞书（如果配置了）
    let feishuResult = null;
    if (FEISHU_ENABLED) {
      // 1. 上传图片到飞书（如果有）
      let feishuFileToken = null;
      if (req.file) {
        const fileBuffer = fs.readFileSync(req.file.path);
        feishuFileToken = await uploadImageToFeishu(fileBuffer, req.file.filename);
      }
      // 2. 追加记录到飞书表格
      feishuResult = await appendRecordToFeishu(sheetTitle, content, time, feishuFileToken);
      record.feishuSynced = feishuResult.ok;
    } else {
      record.feishuSynced = false;
    }

    newRecs.push(record);
    saveNewRecords(newRecs);

    const msg = feishuResult?.ok
      ? '摸鱼记录已存档，并已同步到飞书表格！'
      : '摸鱼记录已存档（仅本地保存）';
    res.json({ ok: true, data: record, msg });
  } catch (e) {
    console.error('新增记录失败:', e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// 删除一条用户新增的记录
app.delete('/api/records/:id', (req, res) => {
  try {
    const { id } = req.params;
    let newRecs = loadNewRecords();
    const target = newRecs.find(r => r.id === id);
    if (!target) return res.status(404).json({ ok: false, msg: '记录不存在或非用户新增' });
    if (target.image && target.image.fileName) {
      const p = path.join(UPLOADS_DIR, target.image.fileName);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {}
      }
    }
    newRecs = newRecs.filter(r => r.id !== id);
    saveNewRecords(newRecs);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// 统计数据
app.get('/api/stats', (req, res) => {
  try {
    const original = loadOriginalRecords();
    const newRecs = loadNewRecords();
    let totalRecords = 0;
    let totalImages = 0;
    let days = original.length;
    let busiestDay = null;
    let busiestCount = 0;
    const contentFreq = {};

    for (const sheet of original) {
      totalRecords += sheet.records.length;
      if (sheet.records.length > busiestCount) {
        busiestCount = sheet.records.length;
        busiestDay = sheet.sheetTitle;
      }
      for (const r of sheet.records) {
        if (r.image) totalImages++;
        const c = (r.content || '').trim().split('\n')[0].slice(0, 20);
        if (c) contentFreq[c] = (contentFreq[c] || 0) + 1;
      }
    }
    totalRecords += newRecs.length;
    for (const r of newRecs) {
      if (r.image) totalImages++;
    }

    const topContents = Object.entries(contentFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    res.json({
      ok: true,
      data: {
        days,
        totalRecords,
        totalImages,
        newRecords: newRecs.length,
        busiestDay,
        busiestCount,
        topContents,
        feishuEnabled: FEISHU_ENABLED
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// 随机摸鱼语录
app.get('/api/quotes', (req, res) => {
  const q = MOYU_QUOTES[Math.floor(Math.random() * MOYU_QUOTES.length)];
  res.json({ ok: true, quote: q });
});

// 部署信息
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    feishuEnabled: FEISHU_ENABLED,
    dataDir: DATA_DIR
  });
});

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/images/') && !req.path.startsWith('/uploads/')) {
    const indexPath = path.join(ROOT, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

app.listen(PORT, () => {
  console.log(`🐟 小雯上班摸鱼档案馆运行中:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   数据目录: ${DATA_DIR}`);
  console.log(`   飞书同步: ${FEISHU_ENABLED ? '已启用' : '未启用'}`);
});
