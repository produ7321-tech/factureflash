import { defineConfig } from 'vinxi'
import { tanstackStart } from '@tanstack/react-start/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      prerender: {
        crawlLinks: true,
        failOnError: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
