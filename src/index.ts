import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  BROWSER: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const STATS_URL = 'https://app.gmx.io/stats';
const DASHBOARD_CARDS_SELECTOR = '.DashboardV2-cards';
const TOOLTIP_TRIGGER_SELECTOR = '.DashboardV2-cards .App-card-row .Tooltip';
const TOOLTIP_POPUP_SELECTOR = '.Tooltip-popup';

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

    const cardHtml = await cards.evaluate((element) => element.outerHTML);
    const tooltipTriggers = await page.$$(TOOLTIP_TRIGGER_SELECTOR);

    if (tooltipTriggers.length === 0) {
      return c.text('No tooltip trigger was found', 504);
    }

    const tooltipHtml: string[] = [];

    for (const tooltipTrigger of tooltipTriggers) {
      await tooltipTrigger.hover();
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      const tooltipPopup = await page.$(TOOLTIP_POPUP_SELECTOR);

      if (!tooltipPopup) {
        continue;
      }

      tooltipHtml.push(
        await tooltipPopup.evaluate((element) => element.outerHTML),
      );
    }

    if (tooltipHtml.length === 0) {
      return c.text('No tooltip popup was found', 504);
    }

    const sections = [
      `<div style="margin-bottom:24px;padding:20px;border:1px solid #3b82f6;border-radius:12px;background:#eff6ff;color:#111827"><h2 style="margin:0 0 16px;font:600 18px/1.4 system-ui,sans-serif;color:#1d4ed8">Dashboard cards</h2>${cardHtml}</div>`,
      ...tooltipHtml.map(
        (html, index) =>
          `<div style="margin-bottom:16px;padding:20px;border:1px solid #f59e0b;border-radius:12px;background:#fffbeb;color:#111827"><h2 style="margin:0 0 16px;font:600 18px/1.4 system-ui,sans-serif;color:#b45309">Tooltip ${index + 1}</h2>${html}</div>`,
      ),
    ];

    return c.html(
      `<main style="max-width:1600px;margin:0 auto;padding:24px;background:#f3f4f6;font-family:system-ui,sans-serif">${sections.join('')}</main>`,
    );
  } finally {
    await browser.close();
  }
});

export default app;
