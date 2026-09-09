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
const HTML_SEPARATOR = '\n<!-- tooltip-popup -->\n';

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
    const firstTooltipTrigger = tooltipTriggers[0];

    if (!firstTooltipTrigger) {
      return c.text('No tooltip trigger was found', 504);
    }

    await firstTooltipTrigger.hover();
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const tooltipPopup = await page.$(TOOLTIP_POPUP_SELECTOR);

    if (!tooltipPopup) {
      return c.text('Tooltip popup was not found', 504);
    }

    const tooltipHtml = await tooltipPopup.evaluate((element) => element.outerHTML);
    return c.html(cardHtml + HTML_SEPARATOR + tooltipHtml);
  } finally {
    await browser.close();
  }
});

export default app;
