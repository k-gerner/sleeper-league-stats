import assert from 'node:assert/strict'
import { test } from 'node:test'
import { requestSharedContent } from './sharedContentClient.js'

function mockRequests(t, results) {
  const bodies = []
  const signals = []
  let now = 0
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    now += delay
    queueMicrotask(callback)
  })
  t.mock.method(globalThis, 'fetch', async (endpoint, options) => {
    bodies.push(JSON.parse(options.body))
    signals.push(options.signal)
    const result = results.shift()
    assert.ok(result, 'Unexpected extra request')
    now += result.elapsed || 0
    return Response.json(result.body, { status: result.status || 200 })
  })
  return { bodies, signals }
}

for (const endpoint of ['/api/generate-week-copy', '/api/generate-recap']) {
  test(`${endpoint}: returns completed content without polling`, async (t) => {
    const result = { copy: { headline: 'Saved' }, recaps: [{ result: 'Saved' }], cached: true }
    const { bodies } = mockRequests(t, [{ body: result }])
    assert.deepEqual(await requestSharedContent(endpoint, { week: 10 }), result)
    assert.deepEqual(bodies, [{ week: 10, manual: false }])
  })

  for (const manual of [false, true]) {
    test(`${endpoint}: ${manual ? 'manual' : 'automatic'} loading waits until generation finishes`, async (t) => {
      const result = { copy: { headline: 'New' }, recaps: [{ result: 'New' }] }
      const { bodies } = mockRequests(t, [{ body: { generating: true } }, { body: { generating: true } }, { body: result }])
      let waiting = 0
      assert.deepEqual(await requestSharedContent(endpoint, { week: 10, manual }, { onWaiting: () => { waiting += 1 } }), result)
      assert.equal(waiting, 2)
      assert.deepEqual(bodies.map((body) => body.manual), [manual, false, false])
    })
  }

  test(`${endpoint}: stops polling when the selected week changes`, async (t) => {
    const { bodies } = mockRequests(t, [{ body: { generating: true } }])
    let active = true
    const result = await requestSharedContent(endpoint, {}, { isActive: () => active, onWaiting: () => { active = false } })
    assert.equal(result, null)
    assert.equal(bodies.length, 1)
  })

  test(`${endpoint}: a pending response from an old week is ignored`, async (t) => {
    let active = true
    t.mock.method(globalThis, 'fetch', async () => {
      active = false
      return Response.json({ recaps: [{ result: 'Old week' }] })
    })
    assert.equal(await requestSharedContent(endpoint, {}, { isActive: () => active }), null)
  })

  test(`${endpoint}: polling shares one overall deadline`, async (t) => {
    const { bodies } = mockRequests(t, [{ body: { generating: true }, elapsed: 120_000 }])
    await assert.rejects(requestSharedContent(endpoint, {}), /taking longer than expected/)
    assert.equal(bodies.length, 1)
  })

  test(`${endpoint}: surfaces server errors instead of continuing to poll`, async (t) => {
    const { bodies } = mockRequests(t, [{ body: { generating: true } }, { body: { error: 'OpenAI unavailable' }, status: 500 }])
    await assert.rejects(requestSharedContent(endpoint, {}), /OpenAI unavailable/)
    assert.equal(bodies.length, 2)
  })
}
