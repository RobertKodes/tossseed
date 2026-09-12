/// <reference types="vitest" />
import { copyFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/tossseed/',
  plugins: [
    {
      name: 'pages-static',
      closeBundle() {
        writeFileSync('dist/.nojekyll', '')
        copyFileSync('dist/index.html', 'dist/404.html')
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
