// 启动器：把 feishu-docs skill 的 node_modules 加入 NODE_PATH
const path = require('path');
const feishuNodeModules = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.workbuddy', 'skills', 'feishu-docs', 'node_modules'
);
process.env.NODE_PATH = feishuNodeModules;
require('module').Module._initPaths();

const target = process.argv[2];
if (!target) {
  console.error('Usage: node run.js <script.js> [args...]');
  process.exit(1);
}
require(path.resolve(__dirname, target));
