# 网页通讯（Web-call）

> 本仓库的主项目为 **FaceLink · 网页视频通话与会议**，全部源码与完整文档位于 [`server/`](./server/) 目录。

基于 WebRTC 的网页端面对面视频通话应用：支持 1 对 1 私密通话与最多 6 人 Mesh P2P 会议，无需注册、无需安装，发送链接即可开始。

- 📄 完整文档：[`server/README.md`](./server/README.md)（功能特性、使用方式、技术栈、文件结构）
- 🌐 入口页面：`server/video-call.html`（纯 HTML/JS 单文件，无框架依赖）
- 📡 信令服务：PeerJS（`server/server.js`，Node.js 启动）

> ⚠️ 本目录内另存有 Kali 镜像、Rufus、mtkclient、platform-tools、WiFiTool 等本地工具文件，与项目无关，已通过 `.gitignore` 排除在仓库之外。
