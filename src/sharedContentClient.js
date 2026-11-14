const REQUEST_BUDGET_MS = 120_000
const POLL_INTERVAL_MS = 1500

export async function requestSharedContent(endpoint, requestBody, { isActive = () => true, onWaiting = () => {} } = {}) {
  const deadline = Date.now() + REQUEST_BUDGET_MS
  let manual = requestBody.manual === true
  while (isActive()) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Content generation is taking longer than expected. Please try again shortly.')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(remaining),
      body: JSON.stringify({ ...requestBody, manual }),
    })
    const body = await response.json().catch(() => ({}))
    if (!isActive()) return null
    if (!response.ok) throw new Error(body.error || 'Content generation failed.')
    if (!body.generating) return body
    onWaiting(body)
    await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now()))))
    // A poll must never force another generation or restart the request budget.
    manual = false
  }
  return null
}
