import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// __dirname is not available in ESM; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Match package boundaries on both Windows and POSIX paths.
          const modulePath = id.replace(/\\/g, '/')
          if (!modulePath.includes('/node_modules/')) return

          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(modulePath)) return 'react-vendor'
          if (/\/node_modules\/(react-router|react-router-dom)\//.test(modulePath)) return 'router'
          if (/\/node_modules\/(recharts|recharts-scale|d3-[^/]+|victory-vendor)\//.test(modulePath)) return 'charts'
          if (/\/node_modules\/(framer-motion|motion|motion-dom|motion-utils)\//.test(modulePath)) return 'motion'
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
