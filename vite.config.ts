import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // Get server port from environment variable or default to 7777
  const serverPort = env.VITE_SERVER_PORT || env.PORT || '7777'

  return {
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
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // Make environment variables available to the app with VITE_ prefix
    define: {
      'import.meta.env.VITE_SERVER_PORT': JSON.stringify(serverPort),
    },
  }
})
