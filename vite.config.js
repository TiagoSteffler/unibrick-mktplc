import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['blue_logo_app.png'],
        manifest: {
          name: 'UniBrik',
          short_name: 'UniBrik',
          description: 'Marketplace',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'blue_logo_app.png',
              sizes: '512x512',
              type: 'image/png'
            },
          ]
        }
      })
    ],
  }
})
