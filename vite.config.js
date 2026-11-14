import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { generateSharedRecaps, generateSharedBanner } from './server/sharedContent.js'

function apiDevEndpoints(env) {
  return {
    name: 'shared-content-dev-endpoints',
    configureServer(server) {
      const endpoints = [
        ['/api/generate-recap', generateSharedRecaps, 'Use POST to generate a recap.'],
        ['/api/generate-week-copy', generateSharedBanner, 'Use POST to generate weekly copy.'],
      ]
      for (const [path, generate, methodError] of endpoints) server.middlewares.use(path, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: methodError }))
          return
        }
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const result = await generate(JSON.parse(raw || '{}'), { ...process.env, ...env })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message || 'Generation failed.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), apiDevEndpoints(loadEnv(mode, process.cwd(), ''))],
}))
