import { generateWeekCopy } from '../server/generateRecap.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to generate weekly copy.' })
  try {
    const copy = await generateWeekCopy(req.body || {}, {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
    })
    return res.status(200).json({ copy })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Weekly copy generation failed.' })
  }
}
