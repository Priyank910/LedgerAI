import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { aiDevPlugin } from './vite.ai-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), aiDevPlugin(env.GEMINI_API_KEY, env.GEMINI_MODEL)],
    server: { host: '0.0.0.0', port: 5173 },
  }
})
