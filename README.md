# GitInsight

【Code with SOLO】用 SOLO 搭建 GitInsight — 一键可视化分析 Git 代码贡献，让团队协作数据一目了然。

在浏览器中输入 GitHub 公开仓库地址，即可生成多维度贡献分析图表，并支持导出 Markdown 分析报告。TRAE「Code with SOLO」竞赛参赛作品。

## ✨ 功能特性

- 📈 **提交趋势图** — 按时间维度展示提交活跃度
- 👥 **贡献者统计** — 各成员提交量与占比
- 🔥 **提交热力图** — 直观呈现提交密度分布
- 🏷️ **提交类型分布** — feat / fix / docs 等类型占比
- 📄 **报告导出** — 一键生成 Markdown 分析报告

## 🛠 技术栈

| 模块 | 说明 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript 单页应用，无框架依赖 |
| 图表 | Chart.js 4.4.0（CDN 引入） |
| 数据源 | GitHub REST API（分页拉取 commits） |

## 📁 项目结构

```
git-visualizer/
├── src/
│   ├── index.html        # 页面入口
│   ├── style.css         # 样式
│   └── js/
│       ├── app.js        # 交互主逻辑
│       ├── parser.js     # git log 解析与统计
│       └── visualizer.js # 图表渲染
└── docs/                 # 参赛相关文档与分析报告样例
```

## 🚀 使用方式

纯静态页面，直接用浏览器打开 `git-visualizer/src/index.html`，或启动本地服务：

```bash
cd git-visualizer/src
python -m http.server 8080
# 打开 http://localhost:8080
```

输入 GitHub 公开仓库地址（如 `https://github.com/xxx/yyy`）即可开始分析。
