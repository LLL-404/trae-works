/**
 * Git 日志解析模块
 * 负责解析 git log 输出、生成示例数据、分析提交统计
 */

/**
 * 解析 git log 原始文本，返回结构化分析结果
 */
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

/**
 * 分析提交数据，生成统计指标
 */
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

/**
 * 生成模拟数据，用于演示
 */
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

/**
 * 根据作者名生成一致的颜色
 */
function getAuthorColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const colors = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#79c0ff','#56d364','#e3b341','#ff7b72','#d2a8ff','#39d353','#db6d28','#f778ba','#a5d6ff','#7ee787'];
  return colors[Math.abs(h) % colors.length];
}

function getAvatarColor(name) { return getAuthorColor(name) + '33'; }
