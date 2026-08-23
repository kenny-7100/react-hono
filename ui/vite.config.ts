import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { buildMetadataPlugin } from './vite/build-metadata.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    buildMetadataPlugin(),
  ],
  build: {
    cssMinify: 'esbuild',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
