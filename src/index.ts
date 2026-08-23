import { Hono } from 'hono'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello Hono!' })
})

app.post('/api/ai/dream/generate', async (c) => {
  const input = await c.req.json()
  const response = await c.env.AI.run('bytedance/seedance-2.0-mini', input)

  return c.json(response)
})

app.post('/api/ai/image/generate', async (c) => {
  const input = await c.req.json()
  const response = await c.env.AI.run('bytedance/seedream-5-lite', input)

  return c.json(response)
})

export default app
