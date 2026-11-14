import { generateSharedBanner } from '../server/sharedContent.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to generate weekly copy.' })
  try {
    const result = await generateSharedBanner(req.body || {}, process.env)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Weekly copy generation failed.' })
  }
}
