// /api/records - GET 获取所有记录 / POST 新增记录
const fs = require('fs');
const path = require('path');
const { FEISHU_ENABLED, appendRecordToFeishu, uploadImageToFeishu } = require('./_feishu');

// 在 Vercel 上 data/records.json 作为静态资源部署，函数运行时只读
// 路径: Vercel 部署根目录的 data/records.json
const RECORDS_FILE = path.join(process.cwd(), 'data', 'records.json');

function loadOriginalRecords() {
  try {
    return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
  } catch (e) {
    console.error('读取 records.json 失败:', e.message);
    return [];
  }
}

function extractDate(title) {
  const m = String(title || '').match(/(\d{1,2})[.．](\d{1,2})/);
  if (!m) return null;
  return parseInt(m[1]) * 100 + parseInt(m[2]);
}

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: 返回所有原始记录（飞书同步的版本，从 records.json 读取）
  if (req.method === 'GET') {
    try {
      const original = loadOriginalRecords();
      // 因为 Vercel 文件系统只读，我们直接从飞书 API 拉取最新数据
      // 但为了性能优先返回静态 records.json 的内容
      return res.json({ ok: true, data: original, source: 'static' });
    } catch (e) {
      return res.status(500).json({ ok: false, msg: e.message });
    }
  }

  // POST: 新增记录（直接写飞书，不依赖本地 new-records.json）
  if (req.method === 'POST') {
    try {
      // Vercel Serverless Body Parser：如果 Content-Type 是 multipart/form-data，
      // 需要自己处理。Vercel 默认只解析 JSON 和 urlencoded。
      // 这里用 base64 编码的 JSON 来传图片（前端改造）
      const { sheetTitle, content, time, imageBase64, imageName } = req.body || {};

      if (!sheetTitle || !content) {
        return res.status(400).json({ ok: false, msg: '日期和内容必填' });
      }

      let feishuFileToken = null;
      if (imageBase64 && FEISHU_ENABLED) {
        const fileBuffer = Buffer.from(imageBase64, 'base64');
        const fileName = imageName || (genId('upload') + '.png');
        feishuFileToken = await uploadImageToFeishu(fileBuffer, fileName);
      }

      let feishuResult = null;
      if (FEISHU_ENABLED) {
        feishuResult = await appendRecordToFeishu(sheetTitle, content, time, feishuFileToken);
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
        : (FEISHU_ENABLED ? '飞书写入失败，记录已暂存' : '摸鱼记录已暂存（飞书未启用）');

      return res.json({ ok: true, data: record, msg });
    } catch (e) {
      console.error('新增记录失败:', e);
      return res.status(500).json({ ok: false, msg: e.message });
    }
  }

  // DELETE: 因为 Vercel 无持久化存储，删除只能删飞书表格里的
  // 简化处理：让用户去飞书表格里手动删除
  if (req.method === 'DELETE') {
    return res.json({
      ok: false,
      msg: 'Vercel 版本暂不支持网页删除，请到飞书表格手动删除'
    });
  }

  return res.status(405).json({ ok: false, msg: 'Method not allowed' });
};
