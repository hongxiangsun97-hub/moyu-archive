// /api/stats - 统计数据
const fs = require('fs');
const path = require('path');
const { FEISHU_ENABLED } = require('./_feishu');

const RECORDS_FILE = path.join(process.cwd(), 'data', 'records.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const original = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
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

    const topContents = Object.entries(contentFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return res.json({
      ok: true,
      data: {
        days,
        totalRecords,
        totalImages,
        newRecords: 0,
        busiestDay,
        busiestCount,
        topContents,
        feishuEnabled: FEISHU_ENABLED
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: e.message });
  }
};
