import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { generateRecap, generateWeekCopy } from './server/generateRecap.js'

function recapDevEndpoint(env) {
  return {
    name: 'recap-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/generate-recap', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Use POST to generate a recap.' }))
          return
        }
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const recaps = await generateRecap(JSON.parse(raw || '{}'), {
            apiKey: env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL,
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ recaps }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message || 'Recap generation failed.' }))
        }
      })
    },
  }
}

function weekCopyDevEndpoint(env) {
  return {
    name: 'week-copy-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/generate-week-copy', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Use POST to generate weekly copy.' }))
          return
        }
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const copy = await generateWeekCopy(JSON.parse(raw || '{}'), {
            apiKey: env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL,
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ copy }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message || 'Weekly copy generation failed.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), recapDevEndpoint(loadEnv(mode, process.cwd(), '')), weekCopyDevEndpoint(loadEnv(mode, process.cwd(), ''))],
}))
