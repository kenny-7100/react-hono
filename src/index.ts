import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  BROWSER: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/api/hello', async (c) => {
  const browser = await puppeteer.launch(c.env.BROWSER);

  try {
    const page = await browser.newPage();
    await page.goto('https://www.google.com/', { waitUntil: 'networkidle2' });
  } finally {
    await browser.close();
  }

  return c.json({ message: 'Hello Hono!' });
});

export default app;
