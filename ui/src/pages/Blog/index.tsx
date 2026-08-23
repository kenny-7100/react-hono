import { useParams } from 'react-router-dom'
import styles from './index.module.scss'

function Blog() {
  const { id } = useParams<{ id: string }>()

  return <main className={styles.page}>{id}</main>
}

export { Blog as Component }
