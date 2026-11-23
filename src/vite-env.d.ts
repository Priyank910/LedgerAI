/// <reference types="vite/client" />

declare module 'regenerator-runtime' {
  const regeneratorRuntime: unknown
  export default regeneratorRuntime
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_LLM_MODE?: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
