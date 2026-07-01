# 🐟 小雯上班摸鱼档案馆

> 所谓上班，不过是在工位上研究人类行为学、社会学、玄学与厨艺的综合场所

将飞书文档「没什么卵用的表格」中的小雯上班摸鱼记录，通过网页形式可以浏览（截图与表格一一对应），并支持直接在网页上新增摸鱼记录。整体气质：**网络乐子人专属**。

## 🚀 快速开始

### 环境要求
- Node.js 18+（推荐 22.x）

### 启动网站

```bash
cd website
npm install        # 首次启动需要
node server.js
```

浏览器访问：**http://localhost:3000**

## 📁 项目结构

```
2026-07-01-14-45-32/
├── data/                          # 数据目录
│   ├── records.json               # 飞书抓取的原始记录（12 天 / 316 条）
│   ├── new-records.json           # 网页新增的记录（运行时生成）
│   └── images/                    # 所有截图（313 张 PNG）
├── scripts/                       # 数据抓取/维护脚本
│   ├── run.js                     # 启动器（注入 feishu-docs 依赖路径）
│   ├── fetch_all_data.js          # 全量抓取飞书数据 + 下载图片
│   ├── fix_object_records.js      # 修复富文本单元格
│   ├── fix_616.js                 # 修复 6.16 工作表
│   ├── check_cell.js              # 调试单元格
│   ├── check_616.js               # 调试 6.16 工作表
│   └── debug_cell.js              # 调试单单元格
├── website/                       # 网站主体
│   ├── server.js                  # Express 后端（API + 静态资源）
│   ├── package.json
│   ├── public/                    # 前端资源
│   │   ├── index.html             # 主页面
│   │   ├── styles.css             # 全套样式（含暗黑模式）
│   │   └── app.js                 # 前端交互逻辑
│   └── uploads/                   # 用户上传的图片（运行时生成）
└── README.md                      # 本文件
```

## ✨ 功能特性

### 浏览功能
- **📅 12 天摸鱼档案**：5.12 / 5.13 / 5.14 / 5.15 / 5.19 / 5.25 / 5.26（今日说法专场）/ 5.29 / 6.9 / 6.15 / 6.16 / 6.22
- **🗂️ 316 条记录 + 313 张截图**：每条记录的截图都与表格内容一一对应，绝不糊弄
- **🔍 搜索功能**：按内容/时间搜索摸鱼记录（偷菜、刷剧、吃瓜...）
- **🎴 卡片 / 📋 表格 双视图**：随时切换浏览方式
- **🖼️ 图片灯箱**：点击截图查看大图

### 新增功能（核心需求）
- **✍️ 网页直接新增记录**：填表 + 上传截图即可，无需打开飞书
- **📅 支持新增到已有日期或新建日期**
- **🗑️ 可删除自己新增的记录**（原始飞书记录不可删）
- **🎉 提交后撒花 + 弹幕庆祝**

### 网络乐子人气氛
- 🎨 摸鱼绿 + 八卦粉 + 吃瓜黄 主色调
- 🐟 背景游动的鱼（6 条）
- 📜 顶部彩虹跑马灯（8 条摸鱼箴言循环）
- 💬 弹幕系统（每 4-7 秒自动飘过一条）
- 💡 随机摸鱼语录（每 30 秒刷新）
- 📊 摸鱼大数据报告（天数 / 记录数 / 截图数 / 最忙日 / 项目 Top 榜）
- 🌗 **明暗双主题**（右上角切换，自动记忆）
- ✨ 撒花动画、果冻按钮、磁吸效果、卡片悬浮

## 🛠️ 数据维护

如果飞书表格有更新，重新抓取数据：

```bash
cd scripts
"C:\Users\pc202307282\.workbuddy\binaries\node\versions\22.22.2\node.exe" run.js fetch_all_data.js
```

> 脚本依赖 `axios`，路径来自 `~/.workbuddy/skills/feishu-docs/node_modules`，已通过 `run.js` 启动器自动注入。

## 🔌 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/records` | 获取所有记录（原始 + 新增） |
| POST | `/api/records` | 新增记录（multipart/form-data，支持 image 字段） |
| DELETE | `/api/records/:id` | 删除一条用户新增的记录 |
| GET  | `/api/stats` | 摸鱼统计数据 |
| GET  | `/api/quotes` | 随机摸鱼语录 |
| GET  | `/api/health` | 健康检查 |

## 📊 数据来源

- 飞书文档：[没什么卵用的表格](https://my.feishu.cn/wiki/DoJuwEzrEixTf3kKjKWcCOXwnpf)
- 通过飞书开放平台 API 抓取（Sheets v2/v3 + Drive medias）
- 富文本单元格（带样式的段落）已正确提取为纯文本

## 🎭 技术栈

- **后端**：Express 5 + Multer（文件上传）+ CORS
- **前端**：原生 HTML/CSS/JS，无框架，无构建
- **字体**：ZCOOL KuaiLe / ZCOOL QingKe HuangYou / Smiley Sans / Noto Sans SC
- **存储**：JSON 文件 + 本地图片，零数据库依赖

## ⚠️ 免责声明

本网站仅供娱乐，所有"摸鱼"内容均为网络乐子人创作的搞笑记录，请勿当真（认真你就输了）。摸鱼有风险，上班需谨慎。
