import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vite.dev/config/
export default defineConfig({
  base: '/double-move-chess/',
  plugins: [
    react()
  ],
  build: {
    target: 'esnext',
    outDir: 'docs',
    emptyOutDir: true,
  },
})
