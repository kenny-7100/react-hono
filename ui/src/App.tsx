import { useEffect, useId, useState, type ChangeEvent } from 'react'
import './App.css'

const MAX_IMAGE_SIZE = 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

type ApiResponse = {
  success: boolean
  object?: { image?: string }
  message?: string
}

type ImageFieldProps = {
  label: string
  description: string
  required?: boolean
  file: File | null
  onChange: (file: File | null) => void
  onError: (message: string) => void
}

function ImageField({
  label,
  description,
  required = false,
  file,
  onChange,
  onError,
}: ImageFieldProps) {
  const inputId = useId()
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile) return

    if (!ALLOWED_IMAGE_TYPES.has(selectedFile.type)) {
      onError('Only JPEG and PNG images are supported.')
      return
    }

    if (selectedFile.size > MAX_IMAGE_SIZE) {
      onError('Each image must be 1 MiB or smaller.')
      return
    }

    onError('')
    onChange(selectedFile)
  }

  return (
    <section className={`image-field${file ? ' has-image' : ''}`}>
      <div className="field-heading">
        <h2>{label}</h2>
        <span className={`requirement${required ? ' required' : ''}`}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>

      {file && previewUrl ? (
        <div className="image-preview">
          <img src={previewUrl} alt={`${label} preview`} />
          <button
            type="button"
            className="remove-image"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label.toLowerCase()}`}
            title="Remove image"
          >
            &times;
          </button>
          <label className="replace-image" htmlFor={inputId}>
            Replace
          </label>
        </div>
      ) : (
        <label className="upload-area" htmlFor={inputId}>
          <span className="upload-icon" aria-hidden="true">+</span>
          <span className="upload-title">Choose an image</span>
          <span className="upload-description">{description}</span>
        </label>
      )}

      <input
        id={inputId}
        className="file-input"
        type="file"
        accept="image/jpeg,image/png"
        onChange={selectFile}
      />
    </section>
  )
}

function App() {
  const [personImage, setPersonImage] = useState<File | null>(null)
  const [clothingImage, setClothingImage] = useState<File | null>(null)
  const [generatedImage, setGeneratedImage] = useState('')
  const [message, setMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)

  useEffect(() => {
    if (!isResultModalOpen) return

    const previousOverflow = document.body.style.overflow

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsResultModalOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isResultModalOpen])

  function updatePersonImage(file: File | null) {
    setPersonImage(file)
    setGeneratedImage('')
    setIsResultModalOpen(false)

    if (!file) {
      setClothingImage(null)
    }
  }

  function updateClothingImage(file: File | null) {
    setClothingImage(file)
    setGeneratedImage('')
    setIsResultModalOpen(false)
  }

  async function generateImage() {
    if (!personImage) {
      setMessage('Add a person image before generating.')
      return
    }

    setIsGenerating(true)
    setMessage('')
    setGeneratedImage('')
    setIsResultModalOpen(false)

    const formData = new FormData()
    formData.append('personImage', personImage)
    if (clothingImage) formData.append('clothingImage', clothingImage)

    try {
      const response = await fetch('/api/poker/image', {
        method: 'POST',
        body: formData,
      })
      const data = (await response.json()) as ApiResponse
      const image = data.object?.image

      if (!response.ok || !data.success || !image) {
        throw new Error(data.message || 'Image generation failed.')
      }

      setGeneratedImage(image)
      if (window.matchMedia('(max-width: 820px)').matches) {
        setIsResultModalOpen(true)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="workspace">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">P</div>
        <div>
          <h1>Poker Image Studio</h1>
          <p>Create a flying portrait from one or two references.</p>
        </div>
      </header>

      <div className="studio-layout">
        <section className="input-panel">
          <ImageField
            label="Person"
            description="JPEG or PNG, up to 1 MiB"
            required
            file={personImage}
            onChange={updatePersonImage}
            onError={setMessage}
          />

          {personImage && (
            <ImageField
              label="Clothing"
              description="Add an outfit reference if needed"
              file={clothingImage}
              onChange={updateClothingImage}
              onError={setMessage}
            />
          )}

          {message && <p className="message" role="alert">{message}</p>}

          <button
            type="button"
            className="generate-button"
            onClick={generateImage}
            disabled={!personImage || isGenerating}
          >
            {isGenerating ? (
              <><span className="spinner" aria-hidden="true" />Generating</>
            ) : 'Generate image'}
          </button>
        </section>

        <section className="output-panel" aria-live="polite">
          <h2>Generated image</h2>
          <div className="result-canvas">
            {isGenerating ? (
              <div className="result-loading">
                <span className="spinner large" aria-hidden="true" />
                <span>Creating your image...</span>
              </div>
            ) : generatedImage ? (
              <img src={generatedImage} alt="Generated flying portrait" />
            ) : (
              <span className="empty-result">No image yet</span>
            )}
          </div>
        </section>
      </div>

      {isResultModalOpen && generatedImage && (
        <div
          className="result-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsResultModalOpen(false)
            }
          }}
        >
          <div
            className="result-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Generated image"
          >
            <button
              type="button"
              className="close-modal"
              onClick={() => setIsResultModalOpen(false)}
              aria-label="Close generated image"
              title="Close"
              autoFocus
            >
              &times;
            </button>
            <img
              className="result-modal-image"
              src={generatedImage}
              alt="Generated flying portrait"
            />
          </div>
        </div>
      )}
    </main>
  )
}

export default App
