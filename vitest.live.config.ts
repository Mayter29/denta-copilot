import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'vitest/config';
if (existsSync('.env.local')) loadEnvFile('.env.local');
export default defineConfig({
  test: {
    reporters: ['verbose'],
    include: ['evals/*.live.test.ts'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
  },
});
