import { Link } from 'react-router-dom'
import styles from './index.module.scss'

function NotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className={styles.pageLink} to="/">Return home</Link>
    </main>
  )
}

export { NotFound as Component }
