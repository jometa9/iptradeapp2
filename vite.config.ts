import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // Exclude server files and config files from triggering hot reload
      ignored: [
        '**/server/**',
        '**/config/**',
        '**/*.json',
        '**/node_modules/**',
      ],
    },
  },
})
