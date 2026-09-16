# trae-works — TRAE SOLO 作品合集

> 用 TRAE SOLO 从零生成的项目合集，各项目以子目录隔离，完整提交历史保留。

## 项目一览

| 目录 | 项目 | 简介 | 技术栈 | 原仓库 |
|---|---|---|---|---|
| `signbridge/` | 手语桥 SignBridge | AI 驱动的双向手语翻译系统，打破听障与健听人士的沟通壁垒（含 MediaPipe 手势/姿态模型） | JavaScript + MediaPipe | ~~LLL-404/signbridge~~ |
| `game/` | 3D 自走棋肉鸽 | 3D PVE 自走棋肉鸽 MVP，含 Playwright 测试 | Three.js + TypeScript + Vite | ~~LLL-404/game~~ |
| `GitInsight/` | GitInsight | 【Code with SOLO】一键可视化分析 Git 代码贡献，团队协作数据一目了然 | Git 可视化 | ~~LLL-404/GitInsight~~ |
| `Web-call/` | FaceLink | WebRTC 网页视频通话，1对1 私密通话 + 最多 6 人会议，无需注册发链接即用，SOLO 挑战赛参赛作品 | WebRTC | ~~LLL-404/Web-call~~ |

## 说明

- 各项目提交历史完整保留，路径已重写至对应子目录（`git log --follow <子目录>/...` 可全程追溯）
- `game` 仓库历史中的敏感凭据文件已彻底抹除（全历史字节级扫描零残留）
- 原仓库已删除，本仓库为唯一权威版本

## 快速开始

```bash
# 每个项目独立可运行，进入对应目录查看各自 README
cd signbridge/   # AI 手语翻译
cd game/         # 3D 自走棋肉鸽
cd GitInsight/   # Git 贡献可视化
cd Web-call/     # FaceLink 视频通话
```
