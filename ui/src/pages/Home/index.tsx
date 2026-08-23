import { useState } from 'react'
import reactLogo from '../../assets/react.svg'
import viteLogo from '../../assets/vite.svg'
import heroImg from '../../assets/hero.png'
import styles from './index.module.scss'

function Home() {
  const [count, setCount] = useState(0)
  const [apiMessage, setApiMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function callHelloApi() {
    setIsLoading(true)
    setApiMessage('')

    try {
      const response = await fetch('/api/hello')
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`)

      const data = (await response.json()) as { message: string }
      setApiMessage(data.message)
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <section className={styles.center}>
        <div className={styles.hero}>
          <img src={heroImg} className={styles.base} width="170" height="179" alt="" />
          <img src={reactLogo} className={styles.framework} alt="React logo" />
          <img src={viteLogo} className={styles.vite} alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>Edit <code>ui/src/pages/Home/index.tsx</code> and save to test <code>HMR</code></p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => setCount((count) => count + 1)}>
            Count is {count}
          </button>
          <button type="button" onClick={callHelloApi} disabled={isLoading}>
            {isLoading ? 'Calling API...' : 'Call API'}
          </button>
        </div>
        <output className={styles.apiResult} aria-live="polite">{apiMessage}</output>
      </section>

      <div className={styles.ticks}></div>
      <section className={styles.nextSteps}>
        <div className={styles.docs}>
          <svg className={styles.icon} role="presentation" aria-hidden="true"><use href="/icons.svg#documentation-icon"></use></svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li><a href="https://vite.dev/" target="_blank"><img className={styles.logo} src={viteLogo} alt="" />Explore Vite</a></li>
            <li><a href="https://react.dev/" target="_blank"><img className={styles.buttonIcon} src={reactLogo} alt="" />Learn more</a></li>
          </ul>
        </div>
        <div className={styles.social}>
          <svg className={styles.icon} role="presentation" aria-hidden="true"><use href="/icons.svg#social-icon"></use></svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li><a href="https://github.com/vitejs/vite" target="_blank"><svg className={styles.buttonIcon} role="presentation" aria-hidden="true"><use href="/icons.svg#github-icon"></use></svg>GitHub</a></li>
            <li><a href="https://chat.vite.dev/" target="_blank"><svg className={styles.buttonIcon} role="presentation" aria-hidden="true"><use href="/icons.svg#discord-icon"></use></svg>Discord</a></li>
            <li><a href="https://x.com/vite_js" target="_blank"><svg className={styles.buttonIcon} role="presentation" aria-hidden="true"><use href="/icons.svg#x-icon"></use></svg>X.com</a></li>
            <li><a href="https://bsky.app/profile/vite.dev" target="_blank"><svg className={styles.buttonIcon} role="presentation" aria-hidden="true"><use href="/icons.svg#bluesky-icon"></use></svg>Bluesky</a></li>
          </ul>
        </div>
      </section>
      <div className={styles.ticks}></div>
      <section className={styles.spacer}></section>
    </>
  )
}

export { Home as Component }
