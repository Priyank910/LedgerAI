/// <reference types="vite/client" />

declare module 'regenerator-runtime' {
  const regeneratorRuntime: unknown
  export default regeneratorRuntime
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_AI_PROXY_URL?: string
  readonly VITE_LLM_MODE?: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
