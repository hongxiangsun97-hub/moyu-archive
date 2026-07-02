// /api/health - 健康检查
const { FEISHU_ENABLED } = require('./_feishu');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true,
    time: new Date().toISOString(),
    feishuEnabled: FEISHU_ENABLED,
    platform: 'vercel'
  });
};
