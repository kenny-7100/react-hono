import { useState } from 'react';
import styles from './index.module.scss';

function Home() {
  const [apiMessage, setApiMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function callHelloApi() {
    setIsLoading(true);
    setApiMessage('');

    try {
      const response = await fetch('/api/hello', { method: 'POST' });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

      const data = (await response.json()) as { message: string };
      setApiMessage(data.message);
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <button type="button" onClick={callHelloApi} disabled={isLoading}>
        {isLoading ? 'Calling API...' : 'Call API'}
      </button>
      <output aria-live="polite">{apiMessage}</output>
    </main>
  );
}

export { Home as Component };
