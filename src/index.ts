import { Hono } from 'hono'

const MODEL_ID = 'xai/grok-imagine-image-quality'
const MAX_IMAGE_SIZE = 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

type AiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

type Bindings = {
  AI: AiBinding
}

type ModelResponse = {
  image: string
}

type ModelEnvelope = {
  state?: string
  result?: ModelResponse
  image?: string
}

function describeValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return { type: 'string', length: value.length }
  }

  if (value === null || typeof value !== 'object') {
    return { type: typeof value, value }
  }

  if (depth >= 2) {
    return { type: Array.isArray(value) ? 'array' : 'object' }
  }

  if (Array.isArray(value)) {
    return value.map((item) => describeValue(item, depth + 1))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      describeValue(item, depth + 1),
    ]),
  )
}

const app = new Hono<{ Bindings: Bindings }>()

function getSingleFile(value: unknown): File | undefined {
  return value instanceof File ? value : undefined
}

function validateImage(file: File, fieldName: string): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `${fieldName} must be a JPEG or PNG image`
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `${fieldName} must be 1 MiB or smaller`
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
}

async function toDataUri(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return `data:${file.type};base64,${bytesToBase64(bytes)}`
}

async function normalizeGeneratedImage(image: string): Promise<string> {
  if (image.startsWith('data:image/')) {
    return image
  }

  let url: URL

  try {
    url = new URL(image)
  } catch {
    throw new Error('The model returned an invalid image value')
  }

  if (url.protocol !== 'https:') {
    throw new Error('The model returned an unsupported image URL')
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Unable to download the generated image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]

  if (!contentType?.startsWith('image/')) {
    throw new Error('The generated image has an invalid content type')
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  return `data:${contentType};base64,${bytesToBase64(bytes)}`
}

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello Hono!' })
})

app.post('/api/poker/image', async (c) => {
  const contentType = c.req.header('content-type') ?? ''

  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return c.json(
      { success: false, message: 'Content-Type must be multipart/form-data' },
      415,
    )
  }

  let body: Awaited<ReturnType<typeof c.req.parseBody>>

  try {
    body = await c.req.parseBody({ all: true })
  } catch {
    return c.json({ success: false, message: 'Invalid multipart form data' }, 400)
  }

  const personImage = getSingleFile(body.personImage)
  const clothingImage = getSingleFile(body.clothingImage)

  if (!personImage) {
    return c.json(
      { success: false, message: 'personImage must be provided exactly once' },
      400,
    )
  }

  if (body.clothingImage !== undefined && !clothingImage) {
    return c.json(
      { success: false, message: 'clothingImage must be provided at most once' },
      400,
    )
  }

  for (const [fieldName, file] of [
    ['personImage', personImage],
    ['clothingImage', clothingImage],
  ] as const) {
    if (!file) continue

    const validationMessage = validateImage(file, fieldName)
    if (validationMessage) {
      const status = file.size > MAX_IMAGE_SIZE ? 413 : 415
      return c.json({ success: false, message: validationMessage }, status)
    }
  }

  const prompt = clothingImage
    ? 'Make the person in Image 1 wear the clothing shown in Image 2, then depict the person flying.'
    : 'Depict the person in Image 1 flying.'

  try {
    const images = [{ url: await toDataUri(personImage) }]

    if (clothingImage) {
      images.push({ url: await toDataUri(clothingImage) })
    }

    const result = await c.env.AI.run(MODEL_ID, {
      prompt,
      images,
      aspect_ratio: '3:4',
      quality: 'low',
      resolution: '1k',
      response_format: 'b64_json',
    })

    if (typeof result !== 'object' || result === null) {
      console.error('Unexpected AI response shape', describeValue(result))
      throw new Error('The model returned an invalid response')
    }

    const envelope = result as ModelEnvelope
    const modelImage = envelope.result?.image ?? envelope.image

    if (
      (envelope.state !== undefined && envelope.state !== 'Completed') ||
      typeof modelImage !== 'string' ||
      !modelImage
    ) {
      console.error('Unexpected AI response shape', describeValue(result))
      throw new Error('The model returned an invalid response')
    }

    const image = await normalizeGeneratedImage(modelImage)

    return c.json({
      success: true,
      object: { image },
    })
  } catch (error) {
    console.error('Poker image generation failed', error)
    return c.json({ success: false, message: 'Image generation failed' }, 502)
  }
})

export default app
