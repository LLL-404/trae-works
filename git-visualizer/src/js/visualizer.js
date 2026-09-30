/**
 * 可视化渲染模块
 * 负责所有图表绘制（热力图、Chart.js 图表、贡献者卡片、提交列表）
 */

// 图表实例，用于销毁和重建
let trendChartInstance = null;
let authorChartInstance = null;
let timeChartInstance = null;
let weekdayChartInstance = null;
let typeChartInstance = null;
let codeTrendChartInstance = null;
let monthlyChartInstance = null;

// 提交类型颜色映射
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

// 通用 tooltip 配置
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

// 通用坐标轴配置
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
 * 销毁所有图表实例，防止内存泄漏
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
 * 绘制贡献热力图（Canvas 自绘）
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

  // 进度条动画
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
