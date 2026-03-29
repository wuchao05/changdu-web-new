/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEBUG_DRAWER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
