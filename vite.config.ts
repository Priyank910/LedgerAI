import type { IncomingMessage } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { aiDevPlugin } from './vite.ai-plugin'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [designOptionsPlugin(), react(), aiDevPlugin(env.GEMINI_API_KEY, env.GEMINI_MODEL)],
    server: { host: '0.0.0.0', port: 5173 },
  }
})
