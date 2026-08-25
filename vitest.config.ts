import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      maxWorkers: 2,
      exclude: [...configDefaults.exclude, 'e2e/**', 'admin-e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
