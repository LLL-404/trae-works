/**
 * FaceLink 信令服务器
 * 基于 PeerJS Server，用于 WebRTC 点对点连接的信令中转
 * 部署到 Render.com 免费套餐即可使用
 * 
 * 功能：
 * - 为 PeerJS 客户端分配唯一 ID
 * - 中转 WebRTC 握手信令（SDP offer/answer、ICE candidate）
 * - 中转数据通道消息（参会者列表、控制指令等）
 * 
 * 注意：媒体流（音视频）不经过此服务器，直接在浏览器之间 P2P 传输
 */

const { PeerServer } = require('peer');

// 从环境变量读取端口，Render.com 会自动设置 PORT 环境变量
const PORT = process.env.PORT || 9000;

// 创建 PeerJS 信令服务器
const server = PeerServer({
    port: PORT,
    path: '/myapp',          // 信令路径，前端需匹配
    allow_discovery: false,   // 禁用房间发现，提高安全性
    alive_timeout: 60000,     // 客户端心跳超时（60秒）
    key: 'facelink',          // 服务标识
    cleanup_out_msgs: 1,      // 清理离线消息队列
    concurrent_limit: 5000,   // 最大并发连接数
});

server.on('connection', (client) => {
    console.log(`[连接] 新客户端: ${client.getId()}`);
});

server.on('disconnect', (client) => {
    console.log(`[断开] 客户端离线: ${client.getId()}`);
});

server.on('error', (error) => {
    console.error('[错误]', error);
});

console.log(`========================================`);
console.log(`  FaceLink 信令服务器已启动`);
console.log(`  端口: ${PORT}`);
console.log(`  路径: /myapp`);
console.log(`========================================`);
