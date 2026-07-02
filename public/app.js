/* ============================================
   小雯上班摸鱼档案馆 - 应用脚本
   ============================================ */

// ============ 全局状态 ============
const state = {
  allData: [],          // 所有工作表数据
  currentSheetIdx: 0,   // 当前选中的工作表索引
  searchKeyword: '',    // 搜索关键词
  view: 'card',         // 'card' | 'table' | 'timeline'
  selectedFile: null,   // 当前选择的图片文件
};

// ============ 工具函数 ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 图片加载失败处理：自动重试 2 次，仍失败显示占位
// 原因：Cloudflare 海外边缘节点访问飞书 API 偶发失败，重试通常能成功
function handleImgError(img) {
  let n = parseInt(img.dataset.retry || '0', 10) + 1;
  img.dataset.retry = n;
  if (n <= 2) {
    setTimeout(() => {
      const base = img.src.split('?')[0];
      img.src = base + '?r=' + Date.now();
    }, 600 * n);
  } else {
    const wrap = img.closest('.record-image-wrap, .timeline-image, td.col-image');
    if (wrap) {
      wrap.style.cssText += ';display:flex;align-items:center;justify-content:center;min-height:100px;background:var(--bg-secondary,#f5f5f5);color:var(--text-muted,#999);font-size:13px;flex-direction:column;gap:6px;cursor:default;';
      wrap.innerHTML = '<span style="font-size:28px;">📷</span><span>图片加载失败<br><small style="opacity:0.7">飞书服务器开小差了</small></span>';
      wrap.removeAttribute('data-src');
    } else {
      img.style.display = 'none';
    }
  }
}

function bindImgErrorHandler(container) {
  container.querySelectorAll('img').forEach(img => {
    if (!img.dataset.errorBound) {
      img.dataset.errorBound = '1';
      img.addEventListener('error', () => handleImgError(img));
    }
  });
}

function showToast(message, type = 'info', duration = 3000) {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============ 主题切换 ============
function initTheme() {
  const saved = localStorage.getItem('moyu-theme');
  const theme = saved || 'light';
  document.body.dataset.theme = theme;

  $('#themeToggle').addEventListener('click', () => {
    const cur = document.body.dataset.theme;
    const next = cur === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = next;
    localStorage.setItem('moyu-theme', next);
    showToast(`已切换到${next === 'dark' ? '夜间摸鱼' : '日间摸鱼'}模式`, 'info', 1500);
  });
}

// ============ 跑马灯文字 ============
function initMarquee() {
  const texts = [
    '🐟 今日不摸鱼，明日没鱼摸',
    '🐟 摸鱼一时爽，一直摸鱼一直爽',
    '🐟 上班是不可能上班的，这辈子都不可能上班的',
    '🐟 工作使我快乐？不，是下班使我快乐',
    '🐟 老板看不见就是没在摸鱼',
    '🐟 我不是在摸鱼，我是在进行深度思考',
    '🐟 摸鱼是打工人的浪漫',
    '🐟 人在工位，心在远方',
  ];
  const html = texts.map(t => `<span>${t}</span>`).join('') + texts.map(t => `<span>${t}</span>`).join('');
  $('#marqueeContent').innerHTML = html;
}

// ============ 游动的鱼 ============
function initFish() {
  const container = $('#fishContainer');
  const fishEmojis = ['🐟', '🐠', '🐡', '🐟', '🐠'];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const fish = document.createElement('div');
    fish.className = 'fish';
    fish.textContent = fishEmojis[i % fishEmojis.length];
    fish.style.top = (10 + Math.random() * 80) + '%';
    fish.style.animationDuration = (15 + Math.random() * 15) + 's';
    fish.style.animationDelay = (-Math.random() * 20) + 's';
    fish.style.fontSize = (20 + Math.random() * 20) + 'px';
    container.appendChild(fish);
  }
}

// ============ 弹幕 ============
function shootDanmaku(text, color) {
  const layer = $('#danmakuLayer');
  const d = document.createElement('div');
  d.className = 'danmaku';
  d.textContent = text;
  const colors = ['#ff4d8d', '#00d564', '#ffd60a', '#4dabf7', '#b197fc', '#ff80b5'];
  d.style.background = color || colors[Math.floor(Math.random() * colors.length)];
  d.style.top = (5 + Math.random() * 60) + '%';
  d.style.animationDuration = (8 + Math.random() * 5) + 's';
  layer.appendChild(d);
  setTimeout(() => d.remove(), 14000);
}

function startRandomDanmaku() {
  const messages = [
    '小雯又在摸鱼啦！',
    '这条鱼摸得很专业',
    '已记录在案',
    '摸鱼冠军🏆',
    '8卦8卦8卦',
    '吃瓜群众报道',
    '这鱼真香',
    '今日份摸鱼已送达',
    '老板别看',
    '认真你就输了',
    '鱼：我做错了什么',
    '打工人打工魂',
  ];
  const tick = () => {
    if (Math.random() < 0.6) {
      shootDanmaku(messages[Math.floor(Math.random() * messages.length)]);
    }
    setTimeout(tick, 3500 + Math.random() * 4000);
  };
  setTimeout(tick, 2000);
}

// ============ 撒花 ============
function launchConfetti() {
  const colors = ['#ff4d8d', '#00d564', '#ffd60a', '#4dabf7', '#b197fc'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.width = (6 + Math.random() * 8) + 'px';
    c.style.height = c.style.width;
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    c.style.animationDuration = (2 + Math.random() * 2) + 's';
    c.style.animationDelay = (Math.random() * 0.5) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

// ============ 数据加载 ============
// Cloudflare Pages 部署：直接 fetch 静态 /records.json（无需函数）
// 本地开发：website/server.js 会把 /records.json 映射到 data/records.json
async function loadRecords() {
  try {
    const resp = await fetch('/records.json');
    if (!resp.ok) throw new Error('records.json 加载失败: ' + resp.status);
    const data = await resp.json();
    // records.json 是裸数组 [{sheetTitle, records, ...}]
    state.allData = Array.isArray(data) ? data : (data.data || []);
    renderDateTabs();
    renderCurrentSheet();
    // 数据加载完再算统计（本地计算，无需再请求）
    renderStatsLocal();
  } catch (e) {
    $('#recordsContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">😫</div>
        <div class="empty-state-text">加载失败：${escapeHtml(e.message)}</div>
      </div>`;
  }
}

// 统计数据：前端本地计算（数据已在 state.allData，无需请求后端）
function renderStatsLocal() {
  try {
    const sheets = state.allData;
    if (!sheets.length) return;
    let totalRecords = 0;
    let totalImages = 0;
    let busiestDay = null;
    let busiestCount = 0;
    const contentFreq = {};

    for (const sheet of sheets) {
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

    const days = sheets.length;
    $('#statDays').textContent = days;
    $('#statRecords').textContent = totalRecords;
    $('#statImages').textContent = totalImages;
    const m = (busiestDay || '').match(/(\d{1,2})[.．](\d{1,2})/);
    $('#statBusiest').textContent = m ? `${m[1]}.${m[2]}` : '-';

    const topContents = Object.entries(contentFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const list = $('#topContentsList');
    if (topContents.length) {
      list.innerHTML = topContents.map((c, i) => `
        <div class="top-content-item">
          <span class="top-content-rank r${i + 1}">${i + 1}</span>
          <span>${escapeHtml(c.name)}</span>
          <span class="top-content-count">${c.count}</span>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<div style="color:var(--text-muted);">暂无数据</div>';
    }
    $('#footerRecords').textContent = totalRecords;
  } catch (e) {
    console.error('stats error', e);
  }
}

// 摸鱼语录：前端本地随机（无需请求后端）
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

function loadQuote() {
  const q = MOYU_QUOTES[Math.floor(Math.random() * MOYU_QUOTES.length)];
  $('.quote-text').textContent = q;
  $('#footerQuote').textContent = q;
}

// ============ 渲染：日期标签 ============
function renderDateTabs() {
  const scroll = $('#dateTabsScroll');
  if (!state.allData.length) {
    scroll.innerHTML = '<div style="color:var(--text-muted);padding:10px;">暂无日期</div>';
    return;
  }
  scroll.innerHTML = state.allData.map((sheet, idx) => {
    // 提取日期
    const m = sheet.sheetTitle.match(/(\d{1,2})[.．](\d{1,2})/);
    const dateLabel = m ? `${m[1]}.${m[2]}` : sheet.sheetTitle;
    const count = sheet.records.length;
    const hasNew = sheet.hasNewRecords || sheet.isUserCreated ? 'has-new' : '';
    const active = idx === state.currentSheetIdx ? 'active' : '';
    return `<div class="date-tab ${active} ${hasNew}" data-idx="${idx}">
      📅 ${escapeHtml(dateLabel)}
      <span class="tab-badge">${count}</span>
    </div>`;
  }).join('');

  scroll.querySelectorAll('.date-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.currentSheetIdx = parseInt(tab.dataset.idx, 10);
      renderDateTabs();
      renderCurrentSheet();
      // 滚动到档案区
      const archive = $('#archive');
      const top = archive.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // 自动滚动到激活的tab
  const activeTab = scroll.querySelector('.date-tab.active');
  if (activeTab) {
    activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

// ============ 渲染：当前工作表记录 ============
function renderCurrentSheet() {
  const container = $('#recordsContainer');
  if (!state.allData.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">📭</div><div class="empty-state-text">暂无摸鱼记录</div></div>';
    return;
  }

  // ====== 搜索模式：跨所有日期全局搜索 ======
  if (state.searchKeyword) {
    const kw = state.searchKeyword.toLowerCase();
    const matchedGroups = []; // [{sheet, records}]
    for (const sheet of state.allData) {
      const matched = sheet.records.filter(r =>
        (r.content || '').toLowerCase().includes(kw) ||
        (r.time || '').toLowerCase().includes(kw) ||
        (sheet.sheetTitle || '').toLowerCase().includes(kw)
      );
      if (matched.length > 0) {
        matchedGroups.push({ sheet, records: matched });
      }
    }
    if (matchedGroups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">🔍</div>
          <div class="empty-state-text">没找到 "${escapeHtml(state.searchKeyword)}" 相关的摸鱼记录</div>
          <div class="empty-state-hint">试试搜索：偷菜、刷剧、吃瓜、抖音、今日说法...</div>
        </div>`;
      return;
    }
    const totalCount = matchedGroups.reduce((s, g) => s + g.records.length, 0);
    let html = `<div class="search-result-header">
      🔎 搜索 "<strong>${escapeHtml(state.searchKeyword)}</strong>" 
      共找到 <strong>${totalCount}</strong> 条记录，分布在 <strong>${matchedGroups.length}</strong> 个日期
    </div>`;
    // 按日期分组渲染
    html += '<div class="search-groups">';
    for (const g of matchedGroups) {
      const dateMatch = g.sheet.sheetTitle.match(/(\d{1,2})[.．](\d{1,2})/);
      const dateLabel = dateMatch ? `${dateMatch[1]}.${dateMatch[2]}` : g.sheet.sheetTitle;
      html += `<div class="search-group">
        <div class="search-group-header" data-sheet-title="${escapeHtml(g.sheet.sheetTitle)}">
          <span class="search-group-date">📅 ${escapeHtml(dateLabel)}</span>
          <span class="search-group-count">${g.records.length} 条</span>
          <span class="search-group-hint">点击查看完整记录 →</span>
        </div>
        <div class="records-grid">`;
      html += g.records.map((r, i) => renderCard(r, i + 1, g.sheet.sheetTitle)).join('');
      html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    // 绑定事件
    container.querySelectorAll('.record-image-wrap').forEach(w => {
      w.addEventListener('click', () => openLightbox(w.dataset.src, w.dataset.caption));
    });
    container.querySelectorAll('.record-delete-btn').forEach(b => {
      b.addEventListener('click', () => deleteRecord(b.dataset.id));
    });
    bindImgErrorHandler(container);
    container.querySelectorAll('.search-group-header').forEach(h => {
      h.addEventListener('click', () => {
        // 点击日期标题跳转到该日期
        const title = h.dataset.sheetTitle;
        const idx = state.allData.findIndex(s => s.sheetTitle === title);
        if (idx >= 0) {
          state.searchKeyword = '';
          $('#searchInput').value = '';
          state.currentSheetIdx = idx;
          renderDateTabs();
          renderCurrentSheet();
        }
      });
    });
    return;
  }

  // ====== 正常模式：展示当前选中的日期 ======
  const sheet = state.allData[state.currentSheetIdx];
  if (!sheet) return;
  let records = sheet.records;

  // 按时间排序（确保时间顺序）
  records = [...records].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">📭</div>
        <div class="empty-state-text">这一天暂无摸鱼记录</div>
      </div>`;
    return;
  }

  // 日期标题
  const dateMatch = sheet.sheetTitle.match(/(\d{1,2})[.．](\d{1,2})/);
  const dateLabel = dateMatch ? `${dateMatch[1]}月${dateMatch[2]}日` : sheet.sheetTitle;
  let headerHtml = `<div class="day-header">
    <div class="day-header-date">📅 ${escapeHtml(dateLabel)}</div>
    <div class="day-header-info">
      <span>共 <strong>${records.length}</strong> 条摸鱼记录</span>
      <span class="day-header-time-range">⏰ ${escapeHtml(records[0]?.time || '??')} - ${escapeHtml(records[records.length-1]?.time || '??')}</span>
    </div>
  </div>`;

  if (state.view === 'timeline') {
    container.innerHTML = headerHtml + renderTimeline(records, dateLabel);
  } else if (state.view === 'card') {
    container.innerHTML = headerHtml + `<div class="records-grid">${records.map((r, i) => renderCard(r, i + 1)).join('')}</div>`;
  } else {
    container.innerHTML = headerHtml + `<div class="records-table-wrap"><table class="records-table">
      <thead><tr>
        <th>#</th><th>⏰ 时间</th><th>📝 摸鱼内容</th><th>🖼️ 截图</th>${records.some(r => r.isUserAdded) ? '<th>操作</th>' : ''}
      </tr></thead>
      <tbody>
        ${records.map((r, i) => renderTableRow(r, i + 1)).join('')}
      </tbody>
    </table></div>`;
  }

  // 绑定事件
  container.querySelectorAll('.record-image-wrap, .timeline-image').forEach(w => {
    w.addEventListener('click', () => openLightbox(w.dataset.src, w.dataset.caption));
  });
  container.querySelectorAll('.record-delete-btn').forEach(b => {
    b.addEventListener('click', () => deleteRecord(b.dataset.id));
  });
  bindImgErrorHandler(container);
}

function renderCard(r, idx, sheetTitle) {
  const userTag = r.isUserAdded ? '<span class="record-user-tag">新增</span>' : '';
  const dateTag = sheetTitle ? (() => {
    const m = sheetTitle.match(/(\d{1,2})[.．](\d{1,2})/);
    return m ? `<span class="record-date-tag">📅 ${m[1]}.${m[2]}</span>` : '';
  })() : '';
  let imgHtml = '';
  if (r.image) {
    const src = `/images/${r.image.fileName}`;
    imgHtml = `<div class="record-image-wrap" data-src="${src}" data-caption="${escapeHtml((dateTag ? sheetTitle + ' | ' : '') + r.time + ' | ' + r.content)}">
      <img src="${src}" alt="${escapeHtml(r.content)}" loading="lazy" />
    </div>`;
  } else {
    imgHtml = `<div class="record-no-image">📷 暂无截图</div>`;
  }
  const delBtn = r.isUserAdded ? `<button class="record-delete-btn" data-id="${r.id}">🗑️ 删除</button>` : '';
  return `
    <article class="record-card ${r.isUserAdded ? 'user-added' : ''}">
      ${imgHtml}
      <div class="record-body">
        <div class="record-meta">
          <span class="record-time">⏰ ${escapeHtml(r.time || '??')}</span>
          <span class="record-index">#${idx}</span>
          ${dateTag}
          ${userTag}
        </div>
        <div class="record-content">${escapeHtml(r.content || '(无内容)')}</div>
        ${delBtn ? `<div class="record-actions">${delBtn}</div>` : ''}
      </div>
    </article>
  `;
}

// ============ 时间线视图：展示一天的行为流 ============
function renderTimeline(records, dateLabel) {
  if (!records.length) return '<div class="empty-state"><div class="empty-state-emoji">📭</div></div>';
  // 按时间段分组：上午(0-12)、下午(12-18)、晚上(18-24)
  const groups = [
    { label: '🌅 上午摸鱼', range: '00:00 - 12:00', records: [] },
    { label: '☀️ 下午摸鱼', range: '12:00 - 18:00', records: [] },
    { label: '🌙 晚间摸鱼', range: '18:00 - 24:00', records: [] },
  ];
  for (const r of records) {
    if (!r.time) { groups[0].records.push(r); continue; }
    const h = parseInt(r.time.split(':')[0], 10);
    if (h < 12) groups[0].records.push(r);
    else if (h < 18) groups[1].records.push(r);
    else groups[2].records.push(r);
  }

  let html = '<div class="timeline">';
  let globalIdx = 0;
  for (const g of groups) {
    if (!g.records.length) continue;
    html += `
      <div class="timeline-section">
        <div class="timeline-section-header">
          <span class="timeline-section-label">${g.label}</span>
          <span class="timeline-section-range">${g.range}</span>
          <span class="timeline-section-count">${g.records.length} 条</span>
        </div>
        <div class="timeline-items">
    `;
    for (const r of g.records) {
      globalIdx++;
      const src = r.image
        ? (`/images/${r.image.fileName}`)
        : null;
      const caption = `${dateLabel} | ${r.time || '??'} | ${r.content}`;
      const userTag = r.isUserAdded ? '<span class="record-user-tag">新增</span>' : '';
      const delBtn = r.isUserAdded ? `<button class="record-delete-btn" data-id="${r.id}">🗑️</button>` : '';
      html += `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-time">${escapeHtml(r.time || '??')}</div>
          <div class="timeline-card ${r.isUserAdded ? 'user-added' : ''}">
            <div class="timeline-card-header">
              <span class="timeline-card-index">#${globalIdx}</span>
              ${userTag}
              ${delBtn}
            </div>
            <div class="timeline-card-content">${escapeHtml(r.content || '(无内容)')}</div>
            ${src ? `
              <div class="timeline-image" data-src="${src}" data-caption="${escapeHtml(caption)}">
                <img src="${src}" alt="${escapeHtml(r.content)}" loading="lazy" />
              </div>
            ` : '<div class="timeline-no-image">📷 暂无截图</div>'}
          </div>
        </div>
      `;
    }
    html += '</div></div>';
  }
  html += '</div>';

  // 一天行为小结
  const summary = generateDaySummary(records, dateLabel);
  html = `<div class="day-summary">${summary}</div>` + html;
  return html;
}

// 生成一天的摸鱼行为小结
function generateDaySummary(records, dateLabel) {
  if (!records.length) return '';
  const times = records.map(r => r.time).filter(Boolean).sort();
  const startTime = times[0] || '??';
  const endTime = times[times.length - 1] || '??';
  const withImage = records.filter(r => r.image).length;

  // 提取所有内容关键词
  const contents = records.map(r => (r.content || '').trim()).filter(Boolean);
  const highlights = contents.slice(0, 5).map(c => {
    const firstLine = c.split('\n')[0];
    return firstLine.length > 12 ? firstLine.slice(0, 12) + '...' : firstLine;
  });

  return `
    <div class="day-summary-card">
      <div class="day-summary-title">📋 ${escapeHtml(dateLabel)} 摸鱼小结</div>
      <div class="day-summary-stats">
        <div class="summary-stat"><span class="summary-num">${records.length}</span><span class="summary-label">条记录</span></div>
        <div class="summary-stat"><span class="summary-num">${withImage}</span><span class="summary-label">张截图</span></div>
        <div class="summary-stat"><span class="summary-num">${escapeHtml(startTime)}</span><span class="summary-label">开始摸鱼</span></div>
        <div class="summary-stat"><span class="summary-num">${escapeHtml(endTime)}</span><span class="summary-label">最后摸鱼</span></div>
      </div>
      ${highlights.length ? `
        <div class="day-summary-highlights">
          <div class="highlights-label">🎯 摸鱼精选：</div>
          <div class="highlights-tags">
            ${highlights.map(h => `<span class="highlight-tag">${escapeHtml(h)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTableRow(r, idx) {
  let imgCell;
  if (r.image) {
    const src = `/images/${r.image.fileName}`;
    imgCell = `<td class="col-image" data-src="${src}" data-caption="${escapeHtml(r.time + ' | ' + r.content)}"><img src="${src}" alt="" loading="lazy" /></td>`;
  } else {
    imgCell = `<td class="col-image no-img">无图</td>`;
  }
  const delCell = r.isUserAdded ? `<td><button class="record-delete-btn" data-id="${r.id}">🗑️</button></td>` : '';
  return `<tr>
    <td>${idx}</td>
    <td class="col-time">${escapeHtml(r.time || '??')}</td>
    <td class="col-content">${escapeHtml(r.content || '(无内容)')}</td>
    ${imgCell}
    ${delCell}
  </tr>`;
}

// ============ 删除记录 ============
// Cloudflare Pages 无持久化存储：新增记录直接写飞书，删除需去飞书表格操作
async function deleteRecord(id) {
  if (!id) return;
  showToast('网页端暂不支持删除，请到飞书表格里手动删除该行', 'info', 4000);
}

// ============ 灯箱 ============
function openLightbox(src, caption) {
  const lb = $('#lightbox');
  $('#lightboxImg').src = src;
  $('#lightboxCaption').textContent = caption || '';
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
}
function closeLightbox() {
  const lb = $('#lightbox');
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden', 'true');
}

// ============ 搜索 ============
function initSearch() {
  let timer = null;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchKeyword = e.target.value.trim();
      renderCurrentSheet();
    }, 200);
  });
}

// ============ 视图切换 ============
function initViewToggle() {
  $$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      renderCurrentSheet();
    });
  });
}

// ============ 新增记录表单 ============
function initAddForm() {
  const form = $('#addForm');
  const fileInput = $('#image');
  const uploadPlaceholder = $('#uploadPlaceholder');
  const uploadPreview = $('#uploadPreview');
  const previewImg = $('#previewImg');
  const removeImgBtn = $('#removeImgBtn');

  // 点击上传区
  $('#imageUpload').addEventListener('click', (e) => {
    if (e.target === removeImgBtn) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('只能上传图片文件', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('图片大小不能超过 10MB', 'error');
      return;
    }
    state.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      previewImg.src = ev.target.result;
      uploadPlaceholder.style.display = 'none';
      uploadPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  removeImgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.selectedFile = null;
    fileInput.value = '';
    uploadPlaceholder.style.display = 'block';
    uploadPreview.style.display = 'none';
  });

  // 表单提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sheetTitle = $('#sheetTitle').value.trim();
    const content = $('#content').value.trim();
    const time = $('#time').value;
    if (!sheetTitle || !content) {
      showToast('日期和内容必填！', 'error');
      return;
    }

    const submitBtn = form.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ 提交中...';
    submitBtn.disabled = true;

    try {
      // 用 JSON + base64 上传图片（Vercel Serverless 兼容）
      const payload = { sheetTitle, content, time };
      if (state.selectedFile) {
        // 把 File 转成 base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(state.selectedFile);
        });
        payload.imageBase64 = base64;
        payload.imageName = state.selectedFile.name || (Date.now() + '.png');
      }

      const resp = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.msg || '提交失败');
      showToast(json.msg || '🎉 摸鱼记录已存档！', 'success');
      launchConfetti();
      shootDanmaku('新增摸鱼记录: ' + content.slice(0, 20), '#00d564');

      // 重置表单
      form.reset();
      state.selectedFile = null;
      uploadPlaceholder.style.display = 'block';
      uploadPreview.style.display = 'none';

      // 重新加载数据（loadRecords 内部会自动刷新统计）
      await loadRecords();

      // 跳转到对应日期
      const idx = state.allData.findIndex(s => s.sheetTitle === sheetTitle);
      if (idx >= 0) {
        state.currentSheetIdx = idx;
        renderDateTabs();
        renderCurrentSheet();
        // 滚动到档案区
        setTimeout(() => {
          const archive = $('#archive');
          const top = archive.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top, behavior: 'smooth' });
        }, 200);
      }
    } catch (err) {
      showToast('提交失败: ' + err.message, 'error');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });

  // 重置按钮
  $('#resetBtn').addEventListener('click', () => {
    state.selectedFile = null;
    uploadPlaceholder.style.display = 'block';
    uploadPreview.style.display = 'none';
  });
}

// ============ 浮动按钮 ============
function initFab() {
  $('#fab').addEventListener('click', () => {
    const add = $('#add');
    const top = add.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => $('#sheetTitle').focus(), 600);
  });
  $('#navAddBtn').addEventListener('click', (e) => {
    // 让锚点滚动平滑
    e.preventDefault();
    const add = $('#add');
    const top = add.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });
}

// ============ 灯箱关闭 ============
function initLightbox() {
  $('#lightboxClose').addEventListener('click', closeLightbox);
  $('#lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

// ============ 预填日期 ============
function prefillDate() {
  // 给 sheetTitle 默认填一个"小雯上班记录（今日）"
  const today = new Date();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  $('#sheetTitle').placeholder = `如：小雯上班记录（${m}.${d}）`;
  // 默认时间为现在
  const hh = String(today.getHours()).padStart(2, '0');
  const mm = String(today.getMinutes()).padStart(2, '0');
  $('#time').value = `${hh}:${mm}`;
}

// ============ 品牌点击回顶部 ============
function initBrandClick() {
  $('.brand').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMarquee();
  initFish();
  initSearch();
  initViewToggle();
  initAddForm();
  initFab();
  initLightbox();
  prefillDate();
  initBrandClick();
  startRandomDanmaku();

  loadRecords();
  loadQuote();

  // 定时刷新语录
  setInterval(loadQuote, 30000);

  // 欢迎弹幕
  setTimeout(() => shootDanmaku('欢迎来到摸鱼档案馆！', '#00d564'), 1500);
  setTimeout(() => shootDanmaku('今日不摸鱼，明日没鱼摸', '#ff4d8d'), 4000);

  console.log('%c🐟 小雯上班摸鱼档案馆', 'font-size:24px;font-weight:bold;color:#00d564;');
  console.log('%c欢迎摸鱼！', 'font-size:14px;color:#ff4d8d;');
});
