export const WORKER_BASE = import.meta.env.VITE_WORKER_URL ||
  (import.meta.env.DEV ? 'http://localhost:8787' : 'https://el-impostor-worker-production.jvallejoarguez.workers.dev')
export const APP_VERSION = 'growth-2026-09-06'
