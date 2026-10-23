import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of [
    'DATABASE_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_PRO_PRICE',
    'FEDAPAY_SECRET',
    'FEDAPAY_SECRET_KEY',
    'FEDAPAY_API_URL',
  ]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key]
  }

  return {
  plugins: [
    tailwindcss(),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    // Required: this project uses TanStack Start file routes and its SSR server entry.
    tanstackStart({ srcDirectory: 'src' }),
    nitro(),
    viteReact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'icons.svg'],
      manifest: {
        name: 'FactureFlash',
        short_name: 'FactureFlash',
        description: 'Gestion de facturation et suivi financier',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  }
})