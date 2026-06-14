import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    root: '.',
    passWithNoTests: true,
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
  plugins: [swc.vite()],
});
