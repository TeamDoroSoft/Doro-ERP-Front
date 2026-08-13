import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const env = loadEnv('development', process.cwd(), 'VITE_EDGE_PROXY_TARGET')
const edgeProxyTarget = env.VITE_EDGE_PROXY_TARGET?.trim() || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: edgeProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
