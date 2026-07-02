// /api/images/[fileToken] - 图片代理：从飞书下载图片
const { FEISHU_ENABLED, downloadImage } = require('../_feishu');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

  // Vercel dynamic route: req.query.fileToken
  const fileToken = req.query.fileToken || (req.url.split('/').pop() || '').replace(/\.[^.]+$/, '');

  if (!fileToken) return res.status(400).send('Missing fileToken');
  if (!FEISHU_ENABLED) return res.status(503).send('Feishu not configured');

  try {
    const buf = await downloadImage(fileToken);
    if (!buf) return res.status(404).send('Image not found');
    res.setHeader('Content-Type', 'image/png');
    return res.end(buf);
  } catch (e) {
    return res.status(500).send('Download failed');
  }
};
