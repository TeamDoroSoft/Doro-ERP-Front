/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOSS_CLIENT_KEY?: string
  readonly VITE_PUBLIC_APP_ORIGIN?: string
  readonly VITE_KIOSK_APP_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
