import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.ts', 'test/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**/*',
        'src/models/**/*',
      ],
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    conditions: ['node', 'import'],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
})
