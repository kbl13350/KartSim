import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mockApi } from './dev/mock.ts'

// The data service serves the built SPA at /multiplayer/admin/ under a strict
// CSP (script-src 'self', no eval): templates are precompiled by
// @vitejs/plugin-vue, the runtime-only Vue build is used, and nothing is
// inlined as a data: URL.
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

const backend = 'http://127.0.0.1:8797'

export default defineConfig(({ mode }) => {
  // `--mode mock` answers the admin API from dev/mock.ts (dev server and
  // preview) and serves the preview with the production CSP. It is never
  // part of the build output.
  const mock = mode === 'mock'
  return {
    base: '/multiplayer/admin/',
    plugins: [vue(), ...(mock ? [mockApi()] : [])],
    build: {
      outDir: '../internal/data/api/adminui',
      emptyOutDir: true,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1500,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vue', test: /[\\/]node_modules[\\/](vue|@vue)[\\/]/, priority: 20 },
              { name: 'element-plus', test: /[\\/]node_modules[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
    server: {
      port: 5173,
      // Everything under /multiplayer goes to the data service except the
      // SPA itself (/multiplayer/admin/...); the invite endpoint
      // /multiplayer/admin/invites is the data service's.
      proxy: mock ? undefined : {
        '/api': { target: backend, ws: true },
        '^/multiplayer/(?!admin/(?!invites))': { target: backend },
      },
    },
    preview: {
      port: 5174,
      headers: mock ? { 'Content-Security-Policy': csp } : undefined,
    },
  }
})
