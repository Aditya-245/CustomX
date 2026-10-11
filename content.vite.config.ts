import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// Content script build: single IIFE bundle (content scripts cannot use ES module imports).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
      output: {
        format: 'iife',
        entryFileNames: 'content.js'
      }
    }
  }
})
