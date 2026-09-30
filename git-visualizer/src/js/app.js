/**
 * 应用交互模块
 * 负责 UI 事件绑定、数据获取、结果展示、报告导出
 */

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

// 复制命令
window.copyCommand = function() {
  const cmd = 'git log --all --pretty=format:"%H|%an|%ae|%aI|%s" --shortstat';
  navigator.clipboard.writeText(cmd).then(() => showToast('命令已复制到剪贴板')).catch(() => showToast('复制失败'));
};

// 手动粘贴分析
analyzeBtn.addEventListener('click', () => {
  const raw = gitLogInput.value.trim();
  if (!raw) { showToast('请先粘贴 Git Log 输出'); return; }
  runAnalysis(raw);
});

// 示例数据
demoBtn.addEventListener('click', () => {
  showToast('正在生成示例数据...');
  setTimeout(() => {
    const demo = generateDemoData();
    gitLogInput.value = demo.substring(0, 500) + '\n... (共 ' + demo.split('\n').length + ' 行)';
    runAnalysis(demo);
  }, 300);
});

// 返回
backBtn.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  exportBtn.classList.add('hidden');
  destroyAllCharts();
});

// 导出
exportBtn.addEventListener('click', exportReport);

let currentResult = null;

/**
 * 展示分析结果
 */
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

// ===== 数字动画 =====

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

// ===== 报告导出 =====

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

// ===== Toast 提示 =====

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2500);
}
