import { useState, type FormEvent } from 'react'
import styles from './index.module.scss'

const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'] as const

type GenerateResponse = {
  state: string
  result?: {
    video?: string
  }
}

function optionalString(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function DreamGenerate() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const [hasStartImage, setHasStartImage] = useState(false)
  const [hasReferenceImages, setHasReferenceImages] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const image = optionalString(formData, 'image')
    const referenceVideo = optionalString(formData, 'reference_video')
    const lastFrameImage = optionalString(formData, 'last_frame_image')
    const referenceAudio = optionalString(formData, 'reference_audio')
    const referenceImages = formData
      .getAll('reference_images')
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .map((value) => value.trim())

    if (referenceImages.length > 0 && (image || lastFrameImage)) {
      setError('参考图片组不能与首帧或尾帧图片同时使用。')
      return
    }

    if (lastFrameImage && !image) {
      setError('使用尾帧图片时必须同时提供首帧图片。')
      return
    }

    if (referenceAudio && !image && !referenceVideo && referenceImages.length === 0) {
      setError('使用参考音频时必须同时提供参考图片或参考视频。')
      return
    }

    const seed = optionalString(formData, 'seed')
    const payload = {
      prompt: String(formData.get('prompt')).trim(),
      duration: Number(formData.get('duration')),
      resolution: String(formData.get('resolution')),
      aspect_ratio: optionalString(formData, 'aspect_ratio') ?? '16:9',
      fps: 24,
      camera_fixed: formData.get('camera_fixed') === 'on',
      generate_audio: formData.get('generate_audio') === 'on',
      watermark: formData.get('watermark') === 'on',
      use_virtual_avatar: formData.get('use_virtual_avatar') === 'on',
      ...(image && { image }),
      ...(referenceVideo && { reference_video: referenceVideo }),
      ...(lastFrameImage && { last_frame_image: lastFrameImage }),
      ...(referenceImages.length > 0 && { reference_images: referenceImages }),
      ...(referenceAudio && { reference_audio: referenceAudio }),
      ...(seed && { seed: Number(seed) }),
    }

    setIsGenerating(true)
    setError('')
    setVideoUrl('')

    try {
      const response = await fetch('/api/ai/dream/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `生成请求失败，状态码：${response.status}`)
      }

      const result = (await response.json()) as GenerateResponse
      if (result.state !== 'Completed') {
        throw new Error(`视频生成任务状态异常：${result.state}`)
      }
      if (!result.result?.video) throw new Error('生成已完成，但响应中没有视频地址。')
      setVideoUrl(result.result.video)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '视频生成失败。')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Seedance 2.0 Mini</p>
          <h1>梦境视频生成</h1>
          <p>通过文字描述、图片、视频或音频参考素材生成视频。</p>
        </div>
        <span className={styles.model}>bytedance/seedance-2.0-mini</span>
      </header>

      <div className={styles.workspace}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>01</span>
              <div><h2>创作方向</h2><p>描述想要生成的画面，并选择视频输出格式。</p></div>
            </div>

            <label className={styles.field}>
              <span>画面描述 <b>必填</b></span>
              <textarea name="prompt" maxLength={2000} rows={6} required placeholder="例如：电影感跟拍镜头，一只猫坐在窗台上看着雨滴落下……" />
            </label>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>视频时长</span>
                <select name="duration" defaultValue="5">
                  {Array.from({ length: 9 }, (_, index) => index + 4).map((duration) => (
                    <option key={duration} value={duration}>{duration} 秒</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>分辨率</span>
                <select name="resolution" defaultValue="720p">
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>画面比例</span>
                <select name="aspect_ratio" defaultValue="16:9" disabled={hasStartImage}>
                  {ASPECT_RATIOS.map((ratio) => <option key={ratio}>{ratio}</option>)}
                </select>
                {hasStartImage && <small>使用首帧图片时，画面比例由图片决定。</small>}
              </label>
              <label className={styles.field}>
                <span>随机种子 <em>选填</em></span>
                <input
                  name="seed"
                  type="number"
                  min="-9007199254740991"
                  max="9007199254740991"
                  step="1"
                  placeholder="随机"
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>02</span>
              <div><h2>参考素材</h2><p>通过 URL 或 Base64 Data URI 引导视频生成结果。</p></div>
            </div>

            <label className={styles.field}>
              <span>首帧图片 <em>选填</em></span>
              <input name="image" type="text" placeholder="https://... 或 data:image/..." disabled={hasReferenceImages} onChange={(event) => setHasStartImage(Boolean(event.target.value.trim()))} />
            </label>
            <label className={styles.field}>
              <span>尾帧图片 <em>选填</em></span>
              <input name="last_frame_image" type="text" placeholder="需要同时填写首帧图片" disabled={!hasStartImage || hasReferenceImages} />
            </label>
            <label className={styles.field}>
              <span>参考视频 <em>选填</em></span>
              <input name="reference_video" type="text" placeholder="https://... 或 data:video/..." />
            </label>

            <fieldset className={styles.referenceGroup} disabled={hasStartImage}>
              <legend>参考图片组 <em>选填，最多 4 张</em></legend>
              <div className={styles.referenceGrid}>
                {[1, 2, 3, 4].map((index) => (
                  <input key={index} name="reference_images" type="text" aria-label={`参考图片 ${index}`} placeholder={`参考图片 ${index}`} onChange={(event) => {
                    const group = event.currentTarget.closest('fieldset')
                    setHasReferenceImages(Boolean(group?.querySelector<HTMLInputElement>('input:not(:placeholder-shown)')))
                  }} />
                ))}
              </div>
              <small>不能与首帧或尾帧图片同时使用。</small>
            </fieldset>

            <label className={styles.field}>
              <span>参考音频 <em>选填</em></span>
              <input name="reference_audio" type="text" placeholder="https://... 或 data:audio/..." />
              <small>需要同时提供参考图片或参考视频。</small>
            </label>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>03</span>
              <div><h2>生成设置</h2><p>控制镜头、音频和视频输出方式。</p></div>
            </div>
            <div className={styles.toggles}>
              <label><input name="camera_fixed" type="checkbox" /><span><strong>固定镜头</strong><small>保持摄像机位置不变</small></span></label>
              <label><input name="generate_audio" type="checkbox" /><span><strong>生成音频</strong><small>为生成的视频同步创建音频</small></span></label>
              <label><input name="watermark" type="checkbox" /><span><strong>添加水印</strong><small>在输出视频中添加水印</small></span></label>
              <label><input name="use_virtual_avatar" type="checkbox" /><span><strong>虚拟形象</strong><small>使用可信虚拟形象素材库</small></span></label>
            </div>
          </section>

          <button className={styles.submit} type="submit" disabled={isGenerating}>
            {isGenerating ? '正在生成视频……' : '生成视频'}
          </button>
        </form>

        <aside className={styles.preview}>
          <div className={styles.previewHeading}>
            <div><span className={styles.statusDot} data-active={isGenerating || Boolean(videoUrl)} /> 视频预览</div>
            <span>{isGenerating ? '生成中' : videoUrl ? '已完成' : '等待生成'}</span>
          </div>
          <div className={styles.stage} aria-live="polite">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay playsInline />
            ) : isGenerating ? (
              <div className={styles.generating}><span /><strong>正在生成视频</strong><p>生成过程可能需要几分钟。</p></div>
            ) : (
              <div className={styles.empty}><span>▶</span><strong>视频将在这里显示</strong><p>填写表单后开始生成。</p></div>
            )}
          </div>
          {error && <div className={styles.error} role="alert"><strong>生成失败</strong><p>{error}</p></div>}
          {videoUrl && <a className={styles.download} href={videoUrl} target="_blank" rel="noreferrer">在新标签页中打开视频</a>}
        </aside>
      </div>
    </main>
  )
}

export { DreamGenerate as Component }
