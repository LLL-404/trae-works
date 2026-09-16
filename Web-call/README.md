# FaceLink · 网页视频通话与会议

> 基于 WebRTC 的网页端面对面视频通话应用，支持 1对1 私密通话和最多 6 人多人会议，无需注册、无需安装，发送链接即可开始。

## ✨ 功能特性

- 🤝 **私密通话** — 1对1 面对面视频通话
- 👥 **多人会议** — 最多 6 人同时视频，Mesh P2P 架构
- 🔗 **发链接即通话** — 无需注册/安装，打开链接直接加入
- 👑 **主持人管理** — 可静音/移出参会者
- 🔒 **端对端加密** — WebRTC，视频流不经服务器
- 🔇 **默认关闭** — 摄像头/麦克风默认关闭，按需开启
- 📱 **响应式设计** — 手机/电脑均可使用
- 🔒 **防重入保护** — 所有异步操作均有锁机制

## 🚀 使用方式

1. 用 HTTP 服务器打开 `video-call.html`（需要 HTTPS 或 localhost）
2. 选择「私密通话」或「多人会议」模式
3. 点击「创建房间」→ 复制链接发给对方
4. 对方打开链接即可通话

```bash
# 本地启动
python3 -m http.server 8080
# 打开 http://localhost:8080/video-call.html
```

## 🛠 技术栈

| 技术 | 说明 |
|------|------|
| 前端 | 纯 HTML + CSS + JavaScript（单文件，无框架依赖） |
| 视频通信 | WebRTC（端对端加密） |
| 信令服务 | PeerJS（开源公共服务器，无需自建） |
| 多人架构 | Mesh P2P（每人与所有人直连） |
| 数据通道 | PeerJS Data Channel（参会者列表同步、主持人指令） |

## 📁 文件结构

```
├── video-call.html          # 主应用（单文件，约 1200 行）
├── README.md                # 项目说明
├── server/                  # 自建信令服务器代码
│   ├── package.json
│   ├── server.js
│   └── .gitignore
└── FaceLink-SOLO挑战赛参赛作品.docx  # 参赛帖子文档
```

## 📜 License

MIT

---

## 🚀 自建信令服务器部署（推荐国内用户）

PeerJS 公共服务器在海外，国内连接不稳定。建议部署自己的信令服务器到 Render.com（免费、国内可直连）。

### 部署步骤

1. **注册 Render.com 账号**
   - 访问 https://render.com 注册（支持 GitHub 登录）

2. **创建 GitHub 仓库**
   - 将 `server/` 文件夹推送到 GitHub

3. **在 Render.com 创建 Web 服务**
   - 点击 "New" → "Web Service"
   - 连接你的 GitHub 仓库
   - 选择 `server/` 目录
   - Render 会自动检测 `package.json` 并部署

4. **获取服务器地址**
   - 部署完成后，Render 会给你一个地址，如 `https://facelink-server.onrender.com`

5. **修改前端配置**
   - 打开 `video-call.html`
   - 找到 `const CUSTOM_PEER_SERVER = '';`
   - 填入你的服务器地址：`const CUSTOM_PEER_SERVER = 'https://facelink-server.onrender.com';`

### 注意事项
- Render 免费套餐会在 15 分钟无流量后休眠，首次唤醒约需 30-60 秒
- WebSocket 长连接会保持服务活跃，通话期间不会休眠
- 建议绑定自定义域名以获得更好的稳定性