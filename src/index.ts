import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  BROWSER: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const STATS_URL = 'https://app.gmx.io/stats';
const DASHBOARD_CARDS_SELECTOR = '.DashboardV2-cards';
const DASHBOARD_CARD_ROW_SELECTOR = '.DashboardV2-cards .App-card-row';

type Stat = {
  value: string;
  detail: Record<string, never>;
};

app.get('/api/hello', async (c) => {
  const browser = await puppeteer.launch(c.env.BROWSER);

  try {
    const page = await browser.newPage();
    await page.goto(STATS_URL, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    const cards = await page.waitForSelector(DASHBOARD_CARDS_SELECTOR, {
      timeout: 25_000,
    });

    if (!cards) {
      return c.text('Dashboard cards container was not found', 504);
    }

    await new Promise((resolve) => setTimeout(resolve, 25_000));

    const stats = await page.$$eval(
      DASHBOARD_CARD_ROW_SELECTOR,
      (rows) =>
        rows.reduce<Record<string, Stat>>((result, row) => {
          const element = row as unknown as HTMLElement;
          const key = element.querySelector('.label')?.textContent?.trim();
          const value = element
            .querySelector('div:last-of-type')
            ?.textContent?.trim();

          if (key && value) {
            result[key] = {
              value,
              detail: {},
            };
          }

          return result;
        }, {}),
    );

    return c.json(stats);
  } finally {
    await browser.close();
  }
});

export default app;
