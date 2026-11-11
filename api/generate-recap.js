import { generateRecap } from '../server/generateRecap.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to generate a recap.' })
  console.info('[generate-recap] environment check', {
    openaiApiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    openaiModelPresent: Boolean(process.env.OPENAI_MODEL),
  })
  try {
    const recaps = await generateRecap(req.body || {}, process.env)
    return res.status(200).json({ recaps })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Recap generation failed.' })
  }
}
