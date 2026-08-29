import styles from './index.module.scss';

function About() {
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>About</p>
      <h1>React meets Hono</h1>
      <p>This project combines a Vite-powered React interface with a Hono API running on Cloudflare Workers.</p>
    </main>
  );
}

export { About as Component };
