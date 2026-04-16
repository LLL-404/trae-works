/**
 * GitInsight - Git 代码贡献可视化分析器
 * Powered by TRAE SOLO
 *
 * 合并模块：git-parser + visualizer + app
 */

// ============================================================
// MODULE: Git Parser
// ============================================================

function parseGitLog(rawLog) {
  const commits = [];
  const lines = rawLog.trim().split('\n');
  let currentCommit = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const commitMatch = line.match(/^([a-f0-9]{40})\|(.+?)\|(.+?)\|(.+?)\|(.+)$/);
    if (commitMatch) {
      if (currentCommit) commits.push(currentCommit);
      currentCommit = {
        hash: commitMatch[1].substring(0, 7),
        fullHash: commitMatch[1],
        author: commitMatch[2].trim(),
        email: commitMatch[3].trim(),
        date: new Date(commitMatch[4]),
        message: commitMatch[5].trim(),
        additions: 0, deletions: 0, filesChanged: 0
      };
      continue;
    }

    if (currentCommit && (line.includes('insertion') || line.includes('deletion') || line.includes('changed'))) {
      const fm = line.match(/(\d+) files? changed/);
      const am = line.match(/(\d+) insertions?\(\+\)/);
      const dm = line.match(/(\d+) deletions?\(-\)/);
      if (fm) currentCommit.filesChanged = parseInt(fm[1]);
      if (am) currentCommit.additions = parseInt(am[1]);
      if (dm) currentCommit.deletions = parseInt(dm[1]);
    }
  }
  if (currentCommit) commits.push(currentCommit);
  return analyzeCommits(commits);
}

/**
 * 解析 commit message 前缀，返回类型和描述
 */
function parseCommitType(message) {
  const match = message.match(/^(\w+)(?:\([^)]*\))?\s*[:：]\s*(.*)/);
  if (match) {
    const type = match[1].toLowerCase();
    const knownTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'build', 'ci'];
    if (knownTypes.includes(type)) {
      return { type: type, desc: match[2] || message };
    }
  }
  return { type: 'other', desc: message };
}

function analyzeCommits(commits) {
  if (commits.length === 0) {
    return { commits: [], stats: {}, authorStats: {}, dailyMap: {}, hourlyMap: {}, weekdayMap: {}, commitTypeMap: {}, monthlyData: [] };
  }

  commits.sort((a, b) => b.date - a.date);

  const authors = new Set(commits.map(c => c.author));
  const dates = new Set(commits.map(c => c.date.toISOString().split('T')[0]));
  const totalAdditions = commits.reduce((s, c) => s + c.additions, 0);
  const totalDeletions = commits.reduce((s, c) => s + c.deletions, 0);
  const totalFiles = commits.reduce((s, c) => s + c.filesChanged, 0);
  const sortedDates = [...dates].sort();
  const activeDays = dates.size;

  // 项目持续时间
  const firstDate = new Date(sortedDates[0]);
  const lastDate = new Date(sortedDates[sortedDates.length - 1]);
  const durationMs = lastDate.getTime() - firstDate.getTime();
  const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

  // 作者统计
  const authorStats = {};
  commits.forEach(c => {
    if (!authorStats[c.author]) {
      authorStats[c.author] = {
        commits: 0, additions: 0, deletions: 0, filesChanged: 0,
        email: c.email, firstCommit: c.date, lastCommit: c.date,
        activeDaysSet: new Set()
      };
    }
    authorStats[c.author].commits++;
    authorStats[c.author].additions += c.additions;
    authorStats[c.author].deletions += c.deletions;
    authorStats[c.author].filesChanged += c.filesChanged;
    authorStats[c.author].activeDaysSet.add(c.date.toISOString().split('T')[0]);
    if (c.date < authorStats[c.author].firstCommit) authorStats[c.author].firstCommit = c.date;
    if (c.date > authorStats[c.author].lastCommit) authorStats[c.author].lastCommit = c.date;
  });

  // 每日提交
  const dailyMap = {};
  commits.forEach(c => {
    const k = c.date.toISOString().split('T')[0];
    dailyMap[k] = (dailyMap[k] || 0) + 1;
  });

  // 每小时提交
  const hourlyMap = new Array(24).fill(0);
  commits.forEach(c => { hourlyMap[c.date.getHours()]++; });

  // 每周提交
  const weekdayMap = new Array(7).fill(0);
  commits.forEach(c => { weekdayMap[c.date.getDay()]++; });

  // 按周统计
  const weeklyMap = {};
  commits.forEach(c => {
    const d = new Date(c.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const wk = monday.toISOString().split('T')[0];
    weeklyMap[wk] = (weeklyMap[wk] || 0) + 1;
  });

  const weeklyData = Object.entries(weeklyMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count }));
  const authorRanking = Object.entries(authorStats).sort(([, a], [, b]) => b.commits - a.commits).map(([name, stats]) => ({
    name, commits: stats.commits, additions: stats.additions, deletions: stats.deletions,
    filesChanged: stats.filesChanged, email: stats.email,
    firstCommit: stats.firstCommit, lastCommit: stats.lastCommit,
    activeDays: stats.activeDaysSet.size
  }));

  // 提交类型分布
  const commitTypeMap = {};
  commits.forEach(c => {
    const { type } = parseCommitType(c.message);
    commitTypeMap[type] = (commitTypeMap[type] || 0) + 1;
  });

  // 按月统计
  const monthlyMap = {};
  commits.forEach(c => {
    const d = c.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) {
      monthlyMap[key] = { month: key, commits: 0, additions: 0, deletions: 0 };
    }
    monthlyMap[key].commits++;
    monthlyMap[key].additions += c.additions;
    monthlyMap[key].deletions += c.deletions;
  });
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

  return {
    commits, stats: {
      totalCommits: commits.length, totalAuthors: authors.size, activeDays,
      avgPerDay: (commits.length / activeDays).toFixed(1),
      totalAdditions, totalDeletions, totalFiles,
      firstDate: sortedDates[0], lastDate: sortedDates[sortedDates.length - 1],
      durationDays
    },
    authorStats, authorRanking, dailyMap, hourlyMap, weekdayMap,
    weekdayNames: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    weeklyData, commitTypeMap, monthlyData
  };
}

function generateDemoData() {
  const authors = [
    { name: '张三', email: 'zhangsan@example.com' },
    { name: '李四', email: 'lisi@example.com' },
    { name: '王五', email: 'wangwu@example.com' },
    { name: '赵六', email: 'zhaoliu@example.com' },
    { name: 'Alice', email: 'alice@example.com' }
  ];
  const messages = [
    'feat: 新增用户登录功能', 'fix: 修复首页加载缓慢的问题', 'docs: 更新 API 文档',
    'style: 调整按钮样式', 'refactor: 重构数据库连接模块', 'feat: 添加数据导出功能',
    'fix: 修复权限校验漏洞', 'test: 补充单元测试', 'chore: 升级依赖版本',
    'feat: 实现消息推送功能', 'fix: 修复移动端适配问题', 'perf: 优化查询性能',
    'feat: 新增仪表盘页面', 'docs: 添加部署指南', 'fix: 修复并发请求导致的死锁',
    'refactor: 拆分大型组件', 'feat: 支持暗色主题', 'fix: 修复文件上传大小限制',
    'test: 增加集成测试', 'feat: 实现 WebSocket 实时通信', 'fix: 修复缓存失效问题',
    'docs: 更新 README', 'style: 统一代码格式', 'feat: 添加操作日志功能',
    'fix: 修复分页查询错误', 'perf: 优化图片加载', 'feat: 新增权限管理模块',
    'refactor: 优化路由结构', 'fix: 修复跨域问题', 'chore: 清理无用代码',
    'feat: 实现 Excel 导入功能', 'fix: 修复日期选择器时区问题', 'test: 修复测试用例',
    'feat: 添加搜索功能', 'docs: 补充注释', 'fix: 修复内存泄漏',
    'feat: 新增通知中心', 'refactor: 提取公共组件', 'fix: 修复表单验证问题',
    'feat: 实现文件预览功能', 'chore: 更新 CI 配置', 'build: 更新 webpack 配置',
    'ci: 优化 GitHub Actions 流程', 'feat(auth): 新增 OAuth 登录',
    'fix(api): 修复接口超时', 'refactor(core): 重构核心模块',
    'perf(db): 优化数据库查询', 'test(e2e): 增加端到端测试',
    'docs(guide): 编写开发指南', 'feat(dashboard): 仪表盘图表组件',
    'fix(ui): 修复布局错位', 'chore(deps): 升级安全依赖',
    'Merge pull request #123 from feature/login',
    'Merge pull request #456 from fix/memory-leak',
    'Initial commit', 'Update README.md', 'Bump version to 2.0.0'
  ];

  const lines = [];
  const now = new Date();
  for (let day = 0; day < 180; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const isWeekday = date.getDay() >= 1 && date.getDay() <= 5;
    const count = isWeekday ? Math.floor(Math.random() * 6) + 1 : Math.floor(Math.random() * 3);
    for (let c = 0; c < count; c++) {
      const a = authors[Math.floor(Math.random() * authors.length)];
      const msg = messages[Math.floor(Math.random() * messages.length)];
      date.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      const hash = Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
      const fc = Math.floor(Math.random() * 8) + 1;
      const add = Math.floor(Math.random() * 200) + 5;
      const del = Math.floor(Math.random() * 100);
      lines.push(`${hash}|${a.name}|${a.email}|${date.toISOString()}|${msg}`);
      lines.push(` ${fc} file${fc > 1 ? 's' : ''} changed, ${add} insertions(+), ${del} deletions(-)`);
    }
  }
  return lines.join('\n');
}

function getAuthorColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const colors = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#79c0ff','#56d364','#e3b341','#ff7b72','#d2a8ff','#39d353','#db6d28','#f778ba','#a5d6ff','#7ee787'];
  return colors[Math.abs(h) % colors.length];
}

function getAvatarColor(name) { return getAuthorColor(name) + '33'; }

// ============================================================
// MODULE: Visualizer
// ============================================================

// Chart instances - track all for proper cleanup
let trendChartInstance = null;
let authorChartInstance = null;
let timeChartInstance = null;
let weekdayChartInstance = null;
let typeChartInstance = null;
let codeTrendChartInstance = null;
let monthlyChartInstance = null;

// Commit type colors
const TYPE_COLORS = {
  feat:     '#3fb950',
  fix:      '#f85149',
  docs:     '#58a6ff',
  style:    '#bc8cff',
  refactor: '#d29922',
  perf:     '#f778ba',
  test:     '#79c0ff',
  chore:    '#8b949e',
  build:    '#db6d28',
  ci:       '#8b949e',
  other:    '#6e7681'
};

const TYPE_LABELS = {
  feat: 'feat (新功能)',
  fix: 'fix (修复)',
  docs: 'docs (文档)',
  style: 'style (样式)',
  refactor: 'refactor (重构)',
  perf: 'perf (性能)',
  test: 'test (测试)',
  chore: 'chore (杂项)',
  build: 'build (构建)',
  ci: 'ci (持续集成)',
  other: '其他'
};

// Common chart tooltip config
const chartTooltip = {
  backgroundColor: '#1c2128',
  titleColor: '#e6edf3',
  bodyColor: '#8b949e',
  borderColor: '#30363d',
  borderWidth: 1,
  cornerRadius: 8,
  padding: 12,
  titleFont: { family: 'Inter, sans-serif', size: 13, weight: '600' },
  bodyFont: { family: 'Inter, sans-serif', size: 12 }
};

// Common scale config
const commonScales = {
  x: {
    ticks: { color: '#484f58', font: { size: 11, family: 'Inter, sans-serif' } },
    grid: { color: 'rgba(48,54,61,0.5)' }
  },
  y: {
    beginAtZero: true,
    ticks: { color: '#484f58', font: { size: 11, family: 'Inter, sans-serif' } },
    grid: { color: 'rgba(48,54,61,0.5)' }
  }
};

/**
 * 销毁所有图表实例
 */
function destroyAllCharts() {
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  if (authorChartInstance) { authorChartInstance.destroy(); authorChartInstance = null; }
  if (timeChartInstance) { timeChartInstance.destroy(); timeChartInstance = null; }
  if (weekdayChartInstance) { weekdayChartInstance.destroy(); weekdayChartInstance = null; }
  if (typeChartInstance) { typeChartInstance.destroy(); typeChartInstance = null; }
  if (codeTrendChartInstance) { codeTrendChartInstance.destroy(); codeTrendChartInstance = null; }
  if (monthlyChartInstance) { monthlyChartInstance.destroy(); monthlyChartInstance = null; }
}

/**
 * 绘制贡献热力图
 */
function drawHeatmap(canvas, dailyMap) {
  const ctx = canvas.getContext('2d');
  const cellSize = 13, cellGap = 3, cellStep = cellSize + cellGap;
  const weeks = 52, days = 7;
  canvas.width = weeks * cellStep + 40;
  canvas.height = days * cellStep + 30;
  const maxCount = Math.max(1, ...Object.values(dailyMap));
  const levelColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

  function getLevel(count) {
    if (count === 0) return 0;
    const r = count / maxCount;
    if (r <= 0.25) return 1; if (r <= 0.5) return 2; if (r <= 0.75) return 3; return 4;
  }

  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#8b949e';
  const dayLabels = ['', '周一', '', '周三', '', '周五', ''];
  for (let d = 0; d < days; d++) {
    if (dayLabels[d]) ctx.fillText(dayLabels[d], 0, d * cellStep + cellSize - 1);
  }

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7 - 1));
  startDate.setDate(startDate.getDate() - startDate.getDay());
  let lastMonth = -1;

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(cellDate.getDate() + w * 7 + d);
      const dateKey = cellDate.toISOString().split('T')[0];
      const count = dailyMap[dateKey] || 0;
      const x = 30 + w * cellStep, y = d * cellStep + 15;
      ctx.fillStyle = levelColors[getLevel(count)];
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 2);
      ctx.fill();
      const month = cellDate.getMonth();
      if (d === 0 && month !== lastMonth) {
        ctx.fillStyle = '#8b949e';
        ctx.fillText(monthLabels[month], x, 10);
        lastMonth = month;
      }
    }
  }
}

/**
 * 提交趋势（按周）- 折线图
 */
function renderTrendChart(canvas, weeklyData) {
  if (trendChartInstance) trendChartInstance.destroy();
  const labels = weeklyData.map(d => {
    const dt = new Date(d.week);
    return `${dt.getMonth()+1}/${dt.getDate()}`;
  });
  trendChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '提交数',
        data: weeklyData.map(d => d.count),
        borderColor: '#58a6ff',
        backgroundColor: 'rgba(88,166,255,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#58a6ff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...chartTooltip, callbacks: { title: (i) => `周: ${i[0].label}`, label: (i) => `${i.raw} 次提交` } }
      },
      scales: {
        x: { ...commonScales.x, ticks: { ...commonScales.x.ticks, maxTicksLimit: 10 } },
        y: { ...commonScales.y }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

/**
 * 贡献者排行榜 - 水平柱状图
 */
function renderAuthorChart(canvas, authorRanking) {
  if (authorChartInstance) authorChartInstance.destroy();
  const top10 = authorRanking.slice(0, 10);
  authorChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: top10.map(a => a.name),
      datasets: [{
        label: '提交数',
        data: top10.map(a => a.commits),
        backgroundColor: top10.map(a => getAuthorColor(a.name) + '99'),
        borderColor: top10.map(a => getAuthorColor(a.name)),
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: {
            label: (i) => {
              const a = top10[i.dataIndex];
              return [`提交: ${a.commits} 次`, `新增: +${a.additions.toLocaleString()} 行`, `删除: -${a.deletions.toLocaleString()} 行`];
            }
          }
        }
      },
      scales: {
        x: { ...commonScales.x, beginAtZero: true },
        y: { ticks: { color: '#e6edf3', font: { size: 12, family: 'Inter, sans-serif' } }, grid: { display: false } }
      }
    }
  });
}

/**
 * 提交时间分布 - 柱状图
 */
function renderTimeChart(canvas, hourlyMap) {
  if (timeChartInstance) timeChartInstance.destroy();
  const maxH = Math.max(...hourlyMap);
  timeChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{
        label: '提交数',
        data: hourlyMap,
        backgroundColor: hourlyMap.map(v => `rgba(88,166,255,${0.2 + Math.min(v / maxH, 1) * 0.6})`),
        borderColor: '#58a6ff',
        borderWidth: 1,
        borderRadius: 2,
        barPercentage: 0.8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...chartTooltip, callbacks: { title: (i) => `${i[0].label}`, label: (i) => `${i.raw} 次提交` } }
      },
      scales: {
        x: { ...commonScales.x, ticks: { ...commonScales.x.ticks, maxTicksLimit: 12, font: { size: 10 } }, grid: { display: false } },
        y: { ...commonScales.y }
      }
    }
  });
}

/**
 * 星期贡献分布 - 雷达图
 */
function renderWeekdayChart(canvas, weekdayMap) {
  if (weekdayChartInstance) weekdayChartInstance.destroy();
  const ordered = [weekdayMap[1], weekdayMap[2], weekdayMap[3], weekdayMap[4], weekdayMap[5], weekdayMap[6], weekdayMap[0]];
  weekdayChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      datasets: [{
        label: '提交数',
        data: ordered,
        backgroundColor: 'rgba(88,166,255,0.15)',
        borderColor: '#58a6ff',
        borderWidth: 2,
        pointBackgroundColor: '#58a6ff',
        pointBorderColor: '#0d1117',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...chartTooltip, callbacks: { label: (i) => `${i.label}: ${i.raw} 次提交` } }
      },
      scales: {
        r: {
          beginAtZero: true,
          ticks: { color: '#484f58', backdropColor: 'transparent', font: { size: 10 } },
          grid: { color: 'rgba(48,54,61,0.5)' },
          angleLines: { color: 'rgba(48,54,61,0.5)' },
          pointLabels: { color: '#e6edf3', font: { size: 12, family: 'Inter, sans-serif' } }
        }
      }
    }
  });
}

/**
 * 提交类型分布 - 环形图
 */
function renderTypeChart(canvas, typeMap) {
  if (typeChartInstance) typeChartInstance.destroy();

  const entries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([type]) => TYPE_LABELS[type] || type);
  const data = entries.map(([, count]) => count);
  const colors = entries.map(([type]) => TYPE_COLORS[type] || '#6e7681');

  typeChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#1c2128',
        borderWidth: 2,
        hoverBorderColor: '#e6edf3',
        hoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#e6edf3',
            font: { size: 12, family: 'Inter, sans-serif' },
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8
          }
        },
        tooltip: {
          ...chartTooltip,
          callbacks: {
            label: (i) => {
              const total = data.reduce((s, v) => s + v, 0);
              const pct = ((i.raw / total) * 100).toFixed(1);
              return ` ${i.label}: ${i.raw} 次 (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * 代码行数趋势 - 柱状+折线混合图
 */
function renderCodeTrendChart(canvas, monthlyData) {
  if (codeTrendChartInstance) codeTrendChartInstance.destroy();

  const labels = monthlyData.map(d => {
    const [y, m] = d.month.split('-');
    return `${parseInt(m)}月`;
  });

  codeTrendChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '新增行数',
          data: monthlyData.map(d => d.additions),
          backgroundColor: 'rgba(63,185,80,0.6)',
          borderColor: '#3fb950',
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.6,
          order: 2
        },
        {
          label: '删除行数',
          data: monthlyData.map(d => d.deletions),
          backgroundColor: 'rgba(248,81,73,0.6)',
          borderColor: '#f85149',
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.6,
          order: 3
        },
        {
          label: '净增行数',
          data: monthlyData.map(d => d.additions - d.deletions),
          type: 'line',
          borderColor: '#d29922',
          backgroundColor: 'rgba(210,153,34,0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#d29922',
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e6edf3',
            font: { size: 12, family: 'Inter, sans-serif' },
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 16
          }
        },
        tooltip: {
          ...chartTooltip,
          callbacks: {
            label: (i) => {
              if (i.dataset.label === '新增行数') return ` 新增: +${i.raw.toLocaleString()} 行`;
              if (i.dataset.label === '删除行数') return ` 删除: -${i.raw.toLocaleString()} 行`;
              return ` 净增: ${i.raw >= 0 ? '+' : ''}${i.raw.toLocaleString()} 行`;
            }
          }
        }
      },
      scales: {
        x: { ...commonScales.x, grid: { display: false } },
        y: { ...commonScales.y }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

/**
 * 月度活跃度 - 柱状图
 */
function renderMonthlyChart(canvas, monthlyData) {
  if (monthlyChartInstance) monthlyChartInstance.destroy();

  const labels = monthlyData.map(d => {
    const [y, m] = d.month.split('-');
    return `${parseInt(m)}月`;
  });
  const maxCommits = Math.max(...monthlyData.map(d => d.commits));

  monthlyChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '提交数',
        data: monthlyData.map(d => d.commits),
        backgroundColor: monthlyData.map(d =>
          d.commits === maxCommits
            ? 'rgba(88,166,255,0.9)'
            : 'rgba(88,166,255,0.4)'
        ),
        borderColor: monthlyData.map(d =>
          d.commits === maxCommits
            ? '#58a6ff'
            : 'rgba(88,166,255,0.6)'
        ),
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: {
            title: (i) => {
              const idx = i[0].dataIndex;
              return monthlyData[idx].month;
            },
            label: (i) => {
              const idx = i.dataIndex;
              const d = monthlyData[idx];
              return [
                `提交: ${d.commits} 次`,
                `新增: +${d.additions.toLocaleString()} 行`,
                `删除: -${d.deletions.toLocaleString()} 行`
              ];
            }
          }
        }
      },
      scales: {
        x: { ...commonScales.x, grid: { display: false } },
        y: { ...commonScales.y }
      }
    }
  });
}

/**
 * 贡献者详情卡片 - HTML 渲染
 */
function renderContributorCards(container, authorRanking, stats) {
  const top5 = authorRanking.slice(0, 5);
  const totalCommits = stats.totalCommits || 1;

  container.innerHTML = top5.map((author, index) => {
    const color = getAuthorColor(author.name);
    const bgColor = getAvatarColor(author.name);
    const initial = author.name.charAt(0).toUpperCase();
    const pct = ((author.commits / totalCommits) * 100).toFixed(1);
    const lastCommitStr = author.lastCommit
      ? author.lastCommit.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '--';

    return `<div class="contributor-card" style="--card-color: ${color};">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color};border-radius:12px 12px 0 0;opacity:0.8;"></div>
      <div class="contributor-avatar" style="background:${bgColor};color:${color};border-color:${color};">
        ${initial}
      </div>
      <div class="contributor-info">
        <div class="contributor-name">${author.name}</div>
        <div class="contributor-email">${author.email}</div>
        <div class="contributor-stats">
          <div class="contributor-stat">
            <div class="contributor-stat-value">${author.commits}</div>
            <div class="contributor-stat-label">提交</div>
          </div>
          <div class="contributor-stat">
            <div class="contributor-stat-value" style="color:#3fb950;">+${author.additions.toLocaleString()}</div>
            <div class="contributor-stat-label">新增行</div>
          </div>
          <div class="contributor-stat">
            <div class="contributor-stat-value" style="color:#f85149;">-${author.deletions.toLocaleString()}</div>
            <div class="contributor-stat-label">删除行</div>
          </div>
        </div>
        <div class="contributor-progress">
          <div class="contributor-progress-header">
            <span class="contributor-progress-label">贡献占比</span>
            <span class="contributor-progress-pct">${pct}%</span>
          </div>
          <div class="contributor-progress-bar">
            <div class="contributor-progress-fill" data-width="${pct}" style="background:${color};"></div>
          </div>
        </div>
        <div class="contributor-last-commit">
          活跃 ${author.activeDays} 天 &middot; 最近提交: ${lastCommitStr}
        </div>
      </div>
    </div>`;
  }).join('');

  // Animate progress bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll('.contributor-progress-fill').forEach(el => {
        el.style.width = el.dataset.width + '%';
      });
    }, 100);
  });
}

/**
 * 提交记录列表 - 带类型标签
 */
function renderCommitList(container, commits) {
  const recent = commits.slice(0, 100);
  container.innerHTML = recent.map(c => {
    const color = getAuthorColor(c.author);
    const bgColor = getAvatarColor(c.author);
    const initial = c.author.charAt(0).toUpperCase();
    const dateStr = c.date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const { type, desc } = parseCommitType(c.message);

    return `<div class="commit-item">
      <div class="commit-avatar" style="background:${bgColor};color:${color};">${initial}</div>
      <div class="commit-info">
        <div class="commit-msg" title="${c.message}">
          <span class="commit-type-badge badge-${type}">${type}</span>
          <span>${desc}</span>
        </div>
        <div class="commit-meta">
          <span style="color:${color};">${c.author}</span>
          <span>${dateStr}</span>
          ${c.additions > 0 ? `<span style="color:#3fb950;">+${c.additions}</span>` : ''}
          ${c.deletions > 0 ? `<span style="color:#f85149;">-${c.deletions}</span>` : ''}
        </div>
      </div>
      <span class="commit-hash">${c.hash}</span>
    </div>`;
  }).join('');
}

// ============================================================
// MODULE: App
// ============================================================

const inputSection = document.getElementById('inputSection');
const resultSection = document.getElementById('resultSection');
const gitLogInput = document.getElementById('gitLogInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');
const exportBtn = document.getElementById('exportBtn');
const backBtn = document.getElementById('backBtn');
const toastEl = document.getElementById('toast');
const repoInput = document.getElementById('repoInput');
const fetchBtn = document.getElementById('fetchBtn');
const collapseToggle = document.getElementById('collapseToggle');
const collapseBody = document.getElementById('collapseBody');
const collapseArrow = document.getElementById('collapseArrow');

// 折叠面板
collapseToggle.addEventListener('click', () => {
  const isOpen = !collapseBody.classList.contains('hidden');
  collapseBody.classList.toggle('hidden');
  collapseArrow.classList.toggle('open');
});

// 示例仓库按钮
document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    repoInput.value = btn.dataset.repo;
    fetchBtn.click();
  });
});

// 回车触发分析
repoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchBtn.click();
});

// 主入口：通过 GitHub API 获取数据
fetchBtn.addEventListener('click', async () => {
  let url = repoInput.value.trim();
  if (!url) { showToast('请输入 GitHub 仓库地址'); return; }

  const { owner, repo } = parseRepoUrl(url);
  if (!owner || !repo) {
    showToast('仓库地址格式不正确，例如：https://github.com/vuejs/vue');
    return;
  }

  fetchBtn.disabled = true;
  fetchBtn.style.opacity = '0.6';
  fetchBtn.innerHTML = '获取中...';

  try {
    const commits = await fetchGitHubCommits(owner, repo);
    if (commits.length === 0) {
      showToast('未获取到提交记录，请确认仓库地址正确且为公开仓库');
      return;
    }

    const result = analyzeCommits(commits);
    result._repoName = `${owner}/${repo}`;
    showResults(result);
    showToast(`分析完成！共 ${result.stats.totalCommits} 次提交`);

  } catch (err) {
    console.error('获取失败:', err);
    const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
    if (msg.includes('403') || msg.includes('rate limit')) {
      showToast('GitHub API 请求频率超限，请 60 秒后重试，或使用手动粘贴方式');
    } else if (msg.includes('404')) {
      showToast('仓库不存在或为私有仓库');
    } else {
      showToast('获取失败：' + msg);
    }
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.style.opacity = '1';
    fetchBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> 分析`;
  }
});

/**
 * 解析 GitHub 仓库地址
 */
function parseRepoUrl(url) {
  let match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  match = url.match(/^([^\/]+)\/([^\/]+)$/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  return { owner: null, repo: null };
}

/**
 * 通过 GitHub API 获取所有提交
 */
async function fetchGitHubCommits(owner, repo) {
  const allCommits = [];
  let page = 1;
  const perPage = 100;
  const maxPages = 100;

  while (page <= maxPages) {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const c of data) {
      allCommits.push({
        hash: c.sha.substring(0, 7),
        fullHash: c.sha,
        author: c.commit?.author?.name || c.author?.login || 'Unknown',
        email: c.commit?.author?.email || '',
        date: new Date(c.commit?.author?.date || c.commit?.committer?.date),
        message: c.commit?.message?.split('\n')[0] || '',
        additions: 0,
        deletions: 0,
        filesChanged: 0
      });
    }

    if (data.length < perPage) break;
    page++;

    if (page <= maxPages) {
      await new Promise(r => setTimeout(r, 60000));
    }
  }

  return allCommits;
}

window.copyCommand = function() {
  const cmd = 'git log --all --pretty=format:"%H|%an|%ae|%aI|%s" --shortstat';
  navigator.clipboard.writeText(cmd).then(() => showToast('命令已复制到剪贴板')).catch(() => showToast('复制失败'));
};

analyzeBtn.addEventListener('click', () => {
  const raw = gitLogInput.value.trim();
  if (!raw) { showToast('请先粘贴 Git Log 输出'); return; }
  runAnalysis(raw);
});

demoBtn.addEventListener('click', () => {
  showToast('正在生成示例数据...');
  setTimeout(() => {
    const demo = generateDemoData();
    gitLogInput.value = demo.substring(0, 500) + '\n... (共 ' + demo.split('\n').length + ' 行)';
    runAnalysis(demo);
  }, 300);
});

backBtn.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  exportBtn.classList.add('hidden');
  destroyAllCharts();
});

exportBtn.addEventListener('click', exportReport);

let currentResult = null;

function showResults(result) {
  inputSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  exportBtn.classList.remove('hidden');
  currentResult = result;

  // 更新仓库摘要栏
  const repoNameEl = document.getElementById('repoName');
  const summaryRangeEl = document.getElementById('summaryRange');
  const summaryCommitsEl = document.getElementById('summaryCommits');
  const summaryContribEl = document.getElementById('summaryContrib');

  if (result._repoName) {
    repoNameEl.textContent = result._repoName;
  } else {
    repoNameEl.textContent = 'Git 仓库';
  }

  const s = result.stats;
  if (s.firstDate && s.lastDate) {
    summaryRangeEl.querySelector('span').textContent = `${s.firstDate} ~ ${s.lastDate}`;
  }
  summaryCommitsEl.querySelector('span').textContent = `${s.totalCommits} 次提交`;
  summaryContribEl.querySelector('span').textContent = `${s.totalAuthors} 位贡献者`;

  // 更新统计卡片
  updateStats(s);

  // 渲染所有图表
  setTimeout(() => {
    drawHeatmap(document.getElementById('heatmapCanvas'), result.dailyMap);
    renderTypeChart(document.getElementById('typeChart'), result.commitTypeMap);
    renderMonthlyChart(document.getElementById('monthlyChart'), result.monthlyData);
    renderCodeTrendChart(document.getElementById('codeTrendChart'), result.monthlyData);
    renderContributorCards(document.getElementById('contributorCards'), result.authorRanking, s);
    renderTrendChart(document.getElementById('trendChart'), result.weeklyData);
    renderAuthorChart(document.getElementById('authorChart'), result.authorRanking);
    renderTimeChart(document.getElementById('timeChart'), result.hourlyMap);
    renderWeekdayChart(document.getElementById('weekdayChart'), result.weekdayMap);
    renderCommitList(document.getElementById('commitList'), result.commits);
  }, 100);
}

function runAnalysis(rawLog) {
  try {
    const result = parseGitLog(rawLog);
    if (result.commits.length === 0) { showToast('未解析到有效的提交记录'); return; }
    showResults(result);
    showToast(`分析完成！共 ${result.stats.totalCommits} 次提交`);
  } catch (e) {
    console.error('解析错误:', e);
    showToast('解析出错，请检查 Git Log 格式');
  }
}

function updateStats(stats) {
  animateNumber('totalCommits', stats.totalCommits);
  animateNumber('totalAuthors', stats.totalAuthors);
  animateNumber('totalDays', stats.activeDays);
  animateFloat('avgPerDay', stats.avgPerDay);
  animateNumberSigned('totalAdditions', stats.totalAdditions, '+');
  animateNumberSigned('totalDeletions', stats.totalDeletions, '-');
  animateNumber('totalFiles', stats.totalFiles);
  animateDuration('projectDuration', stats.durationDays);
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const start = performance.now();
  (function update(now) {
    const p = Math.min((now - start) / 800, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(update);
  })(start);
}

function animateNumberSigned(id, target, prefix) {
  const el = document.getElementById(id);
  const start = performance.now();
  (function update(now) {
    const p = Math.min((now - start) / 800, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.floor(target * eased).toLocaleString();
    el.textContent = prefix + val;
    if (p < 1) requestAnimationFrame(update);
  })(start);
}

function animateFloat(id, target) {
  const el = document.getElementById(id);
  const start = performance.now();
  (function update(now) {
    const p = Math.min((now - start) / 800, 1);
    el.textContent = (parseFloat(target) * (1 - Math.pow(1 - p, 3))).toFixed(1);
    if (p < 1) requestAnimationFrame(update);
  })(start);
}

function animateDuration(id, days) {
  const el = document.getElementById(id);
  const start = performance.now();
  (function update(now) {
    const p = Math.min((now - start) / 800, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const current = Math.floor(days * eased);
    if (days >= 365) {
      const years = (current / 365).toFixed(1);
      el.textContent = years + ' 年';
    } else {
      el.textContent = current + ' 天';
    }
    if (p < 1) requestAnimationFrame(update);
  })(start);
}

function exportReport() {
  if (!currentResult) return;
  const s = currentResult.stats;
  const top = currentResult.authorRanking.slice(0, 5);
  let r = `# Git 代码贡献分析报告\n> 生成时间：${new Date().toLocaleString('zh-CN')}\n> Powered by GitInsight (TRAE SOLO)\n\n`;
  r += `## 概览\n\n| 指标 | 数值 |\n|------|------|\n`;
  r += `| 总提交数 | ${s.totalCommits} |\n| 贡献者 | ${s.totalAuthors} |\n| 活跃天数 | ${s.activeDays} |\n`;
  r += `| 日均提交 | ${s.avgPerDay} |\n| 新增代码 | +${s.totalAdditions.toLocaleString()} 行 |\n`;
  r += `| 删除代码 | -${s.totalDeletions.toLocaleString()} 行 |\n| 涉及文件 | ${s.totalFiles} 个 |\n`;
  r += `| 项目持续时间 | ${s.durationDays} 天 |\n\n`;

  // 提交类型分布
  if (currentResult.commitTypeMap) {
    r += `## 提交类型分布\n\n| 类型 | 数量 | 占比 |\n|------|------|------|\n`;
    const total = Object.values(currentResult.commitTypeMap).reduce((a, b) => a + b, 0);
    Object.entries(currentResult.commitTypeMap).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      r += `| ${TYPE_LABELS[type] || type} | ${count} | ${pct}% |\n`;
    });
    r += '\n';
  }

  r += `## 贡献者排行\n\n| 排名 | 作者 | 提交数 | 新增行 | 删除行 | 活跃天数 |\n|------|------|--------|--------|--------|----------|\n`;
  top.forEach((a, i) => { r += `| ${i + 1} | ${a.name} | ${a.commits} | +${a.additions.toLocaleString()} | -${a.deletions.toLocaleString()} | ${a.activeDays} |\n`; });
  r += `\n## 最近提交\n\n`;
  currentResult.commits.slice(0, 30).forEach(c => { r += `- [${c.hash}] ${c.message} (${c.author})\n`; });
  const blob = new Blob([r], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `git-insight-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  showToast('报告已导出');
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2500);
}
