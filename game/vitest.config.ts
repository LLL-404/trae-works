import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 单元测试目录
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/game/**/*.ts', 'src/data/**/*.ts'],
      exclude: ['**/*.d.ts'],
    },
  },
});
