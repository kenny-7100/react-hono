import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  BROWSER: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const STATS_URL = 'https://app.gmx.io/stats';
const DASHBOARD_CARDS_SELECTOR =
  '#root > div.App.w-full > div > div.flex.h-full.grow\\.flex-col.overflow-y-auto.scrollbar-gutter-stable.md\\:p-8.md\\:pb-4 > div > div.flex.w-full.max-w-\\[1512px\\].grow\\.flex-col.gap-8.py-8.max-md\\:px-8 > div > div.flex.flex-col.gap-20 > div.DashboardV2-cards';

app.get('/api/hello', async (c) => {
  const browser = await puppeteer.launch(c.env.BROWSER);

  try {
    const page = await browser.newPage();
    await page.goto(STATS_URL, { waitUntil: 'networkidle2' });
    const cards = await page.waitForSelector(DASHBOARD_CARDS_SELECTOR);

    if (!cards) {
      return c.text('Dashboard cards container was not found', 504);
    }

    const html = await cards.evaluate((element) => element.outerHTML);
    return c.html(html);
  } finally {
    await browser.close();
  }
});

export default app;
