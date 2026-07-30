// TapTap 小游戏打包脚本
// 规范：zip 解压后第一级仅一个英文/数字命名的文件夹，文件夹内含 index.html
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, renameSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const staging = resolve(root, '.taptap-staging');
const innerName = 'autobattler-mvp'; // 仅英文/数字
const innerDir = resolve(staging, innerName);
const zipPath = resolve(root, 'autobattler-mvp.zip');

if (!existsSync(distDir)) {
  console.error('未找到 dist 目录，请先执行 npm run build');
  process.exit(1);
}

// 清理旧产物
rmSync(staging, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(innerDir, { recursive: true });

// 复制构建产物到内层目录
cpSync(distDir, innerDir, { recursive: true });

if (!existsSync(resolve(innerDir, 'index.html'))) {
  console.error('打包失败：内层目录缺少 index.html');
  process.exit(1);
}

// 使用 zip 命令打包（第一级为 autobattler-mvp 文件夹）
try {
  execFileSync('zip', ['-r', zipPath, innerName], {
    cwd: staging,
    stdio: 'inherit',
  });
} catch {
  console.error('zip 命令执行失败，请确保系统已安装 zip');
  process.exit(1);
}

// 清理暂存目录
rmSync(staging, { recursive: true, force: true });
console.log(`\n✅ TapTap 小游戏包已生成：${zipPath}`);
console.log('   上传至 TapTap 开发者中心 >> 商店 >> 创建小游戏 >> 上传包体');
