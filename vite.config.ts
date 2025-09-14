import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  esbuild: {
    // Disable TypeScript type checking during build
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    target: 'es2020',
    // Skip type checking entirely
    tsconfigRaw: {
      compilerOptions: {
        skipLibCheck: true,
        noEmit: true,
        isolatedModules: true,
        allowSyntheticDefaultImports: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        strict: false,
        noImplicitAny: false
      }
    }
  },
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
    proxy: {
      '/api': {
        target: 'http://localhost:30',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
