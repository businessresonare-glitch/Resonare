/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HERO_VIDEO_URL?: string;
  readonly VITE_SITE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
