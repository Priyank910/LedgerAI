import type { IncomingMessage } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function rewriteDesignOptions(request: IncomingMessage) {
  const url = request.url ?? ''
  const path = url.split('?')[0]
  if (path === '/design-options' || path.startsWith('/design-options/')) request.url = '/design.html'
}

function designOptionsPlugin(): Plugin {
  return {
    name: 'design-options',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        rewriteDesignOptions(request)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        rewriteDesignOptions(request)
        next()
      })
    },
  }
}

export default defineConfig(() => {
  return {
    plugins: [designOptionsPlugin(), react()],
    build: { rollupOptions: { input: 'index.html' } },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
    },
  }
})
